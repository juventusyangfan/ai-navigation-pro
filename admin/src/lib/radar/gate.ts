/**
 * 武汉教育赛事雷达 · 门槛校验与打分（服务端强制复刻）
 *
 * 为什么要在服务端再实现一遍：技能 `radar.py` 的 gate() 是内容生产的守门人，
 * 但后台允许人工录入与编辑，手工数据天然绕过那四道门槛。若不在服务端强制复刻，
 * 一条培训机构自办、收费、无官方红头的活动就能被手工录进去、直接发到服务号。
 *
 * 与 radar.py 的对应关系（改动必须两侧同步）：
 *   norm_key / make_id   → normKey（在 contract.ts）/ makeId
 *   parse_date           → parseDate
 *   t_score / c_score    → tScore / cScore
 *   evaluate()           → evaluateCandidate()
 *   merge 保底           → applyPromotion()
 *   resolve_whitelist()  → resolveWhitelist()（在 whitelist.ts）
 * 新增 G5（话术红线）为服务端独有门槛，技能侧无此检查。
 */
import { createHash } from "node:crypto";
import {
  BANNED_BLOCKING,
  BANNED_WARNING,
  CATEGORY_LABEL,
  CATEGORY_SCORE,
  GRADE_LABEL,
  KEYDATE_LABEL,
  MAX_SOURCE_TIER,
  normKey,
  PROMOTE_FLOOR,
  PROMOTE_MIN_COUNT,
  REGIONS,
  REQUIRED_FIELDS,
  ROLE_LABEL,
  SCAN_FIELDS,
  scanText,
  WHITELIST_C_BONUS,
  type Bucket,
} from "./contract";
import { resolveWhitelist, type WhitelistVerdict } from "./whitelist";

/* ----------------------------- 基础工具 ----------------------------- */

/** 以北京时间取「今天」，避免服务器 UTC 时区导致日期偏移一天 */
export function todayIso(offsetHours = 8): string {
  const shifted = new Date(Date.now() + offsetHours * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** 归一化活动名（跨来源去重的键）。实现已上移到 contract.ts，供 whitelist.ts 共用。 */
export { normKey };

/** 活动稳定去重键：normKey 的 SHA1 前 12 位。等价于 radar.py 的 make_id。 */
export function makeId(name: string): string {
  return createHash("sha1").update(normKey(name), "utf8").digest("hex").slice(0, 12);
}

/** 解析日期为 "YYYY-MM-DD"；失败返回 null。等价于 radar.py 的 parse_date。 */
export function parseDate(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).trim();
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return isoOf(Number(y), Number(mo), Number(d));
  }
  m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return isoOf(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function isoOf(y: number, mo: number, d: number): string | null {
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** 以 UTC 日期差计算，规避夏令时/时区造成的 ±1 天误差 */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** 时效性得分：越接近关键节点分越高。等价于 radar.py 的 t_score。 */
export function tScore(days: number): number {
  if (!Number.isFinite(days)) return 1;
  if (days <= 3) return 5;
  if (days <= 7) return 4;
  if (days <= 14) return 3;
  if (days <= 30) return 2;
  return 1;
}

/** 可信度得分：按信源层级。等价于 radar.py 的 c_score。 */
export function cScore(sourceTier: number, override?: unknown): number {
  if (typeof override === "number" && override >= 0 && override <= 5) return override;
  return { 1: 5, 2: 4, 3: 3 }[sourceTier] ?? 2;
}

/** 总分 = R×0.40 + T×0.35 + C×0.25 */
export function totalScore(r: number, t: number, c: number): number {
  return Math.round((r * 0.4 + t * 0.35 + c * 0.25) * 100) / 100;
}

export function bucketOf(total: number): Bucket {
  if (total >= 4.0) return "A";
  if (total >= 3.0) return "B";
  return "C";
}

/* ---------------------------- 类型定义 ---------------------------- */

export interface SiblingRef {
  name: string;
  location?: string;
  signupMethod?: string;
  notes?: string;
}

export interface RawCandidate {
  [key: string]: unknown;
}

export interface EvaluatedCandidate {
  externalId: string;
  name: string;
  organizer: string;
  coOrganizer: string | null;
  audienceRaw: string;
  grades: string[];
  roles: string[];
  category: string;
  region: string;
  keyDate: string;
  keyDateType: string;
  timeRange: string | null;
  location: string | null;
  fee: string;
  signupMethod: string;
  sourceUrl: string;
  sourceName: string;
  sourceTier: number;
  notes: string | null;
  siblings: SiblingRef[];

  rScore: number;
  tScore: number;
  /** 可信度实际得分（已含白名单加分，上限 5.0） */
  cScore: number;
  /** 加分前的可信度基数，用于解释「为什么分高」 */
  cScoreBase: number;
  /** 实际生效的白名单加分（C 分原本已满 5.0 时为 0） */
  whitelistBonus: number;
  suggestedTotal: number;
  suggestedBucket: Bucket;
  promoted: boolean;

  gatePassed: boolean;
  gateCodes: string[];
  warnings: string[];
  complianceNote: string;
  /** 白名单判定：不是门槛，但会影响 cScore */
  whitelist: WhitelistVerdict;
}

/* ---------------------------- 门槛校验 ---------------------------- */

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
}

/** 复刻 radar.py 的 build_compliance_note */
export function buildComplianceNote(fee: string, tier: number, keyDateType: string, whitelistStatus = "unknown"): string {
  const notes: string[] = [];
  // 只有「免费 + 名单内竞赛」才不必附加「不参与组织」的免责——其余一律附加
  if (fee !== "free" || tier > MAX_SOURCE_TIER || whitelistStatus !== "confirmed") {
    notes.push("仅作信息告知，本平台不参与组织、不引导报名");
  }
  if (keyDateType === "signup_start" || keyDateType === "signup_deadline") {
    notes.push("不代收作品、不代传报名，仅提供方法指导");
  }
  notes.push("不承诺获奖结果，不与升学或评优关联表述");
  return notes.join("；");
}

/**
 * 执行 G 层门槛 + R/T/C 打分。
 *
 * 注意：门槛未通过的条目**同样返回完整结构**（gatePassed=false），
 * 因为被拦截记录必须入库——它是判断「门槛到底在工作还是形同虚设」的唯一证据。
 */
export function evaluateCandidate(raw: RawCandidate, today: string): EvaluatedCandidate {
  const codes: string[] = [];
  const warnings: string[] = [];

  // —— G0：必填字段 ——
  const missing = REQUIRED_FIELDS.filter((f) => {
    const v = raw[f];
    return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  });
  // 字段都没填全时后续判定没有意义，短路返回：避免报出一串派生码
  // （例如 region 缺失会连带触发 G1、grades 缺失会连带触发 G2），把根因淹没掉。
  const fieldShortCircuit = missing.length > 0;
  if (fieldShortCircuit) codes.push(`G0_FIELD_MISSING:${missing.join(",")}`);

  const name = str(raw.name);
  const keyDateRaw = parseDate(raw.key_date);
  if (!keyDateRaw) codes.push("G0_BAD_DATE:key_date");

  // —— G1：地域 ——
  const region = str(raw.region).toLowerCase();
  if (!fieldShortCircuit && !(REGIONS as readonly string[]).includes(region)) codes.push("G1_REGION_OUT");

  // —— G2：参赛对象 ——
  const grades = strArray(raw.grades).filter((g) => g in GRADE_LABEL);
  const roles = strArray(raw.roles).filter((r) => r in ROLE_LABEL);
  if (!fieldShortCircuit && (!grades.length || !roles.length)) codes.push("G2_AUDIENCE_OUT");

  // —— G3：时效 ——
  const days = keyDateRaw ? daysBetween(today, keyDateRaw) : NaN;
  if (keyDateRaw && Number.isFinite(days) && days < 0) codes.push("G3_EXPIRED");

  // —— G4：信源层级 ——
  const sourceTier = Number(raw.source_tier ?? 4) || 4;
  if (!fieldShortCircuit && sourceTier > MAX_SOURCE_TIER && !raw.verified_backtrack) {
    codes.push("G4_LOW_CREDIBILITY");
  }

  // —— G5（服务端独有）：话术红线 ——
  const scanCorpus = SCAN_FIELDS.map((f) => str(raw[f])).join("\n");
  const siblings = Array.isArray(raw.siblings) ? (raw.siblings as RawCandidate[]) : [];
  const siblingText = siblings
    .map((s) => [str(s?.name), str(s?.location), str(s?.signup_method), str(s?.notes)].join(" "))
    .join("\n");
  const blocking = scanText(`${scanCorpus}\n${siblingText}`, BANNED_BLOCKING);
  if (blocking.length) codes.push(`G5_BANNED_PHRASE:${[...new Set(blocking)].join(",")}`);
  warnings.push(...[...new Set(scanText(`${scanCorpus}\n${siblingText}`, BANNED_WARNING))]);

  // —— 打分 ——
  const category = str(raw.category).toLowerCase() || "general";
  const r = CATEGORY_SCORE[category] ?? 1;
  const t = tScore(days);

  // 白名单判定必须先于 C 分：判为名单内的竞赛在可信度维度上调分（与 radar.py 同步）
  const whitelist = resolveWhitelist(raw);
  // 覆盖值优先取 c_score_base：技能产出（output/*.json）里的 c_score 已含白名单加分，
  // 直接拿来当 override 会二次加分（多数被 5.0 上限挡住，但 tier 低 + 已核验的边界会算出不同结果）。
  // 原始候选（raw/*.json）没有 c_score_base，退回 c_score，语义不变。
  const cScoreBase = cScore(sourceTier, raw.c_score_base ?? raw.c_score);
  const cRaw = whitelist.status === "confirmed" ? cScoreBase + WHITELIST_C_BONUS : cScoreBase;
  const c = Math.round(Math.min(5, cRaw) * 100) / 100;
  const whitelistBonus = Math.round((c - cScoreBase) * 100) / 100;
  const total = totalScore(r, t, c);

  const keyDateType = str(raw.key_date_type);
  const fee = str(raw.fee) || "unknown";

  return {
    externalId: makeId(name),
    name,
    organizer: str(raw.organizer),
    coOrganizer: str(raw.co_organizer) || null,
    audienceRaw: str(raw.audience_raw),
    grades,
    roles,
    category,
    region,
    keyDate: keyDateRaw ?? "",
    keyDateType,
    timeRange: str(raw.time_range) || null,
    location: str(raw.location) || null,
    fee,
    signupMethod: str(raw.signup_method),
    sourceUrl: str(raw.source_url),
    sourceName: str(raw.source_name),
    sourceTier,
    notes: str(raw.notes) || null,
    siblings: siblings.map((s) => ({
      name: str(s?.name),
      location: str(s?.location) || undefined,
      signupMethod: str(s?.signup_method) || undefined,
      notes: str(s?.notes) || undefined,
    })),

    rScore: r,
    tScore: t,
    cScore: c,
    cScoreBase,
    whitelistBonus,
    suggestedTotal: total,
    suggestedBucket: bucketOf(total),
    promoted: false,

    gatePassed: codes.length === 0,
    gateCodes: codes,
    warnings,
    complianceNote: buildComplianceNote(fee, sourceTier, keyDateType, whitelist.status),
    whitelist,
  };
}

/* ------------------------- 主推保底（相对判断） ------------------------- */

/**
 * 主推保底：A 档不足 2 条时从 B 档按「总分 → 相关性 → 关键节点」提升补足。
 *
 * 起因：绝对阈值对运行日过于敏感。「科普征文」距截止 9 天总分 3.65 跌出 A 档、
 * 7 天总分 4.00 进 A 档，同一批数据因运行日差两天，主推区就从有变空。
 * 「主推」是相对概念——本周最值得关注的那几条，不该由绝对分数划线决定。
 *
 * 约束：不跨 C 档提升（保持分档语义）；只提升 ≥ 保底分的条目，不为凑数硬推低质信息。
 */
export function applyPromotion<
  T extends { suggestedBucket: Bucket; suggestedTotal: number; rScore: number; keyDate: string; gatePassed?: boolean },
>(list: T[]): T[] {
  // 未过门槛的条目不参与保底：把一条对象不符的活动提成「主推」是荒谬的
  const eligible = list.filter((x) => x.gatePassed !== false);
  const a = eligible.filter((x) => x.suggestedBucket === "A");
  if (a.length >= PROMOTE_MIN_COUNT) return list;

  const need = PROMOTE_MIN_COUNT - a.length;
  const pool = eligible
    .filter((x) => x.suggestedBucket === "B" && x.suggestedTotal >= PROMOTE_FLOOR)
    .sort((x, y) => y.suggestedTotal - x.suggestedTotal || y.rScore - x.rScore || x.keyDate.localeCompare(y.keyDate))
    .slice(0, need);

  for (const item of pool) {
    item.suggestedBucket = "A";
    (item as T & { promoted?: boolean }).promoted = true;
  }
  return list;
}

/* ----------------------------- 展示辅助 ----------------------------- */

export function labels(c: Pick<EvaluatedCandidate, "grades" | "roles" | "category" | "region" | "keyDateType" | "fee">) {
  return {
    grades: c.grades.map((g) => GRADE_LABEL[g] ?? g).join("、"),
    roles: c.roles.map((r) => ROLE_LABEL[r] ?? r).join("、"),
    category: CATEGORY_LABEL[c.category] ?? c.category,
    region: c.region,
    keyDateType: KEYDATE_LABEL[c.keyDateType] ?? c.keyDateType,
    fee: c.fee,
  };
}

/* --------------------------- 发布前复查（关键） --------------------------- */

export interface RecheckableEvent {
  name: string;
  organizer: string;
  audienceRaw: string;
  signupMethod: string;
  location: string | null;
  notes: string | null;
  siblings: string; // JSON 字符串
  keyDate: string;
  sourceTier: number;
}

/**
 * 发布前复查。
 *
 * 导入时的门槛判定发生在导入那一天，但条目可能躺在草稿里好几天——
 * 「距截止 9 天」导入的条目，等到发布时可能已经过期。信源与话术同理（人工编辑过）。
 * 因此发布动作必须**按发布日重跑一次门槛**，而不是复用导入时的判定结果。
 *
 * 返回阻止发布的门槛码；空数组表示可发布。
 */
export function recheckPublishable(e: RecheckableEvent, today: string): string[] {
  const codes: string[] = [];

  if (e.keyDate && Number.isFinite(daysBetween(today, e.keyDate)) && daysBetween(today, e.keyDate) < 0) {
    codes.push("G3_EXPIRED");
  }
  if (e.sourceTier > MAX_SOURCE_TIER) codes.push("G4_LOW_CREDIBILITY");

  let siblingText = "";
  try {
    const sibs = JSON.parse(e.siblings || "[]");
    if (Array.isArray(sibs)) {
      siblingText = sibs
        .map((s) => [str(s?.name), str(s?.location), str(s?.signup_method), str(s?.notes)].join(" "))
        .join("\n");
    }
  } catch {
    /* 损坏的 siblings 不阻断发布，交由人工判断 */
  }

  const corpus = [e.name, e.organizer, e.audienceRaw, e.signupMethod, e.location, e.notes].map(str).join("\n");
  const blocking = scanText(`${corpus}\n${siblingText}`, BANNED_BLOCKING);
  if (blocking.length) codes.push(`G5_BANNED_PHRASE:${[...new Set(blocking)].join(",")}`);

  return codes;
}

/** 门槛码 → 中文说明，供后台展示 */
export function gateCodeLabel(code: string): string {
  const key = code.split(":")[0];
  return (
    {
      G0_FIELD_MISSING: "必填字段缺失",
      G0_BAD_DATE: "关键节点日期无法解析",
      G1_REGION_OUT: "地域不在武汉/湖北范围",
      G2_AUDIENCE_OUT: "参赛对象不是小初高学生或教师",
      G3_EXPIRED: "关键节点已过期",
      G4_LOW_CREDIBILITY: "信源层级不足（需官方或权威媒体来源）",
      G5_BANNED_PHRASE: "含组织报名或结果承诺类违规话术",
    }[key] ?? key
  );
}
