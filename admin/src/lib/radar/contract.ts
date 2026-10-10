/**
 * 武汉教育赛事雷达 · 契约层
 *
 * 与用户级技能 `wuhan-edu-event-radar`（references/schema.md）保持同口径。
 * 枚举改动必须两侧同步——否则导入时会被静默降级为默认值，表现为「数据莫名丢失」。
 *
 * 合规基线：本文件定义的 BANNED_* 词表是**发布前强制扫描**的依据，
 * 面向服务号的外发内容不得出现组织报名、结果承诺类话术。
 */

/** 技能产出 JSON 的契约版本。不匹配时导入直接拒绝，避免静默错解。 */
export const CANDIDATE_SCHEMA_VERSION = "1.2";

/** 兼容的最低版本（同主版本号即可） */
export const MIN_SCHEMA_VERSION_MAJOR = 1;

/* ----------------------------- 基础工具 ----------------------------- */

/**
 * 归一化活动名（跨来源去重的键，也是白名单匹配的键）。
 * 等价于 radar.py 的 norm_key——三处（技能、gate、whitelist）必须同口径。
 *
 * 放在契约层而非 gate.ts：whitelist.ts 也要用它匹配名单，
 * 若各自实现一份，将来改规则必然漏改一处。
 */
export function normKey(name: string): string {
  let s = String(name ?? "")
    .normalize("NFKC")
    .toLowerCase();
  s = s.replace(/[\s\-—_·、，,。.：:；;（）()【】[\]《》<>"'“”‘’/\\|]+/g, "");
  s = s.replace(/(20\d{2})-?(20\d{2})?/g, "");
  s = s.replace(/第[一二三四五六七八九十\d]+届/g, "");
  return s;
}

/* ------------------------------- 枚举 ------------------------------- */

export const GRADES = ["primary", "junior", "senior"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_LABEL: Record<string, string> = {
  primary: "小学",
  junior: "初中",
  senior: "高中",
};

export const ROLES = ["student", "teacher"] as const;
export type RadarRole = (typeof ROLES)[number];
export const ROLE_LABEL: Record<string, string> = {
  student: "学生",
  teacher: "教师",
};

export const CATEGORIES = ["english", "stem", "reading", "arts", "sports", "general"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<string, string> = {
  english: "英语听说",
  stem: "科创/AI",
  reading: "阅读写作",
  arts: "艺术美育",
  sports: "体育",
  general: "综合",
};
/** 相关性基准分（R）：英语听说为业务主轴，科创其次 */
export const CATEGORY_SCORE: Record<string, number> = {
  english: 5,
  stem: 4,
  reading: 3,
  arts: 2,
  sports: 2,
  general: 1,
};

export const REGIONS = ["wuhan", "hubei", "district"] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABEL: Record<string, string> = {
  wuhan: "武汉市",
  hubei: "湖北省",
  district: "武汉市区级",
};

export const KEY_DATE_TYPES = [
  "signup_start",
  "signup_deadline",
  "event_start",
  "event_end",
  "event_result",
] as const;
export type KeyDateType = (typeof KEY_DATE_TYPES)[number];
export const KEYDATE_LABEL: Record<string, string> = {
  signup_start: "报名开始",
  signup_deadline: "报名截止",
  event_start: "活动开始",
  event_end: "活动结束",
  event_result: "结果公布",
};

export const FEES = ["free", "paid", "unknown"] as const;
export const FEE_LABEL: Record<string, string> = {
  free: "公益免费",
  paid: "需自行承担费用",
  unknown: "费用待确认",
};

export const BUCKETS = ["A", "B", "C"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const BUCKET_LABEL: Record<string, string> = {
  A: "主推",
  B: "备选",
  C: "简讯",
};

/** 信源层级上限：>3 的一律不得进入发布态 */
export const MAX_SOURCE_TIER = 3;

/* --------------------------- 白名单状态枚举 --------------------------- */

/**
 * 白名单判定四态。判定规则与合规红线见 `whitelist.ts`。
 * 这不是门槛——判为哪一态都不影响能否发布（不参与 G 层校验）。
 * 但**参与打分**：判为 confirmed 时在可信度（C）维度上调 WHITELIST_C_BONUS 分。
 */
export const WHITELIST_STATUSES = ["confirmed", "not_listed", "not_applicable", "unknown"] as const;
export type WhitelistStatus = (typeof WHITELIST_STATUSES)[number];
export const WHITELIST_STATUS_LABEL: Record<string, string> = {
  confirmed: "在现行全国竞赛名单内",
  not_listed: "非名单内竞赛",
  not_applicable: "非竞赛类活动（名单制度不适用）",
  unknown: "未判定",
};
/**
 * 前台只对这两种状态显示标记。
 * 非竞赛类活动本就不受竞赛名单约束、未判定则无信息量——标出来只会制造噪音，
 * 还会让读者误以为「没标的都有问题」。
 */
export const WHITELIST_VISIBLE_STATUSES = ["confirmed", "not_listed"] as const;

/**
 * 白名单加分：仅在可信度（C）维度上调，C 分上限 5.0。
 *
 * 落点刻意不选「总分另加一项」：白名单的本质是主办方经教育部审核，属可信度
 * 证据，与 C 分（信源层级）同源；直接加总分等于人为下移 4.0/3.0 分档线，
 * 会破坏 R×0.40 + T×0.35 + C×0.25 的权重结构。
 *
 * **只加不减**：判为 not_listed 不扣分——名单只约束全国性竞赛，武汉本地
 * 赛事与区级选拔不在名单内但完全合法，扣分会系统性把它们挤出主推区。
 *
 * ⚠️ 与 `radar.py` 的 `WHITELIST_C_BONUS` 必须一致，改动两侧同步。
 */
export const WHITELIST_C_BONUS = 2.0;

/** 主推区保底条数与保底分 */
export const PROMOTE_MIN_COUNT = 2;
export const PROMOTE_FLOOR = 3.0;

/** 技能侧要求必须取全的字段 */
export const REQUIRED_FIELDS = [
  "name",
  "organizer",
  "audience_raw",
  "grades",
  "roles",
  "category",
  "region",
  "key_date",
  "key_date_type",
  "fee",
  "signup_method",
  "source_url",
  "source_name",
  "source_tier",
] as const;

/* --------------------------- 话术红线词表 --------------------------- */

/**
 * 阻断级词表：命中即判定为不可发布。
 * 这些表述暗示本平台在组织报名或承诺结果，直接违反教育部《面向中小学生的
 * 全国性竞赛活动管理办法》与平台自律红线。
 */
export const BANNED_BLOCKING: { pattern: RegExp; label: string }[] = [
  { pattern: /代报名|代办报名|代为报名/, label: "代报名" },
  { pattern: /代收作品|代收材料|代交作品|代传作品|代为提交/, label: "代收/代传作品" },
  { pattern: /集体报名|统一报名|组织报名|组团报名/, label: "组织集体报名" },
  { pattern: /包过|保过|包获奖|保获奖|确保获奖|保证获奖|必获奖/, label: "承诺获奖" },
  { pattern: /包录|保录|内定名额|内部名额|包进|保进/, label: "承诺录取/内部名额" },
  { pattern: /付费保|收费包|交钱即可|花钱即可/, label: "付费承诺" },
  { pattern: /赛事培训|赛前集训|冲刺班|保奖班/, label: "赛事培训" },
];

/**
 * 警示级词表：不阻断，但在预览与编辑界面高亮提示人工复核。
 * 出现在活动自身描述中（例如「结果不作为升学依据」）是正常的，
 * 因此不做硬拦截，只提示。
 */
export const BANNED_WARNING: { pattern: RegExp; label: string }[] = [
  { pattern: /加分|降分|破格/, label: "与分数关联" },
  { pattern: /升学|择校|录取优惠/, label: "与升学关联" },
  { pattern: /评优|三好学生|推优/, label: "与评优关联" },
  { pattern: /官方推荐|教育局推荐|学校推荐/, label: "推荐性表述" },
];

/** 扫描一段文本，返回命中的词条标签 */
export function scanText(text: string, table: { pattern: RegExp; label: string }[]): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const t of table) {
    if (t.pattern.test(text)) hits.push(t.label);
  }
  return hits;
}

/** 待扫描的可控文本字段（不含系统生成的 compliance_note） */
export const SCAN_FIELDS = [
  "name",
  "audience_raw",
  "signup_method",
  "notes",
  "location",
  "organizer",
] as const;
