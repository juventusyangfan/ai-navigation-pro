// POST /api/evaluate —— 提交作文，返回评测报告
//
// 流程：校验入参 → 限额 → 取正文（文字直接用；图片先识别）→ 服务端算准字数
//      → 评测 → 归一化 + 合规过滤 → 加密入库 → 返回报告 id 与内容
//
// 为什么图片要先单独识别一次、再评一次（而不是一次调用搞定）：
// 实测让模型「识别+评测」一步走时，它会自己估算篇幅，把 98 字说成「一百五十字左右」。
// 字数一旦错了，整份报告在家长眼里就不可信。所以正文必须落成文字、字数由我们自己数。

import { NextRequest } from "next/server";
import { ask, hasLlmKey, llmConfig, LlmError, type ChatMessage } from "@/lib/llm";
import {
  charCount,
  evaluateSystemPrompt,
  evaluateUserPrompt,
  normalizeReport,
  recognizeUserPrompt,
  RECOGNIZE_SYSTEM,
  type Report,
} from "@/lib/rubric";
import { bandOf, isGrade } from "@/lib/grade";
import { encryptText, hashIp } from "@/lib/crypto";
import { prisma } from "@/lib/store";
import { ok, fail, guarded } from "@/lib/http";
import {
  ANON_COOKIE,
  anonCookieOptions,
  dailyLimit,
  globalDailyCap,
  globalUsedToday,
  newAnonId,
  readAnonId,
  usedToday,
} from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 2000; // 小学作文最长 600 字，2000 足够容纳误粘贴
const MIN_CHARS = 10;
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 单张解码后的上限（前端已压到 1600px）

const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/;

type Body = {
  grade?: unknown;
  title?: unknown;
  text?: unknown;
  images?: unknown;
  consent?: unknown;
};

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 校验并归一化图片 data URL，同时返回解码后的字节数（用于限额与日志）。 */
function validateImages(raw: unknown): { urls: string[]; bytes: number } | { error: string } {
  if (raw == null) return { urls: [], bytes: 0 };
  if (!Array.isArray(raw)) return { error: "图片参数格式不正确" };
  if (raw.length > MAX_IMAGES) return { error: `最多上传 ${MAX_IMAGES} 张图片` };
  const urls: string[] = [];
  let bytes = 0;
  for (const item of raw) {
    if (typeof item !== "string") return { error: "图片参数格式不正确" };
    const m = DATA_URL.exec(item.trim());
    if (!m) return { error: "图片格式不支持，请上传 JPG、PNG 或 WebP" };
    const size = Math.floor((m[2].replace(/\s/g, "").length * 3) / 4);
    if (size > MAX_IMAGE_BYTES) return { error: "图片太大了，请压缩后重试" };
    bytes += size;
    urls.push(item.trim());
  }
  return { urls, bytes };
}

/** 图片 → 文字。识别不清时返回 null，由上层给出「请重拍」的提示。 */
async function recognize(urls: string[]): Promise<{ text: string; title: string } | null> {
  const content: ChatMessage["content"] = [
    { type: "text", text: "请转录这些图片中的作文，按图片顺序拼接。" },
    ...urls.map((u) => ({ type: "image_url" as const, image_url: { url: u } })),
  ];
  const { content: out } = await ask({
    messages: [
      { role: "system", content: RECOGNIZE_SYSTEM },
      { role: "user", content },
    ],
    maxTokens: 1800,
    temperature: 0,
    json: true,
  });
  let data: any;
  try {
    data = JSON.parse(out);
  } catch {
    return null;
  }
  const text = typeof data?.text === "string" ? cleanText(data.text) : "";
  if (data?.ok === false || data?.clarity === "blurry" || charCount(text) < MIN_CHARS) return null;
  return { text, title: typeof data?.title === "string" ? data.title.trim() : "" };
}

async function handle(req: NextRequest): Promise<Response> {
  if (!hasLlmKey()) {
    console.error("[zuowen][evaluate] 未配置 ZW_LLM_API_KEY");
    return fail(503, "测评服务暂未开通，请稍后再试");
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式不正确");
  }

  const grade = Number(body.grade);
  if (!isGrade(grade)) return fail(400, "请先选择孩子的年级");

  // 监护人同意是硬门槛：没有它就不该有这次处理。
  // 前端会把同意状态记在本地，每次提交都带上来，这里只做最后一道检查。
  if (body.consent !== true) {
    return fail(400, "请先阅读并同意《儿童个人信息处理规则》", { code: "NO_CONSENT" });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 40) : "";
  const rawText = typeof body.text === "string" ? cleanText(body.text) : "";
  const img = validateImages(body.images);
  if ("error" in img) return fail(400, img.error);

  const hasText = charCount(rawText) >= MIN_CHARS;
  const hasImages = img.urls.length > 0;
  if (!hasText && !hasImages) {
    return fail(400, `请粘贴作文内容，或上传作文照片（至少 ${MIN_CHARS} 个字）`);
  }
  if (hasText && charCount(rawText) > MAX_CHARS) {
    return fail(400, `作文太长了，请控制在 ${MAX_CHARS} 字以内`);
  }

  // ---- 限额 ----
  const existingAnon = await readAnonId();
  const anonId = existingAnon ?? newAnonId();
  const limit = dailyLimit();
  if (existingAnon) {
    const used = await usedToday(existingAnon);
    if (used >= limit) {
      return fail(429, `今天已经测过 ${used} 次啦，明天再来看看孩子的进步吧`, {
        code: "DEVICE_LIMIT",
        limit,
      });
    }
  }
  const total = await globalUsedToday();
  if (total >= globalDailyCap()) {
    console.warn(`[zuowen][evaluate] 全站当日额度已用尽：${total}`);
    return fail(429, "今天的测评名额已经满了，明天早上再来试试", { code: "GLOBAL_CAP" });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

  // ---- 取正文 ----
  let text = rawText;
  let source: "text" | "image" = "text";
  let finalTitle = title;

  try {
    if (!hasText && hasImages) {
      source = "image";
      const rec = await recognize(img.urls);
      if (!rec) {
        return fail(422, "照片里的字有点看不清，麻烦对着光线重拍一张，或者直接把文字粘贴进来", {
          code: "UNREADABLE",
        });
      }
      text = rec.text;
      // 标题只在家长没填时补，不覆盖家长自己写的
      if (!finalTitle && rec.title) finalTitle = rec.title.slice(0, 40);
      if (charCount(text) > MAX_CHARS) {
        return fail(400, "识别出的内容太长了，请确认上传的是作文照片");
      }
    }

    const charsNow = charCount(text);
    if (charsNow < MIN_CHARS) {
      return fail(400, "内容太短了，暂时没法点评，再写几句试试？");
    }

    // ---- 评测 ----
    const cfg = llmConfig();
    const { content: out, usage } = await ask({
      messages: [
        { role: "system", content: evaluateSystemPrompt(grade) },
        {
          role: "user",
          content: evaluateUserPrompt({
            grade,
            title: finalTitle,
            text,
            charCount: charsNow,
          }),
        },
      ],
      maxTokens: 2400,
      temperature: 0.4,
      json: true,
    });

    let rawJson: any;
    try {
      rawJson = JSON.parse(out);
    } catch {
      throw new LlmError("BAD_JSON", "模型返回的报告不是合法 JSON");
    }

    const report: Report = normalizeReport(rawJson, {
      grade,
      text,
      charCount: charsNow,
    });
    if (report.total === 0) {
      throw new LlmError("EMPTY", "模型未能给出有效评分");
    }

    return await persistAndRespond({
      report,
      text,
      finalTitle,
      grade,
      chars: charsNow,
      source,
      anonId,
      existingAnon,
      ip,
      usage,
      model: cfg.model,
    });
  } catch (e) {
    if (e instanceof LlmError) {
      console.error(`[zuowen][evaluate] 模型异常 code=${e.code} status=${e.status} ${e.message}`);
      if (e.code === "TIMEOUT") {
        return fail(504, "这次分析花的时间有点久，请再点一次试试", { code: "TIMEOUT" });
      }
      if (e.code === "RATE_LIMIT") {
        return fail(503, "现在排队的人有点多，过一会儿再来吧", { code: "BUSY" });
      }
      if (e.code === "NO_KEY") {
        return fail(503, "测评服务暂未开通，请稍后再试", { code: "NOT_READY" });
      }
      return fail(502, "分析服务刚刚打了个盹，请再点一次试试", { code: "UPSTREAM" });
    }
    throw e;
  }
}

/** 落库 + 组装响应。抽出来是为了让主流程的 try/catch 只覆盖模型调用。 */
async function persistAndRespond(args: {
  report: Report;
  text: string;
  finalTitle: string;
  grade: number;
  chars: number;
  source: "text" | "image";
  anonId: string;
  existingAnon: string | null;
  ip: string;
  usage: unknown;
  model: string;
}): Promise<Response> {
  const { report, text, finalTitle, grade, chars, source, anonId, existingAnon, ip, usage, model } =
    args;

  // ---- 落库 ----
  // 走到这里的都是识别成功或本来就有文字的，readable 恒为 true；
  // 识别失败的请求在识别阶段就已经返回 422，不会产生脏记录。
  const encText = encryptText(text);
  const row = await prisma.essayReview.create({
    data: {
      anonId,
      ipHash: ip ? hashIp(ip) : null,
      grade,
      title: finalTitle || null,
      genre: report.genre,
      charCount: chars,
      source,
      readable: true,
      encText,
      report: JSON.stringify(report),
      total: report.total,
      level: report.level,
      model,
    },
    select: { id: true, createdAt: true },
  });

  if (report.flags.length) {
    console.warn(`[zuowen][合规过滤] id=${row.id} flags=${report.flags.join(",")}`);
  }
  console.log(
    `[zuowen][evaluate] id=${row.id} grade=${grade} source=${source} chars=${chars} total=${report.total} tokens=${JSON.stringify(usage)}`,
  );

  const res = ok({
    ok: true,
    id: row.id,
    report,
    // 识别出的正文回传一次，让家长能核对有没有识别错；
    // 之后从报告页读的是加密存的同一份，不再重复上传。
    text: source === "image" ? text : undefined,
    title: finalTitle || undefined,
  });

  if (!existingAnon) {
    res.headers.append("Set-Cookie", serializeCookie(ANON_COOKIE, anonId, anonCookieOptions()));
  }
  return res;
}

function serializeCookie(
  name: string,
  value: string,
  opts: ReturnType<typeof anonCookieOptions>,
): string {
  const parts = [`${name}=${value}`, `Path=${opts.path}`, `Max-Age=${opts.maxAge}`, "SameSite=Lax"];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export async function POST(req: NextRequest) {
  return guarded("evaluate", () => handle(req));
}
