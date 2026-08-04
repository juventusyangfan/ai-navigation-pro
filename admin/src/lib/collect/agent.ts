// 教AI导航 · 采集中心 · 智能采集 agent
// -----------------------------------------------------------------------------
// 运行期依赖：一个 OpenAI 兼容的 Chat Completions 端点（原生 fetch，无额外依赖）。
// 不接独立搜索 API：LLM 直接提议候选，再用 fetch 验证 URL 存活并补全 tagline。
// compliance 由 ./compliance 纯函数推导。
import {
  CollectProposal,
  KNOWN_SCENE_KEYS,
  KNOWN_ROLES,
  PRICING_VALUES,
  normalizeScenes,
  normalizeRoles,
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
      "alts": ["同类产品的 slug 或中文名，可为空数组"]
    }
  ]
}

硬约束：
- scenes 只能从 beikeguihua, kejian, zuoye, xueqing, jiaxiao, zixue, keti, shijian 中选择，至少 1 个；映射不到已知场景的产品直接丢弃，不要输出。
- roles 只能从 老师, 学生, 家长, 学校管理员 中选择。
- 不要输出 compliance / logo / color / rating 字段（由系统自动生成）。
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

    const url = String(r.url || "").trim();
    const urlVerified = await verifyUrl(url);

    const pricing = (PRICING_VALUES as readonly string[]).includes(String(r.pricing))
      ? (r.pricing as Pricing)
      : "Freemium";
    const name = String(r.name || "").trim() || "未命名";
    const subjects = Array.isArray(r.subjects)
      ? (r.subjects as unknown[]).map(String).filter(Boolean).slice(0, 8)
      : ["综合"];

    proposals.push({
      slug: String(r.slug || "").toLowerCase().trim(),
      name,
      url,
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
      logo: name.slice(0, 2),
      color: "#2f6bff",
      rating: 0,
      urlVerified,
    });
  }

  return proposals;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map(String).filter(Boolean) : [];
}

/** 验证 URL 是否可访问（GET，6s 超时）。仅作可达性探测，不解析内容。 */
async function verifyUrl(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; EduNavBot/1.0)" },
    });
    return r.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
