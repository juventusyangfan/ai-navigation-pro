// 教AI导航 · 采集中心 · 智能采集 agent
// -----------------------------------------------------------------------------
// 运行期依赖：一个 OpenAI 兼容的 Chat Completions 端点（原生 fetch，无额外依赖）。
// 不接独立搜索 API：LLM 直接提议候选，再用 fetch 验证 URL 存活并补全 tagline。
// compliance 由 ./compliance 纯函数推导。
import {
  CollectProposal,
  CollectPathProposal,
  CollectStepProposal,
  CollectMedia,
  CollectBranch,
  KNOWN_SCENE_KEYS,
  KNOWN_ROLES,
  PRICING_VALUES,
  normalizeScenes,
  normalizeRoles,
  normalizeHost,
  canonicalSlugFromUrl,
  applyKnownBrand,
  slugify,
  type Pricing,
} from "./contract";
import { deriveCompliance } from "./compliance";

const SYSTEM_PROMPT = `你是「教AI导航」的 K12 教育 AI 产品采集助手。用户会给你一个采集需求（如"初中数学 AI 解题类产品""面向家长的家校沟通工具"），你需要推荐真实存在、公开可访问的中国 K12 教育 AI 产品。

严格只输出一个 JSON 对象，格式如下：
{
  "tools": [
    {
      "name": "产品中文名",
      "slug": "仅小写字母/数字/连字符的 ascii id（如 banjiyouhua、xueersi、zuoyebang），不要用中文",
      "url": "官方首页完整 https URL",
      "tagline": "一句话定位（中文，含厂商/核心能力）",
      "pricing": "Free | Freemium | Paid | Enterprise 之一",
      "platform": "如 APP / 网页 / 硬件",
      "roles": ["老师" | "学生" | "家长" | "学校管理员"] 的子集,
      "scenes": ["从下方 8 个 key 中选 ≥1"],
      "subjects": ["学科名或 综合"],
      "pros": ["2-4 条优势"],
      "cons": ["1-3 条不足"],
      "alts": ["同类产品的 slug 或中文名，可为空数组"],
      "paths": [
        {
          "title": "用该产品完成一个具体教学任务（中文，含产品名）",
          "summary": "一句话描述这条路径做什么、做完能拿到什么",
          "estMinutes": 10,
          "level": "入门 | 进阶 | 熟练 之一",
          "forRole": "老师 | 学生 | 家长 | 学校管理员 之一",
          "steps": [
            {
              "goal": "这一步要达成的目标 / 为什么做（先讲意图）",
              "action": "具体动作描述（在产品的哪个入口操作）",
              "prompt": "可直接复制的提示词或操作指令，用 {{变量}} 占位；纯 UI 步骤写「（在 XX 中）…」式明确指令",
              "outputSample": "示例产出：一小段脱敏的真实感样例，让用户知道做成什么样算对",
              "media": { "type": "video" | "image" | "file", "label": "示意说明（可选）" },
              "pitfall": "常见错误 / 合规红线（可选）",
              "tip": "正向提效技巧（可选）",
              "branch": [ { "when": "遇到某情况", "then": "建议怎么走" } ]
            }
          ]
        }
      ]
    }
  ]
}

  示例（风格参考，请按此详尽度输出）：
  {
    "tools": [
      {
        "name": "洋葱学园",
        "slug": "yangcong",
        "url": "https://yangcongxueyuan.com",
        "tagline": "动画微课 + 精准学的 K12 自学平台",
        "pricing": "Freemium",
        "platform": "APP / 网页",
        "roles": ["学生", "老师"],
        "scenes": ["zixue", "kejian"],
        "subjects": ["数学"],
        "pros": ["动画讲透难点", "精准学定位薄弱点"],
        "cons": ["部分内容付费", "依赖自觉"],
        "alts": ["xueersi", "zuoyebang"],
        "paths": [
          {
            "title": "用洋葱学园做知识点自学与查漏补缺",
            "summary": "精准学诊断薄弱点 → 动画微课讲透 → 智能练习巩固 → 学情报告复盘。",
            "estMinutes": 20,
            "level": "入门",
            "forRole": "学生",
            "steps": [
              {
                "goal": "先把学段和教材版本选对，否则练习和课本不同步",
                "action": "在「我的」设置年级、学科与教材版本",
                "prompt": "（「我的」→ 年级 / 学科 / 教材版本）选择：{{年级}} · {{学科}} · {{教材版本}}",
                "outputSample": "页面显示「初二 · 数学 · 人教版」，首页推荐已同步刷新。",
                "pitfall": "版本选错会导致练习与课本脱节，先核对课本封面版本。",
                "tip": "开学初检查一次设置最稳妥。"
              },
              {
                "goal": "用诊断把时间花在真正不会的地方",
                "action": "在「精准学」选当前章节做诊断",
                "prompt": "（精准学）诊断我对「{{当前章节}}」的掌握情况，标出最薄弱的 3 个知识点并给优先复习顺序。",
                "outputSample": "「二次函数图像」已掌握 35%，建议优先复习；「一元二次方程」已掌握 82% 可跳过。",
                "branch": [ { "when": "临近考试", "then": "进复习计划每天推 10 题" } ]
              }
            ]
          }
        ]
      }
    ]
  }

硬约束：
- scenes 只能从 beikeguihua, kejian, zuoye, xueqing, jiaxiao, zixue, keti, shijian 中选择，至少 1 个；映射不到已知场景的产品直接丢弃，不要输出。
- roles 只能从 老师, 学生, 家长, 学校管理员 中选择。
- 不要输出 compliance / logo / color / rating 字段（由系统自动生成）。
- 每个产品生成 1-2 条 paths，每条 3-5 个 steps；steps 必须具体、贴近该产品真实功能，不要泛泛而谈。
- 每步必须包含 goal / action / prompt / outputSample；尽量补充 pitfall / tip / branch 让内容更实用。
- prompt 必须具体可复制、用 {{变量}} 占位；outputSample 给一段真实感样例（不要只写"示例代码"）。
- paths[].level 只能是 入门、进阶、熟练 之一。
- 排除：纯通用大模型（无教育向）、纯海外无中国大陆访问通道、已停运产品。
- 只输出 JSON，不要任何解释性文字。`;

export type CollectOptions = {
  query: string;
  count?: number;
  sceneFilter?: string;
};

/** 采集一轮，返回候选提案（尚未入库）。 */
export async function runCollect(opts: CollectOptions): Promise<CollectProposal[]> {
  const cfg = {
    baseUrl: (process.env.COLLECT_LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: process.env.COLLECT_LLM_API_KEY || "",
    model: process.env.COLLECT_LLM_MODEL || "gpt-4o-mini",
  };
  if (!cfg.apiKey) {
    throw new Error("缺少 COLLECT_LLM_API_KEY 环境变量（在 .env 中配置 LLM 运行时）");
  }

  const count = Math.max(1, Math.min(30, Number(opts.count) || 10));
  const userMsg =
    `采集需求：${opts.query || "推荐一些 K12 教育 AI 产品"}\n` +
    `目标数量：约 ${count} 个\n` +
    (opts.sceneFilter ? `限定场景：${opts.sceneFilter}\n` : "") +
    `已知场景 key（scenes 必须只从这些里选）：${KNOWN_SCENE_KEYS.join(", ")}\n` +
    `已知角色（roles 必须只从这些里选）：${KNOWN_ROLES.join(", ")}\n` +
    `排除：纯通用 LLM 无教育向、纯海外无 CN 访问通道、已停运产品。`;

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`LLM 调用失败（${resp.status}）：${text.slice(0, 300)}`);
  }

  const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const content = j.choices?.[0]?.message?.content ?? "{}";
  let parsed: { tools?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("LLM 返回的不是合法 JSON");
  }

  const rawTools = Array.isArray(parsed.tools) ? (parsed.tools as Record<string, unknown>[]) : [];
  const proposals: CollectProposal[] = [];

  for (const r of rawTools) {
    const scenes = normalizeScenes(r.scenes);
    const roles = normalizeRoles(r.roles);
    if (scenes.length === 0) continue; // 分类纪律：未映射到已知 scene 直接丢弃

    const name = String(r.name || "").trim() || "未命名";
    const pricing = (PRICING_VALUES as readonly string[]).includes(String(r.pricing))
      ? (r.pricing as Pricing)
      : "Freemium";
    const subjects = Array.isArray(r.subjects)
      ? (r.subjects as unknown[]).map(String).filter(Boolean).slice(0, 8)
      : ["综合"];

    // 命中已知品牌则强制纠正官方 URL/slug；否则由 URL 推导稳定 slug（避免换 slug 重复入库）
    const brand = applyKnownBrand(name, String(r.url || "").trim());
    const finalUrl = brand.url;
    const finalSlug =
      brand.matched
        ? brand.slug
        : String(r.slug || "").toLowerCase().trim() ||
          canonicalSlugFromUrl(finalUrl) ||
          slugify(name);

    // 强校验：取页面 title 做品牌词匹配 + 抓 favicon/og:image 作为 logo
    const v = await verifyAndFetch(finalUrl, name);
    const urlVerified = brand.matched ? true : v.ok && v.brandMatch;
    const urlWarning = brand.matched
      ? undefined
      : !v.ok
        ? "URL 不可达，请核对"
        : !v.brandMatch
          ? "页面标题未含品牌词，URL 可能不准，请核对"
          : undefined;
    let logo = v.logo;
    if (!logo && brand.matched) {
      try {
        logo = new URL(finalUrl).origin + "/favicon.ico";
      } catch {
        logo = "";
      }
    }

    proposals.push({
      slug: finalSlug,
      name,
      url: finalUrl,
      tagline: String(r.tagline || "").trim(),
      pricing,
      platform: String(r.platform || "").trim(),
      roles,
      scenes,
      subjects,
      pros: arr(r.pros).slice(0, 6),
      cons: arr(r.cons).slice(0, 6),
      alts: arr(r.alts).slice(0, 6),
      compliance: deriveCompliance(scenes, roles),
      logo,
      color: "#2f6bff",
      rating: 0,
      urlVerified,
      urlWarning,
      paths: parsePaths(r.paths, scenes, roles),
    });
  }

  return proposals;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map(String).filter(Boolean) : [];
}

const VALID_LEVELS = new Set(["入门", "进阶", "熟练"]);
const VALID_ROLES_SET = new Set<string>(KNOWN_ROLES);

function parsePaths(raw: unknown, _scenes: string[], roles: string[]): CollectPathProposal[] {
  if (!Array.isArray(raw)) return [];
  const out: CollectPathProposal[] = [];
  for (const rp of raw as Record<string, unknown>[]) {
    const stepsRaw = Array.isArray(rp.steps) ? (rp.steps as Record<string, unknown>[]) : [];
    const steps: CollectStepProposal[] = [];
    for (const rs of stepsRaw) {
      steps.push({
        goal: String(rs.goal ?? "").trim() || undefined,
        action: String(rs.action ?? "").trim(),
        prompt: String(rs.prompt ?? "").trim(),
        outputSample: String(rs.outputSample ?? "").trim(),
        media: parseMedia(rs.media),
        pitfall: String(rs.pitfall ?? "").trim() || undefined,
        tip: String(rs.tip ?? "").trim() || undefined,
        branch: parseBranch(rs.branch),
      });
    }
    if (!rp.title || steps.length === 0) continue;
    const level = String(rp.level ?? "").trim();
    const forRole = String(rp.forRole ?? "").trim();
    out.push({
      title: String(rp.title).trim(),
      summary: String(rp.summary ?? "").trim() || undefined,
      estMinutes: Number(rp.estMinutes) || undefined,
      level: VALID_LEVELS.has(level) ? level : undefined,
      forRole: VALID_ROLES_SET.has(forRole) ? forRole : roles[0] ?? undefined,
      steps: steps.slice(0, 8),
    });
  }
  return out.slice(0, 3);
}

function parseMedia(v: unknown): CollectMedia | undefined {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const type = String(o.type ?? "");
    const label = String(o.label ?? "").trim();
    if ((type === "image" || type === "video" || type === "file") && label) {
      return { type: type as CollectMedia["type"], label };
    }
  }
  return undefined;
}

function parseBranch(v: unknown): CollectBranch[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CollectBranch[] = [];
  for (const b of v as Record<string, unknown>[]) {
    const when = String(b.when ?? "").trim();
    const then = String(b.then ?? "").trim();
    if (when && then) out.push({ when, then });
  }
  return out.length ? out : undefined;
}

/** 验证 URL 可达性，并抓取页面标题/logo 做品牌词匹配。返回 logo(URL) 与匹配结果。 */
async function verifyAndFetch(url: string, name: string): Promise<{
  ok: boolean;
  title: string;
  logo: string;
  host: string;
  brandMatch: boolean;
}> {
  const empty = { ok: false, title: "", logo: "", host: "", brandMatch: false };
  if (!/^https?:\/\//i.test(url)) return empty;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; EduNavBot/1.0)" },
    });
    if (r.status >= 400) return empty;
    const finalUrl = r.url || url;
    const host = normalizeHost(finalUrl);
    const text = (await r.text().catch(() => "")).slice(0, 200_000);
    const title = extractTitle(text);
    const logo = extractLogo(text, finalUrl);
    const brandMatch = matchBrand(title, host, name);
    return { ok: true, title, logo, host, brandMatch };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function extractLogo(html: string, finalUrl: string): string {
  const links = [
    ...html.matchAll(
      /<link[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*href=["']([^"']+)["']/gi,
    ),
  ];
  for (const l of links) {
    const href = l[1];
    if (href && !/^data:/i.test(href)) return absoluteUrl(href, finalUrl);
  }
  const og = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (og && og[1]) return absoluteUrl(og[1], finalUrl);
  try {
    return new URL(finalUrl).origin + "/favicon.ico";
  } catch {
    return "";
  }
}

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** 页面标题或宿主是否包含产品品牌词（去除通用后缀后取片段），用于鉴别编造 URL。 */
function matchBrand(title: string, host: string, name: string): boolean {
  const t = title.toLowerCase();
  const h = host.toLowerCase();
  const tokens = name
    .replace(/(官网|首页|官方|平台|app|APP|网|科技|教育|学习|智能|AI)/g, "")
    .split(/[\s/·\-_]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2);
  for (const tk of tokens) {
    if (t.includes(tk) || h.includes(tk)) return true;
  }
  const slug = canonicalSlugFromUrl(`https://${host}`);
  if (slug && (h.includes(slug) || slugify(name).includes(slug))) return true;
  return false;
}
