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
export const CANDIDATE_SCHEMA_VERSION = "1.0";

/** 兼容的最低版本（同主版本号即可） */
export const MIN_SCHEMA_VERSION_MAJOR = 1;

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
