// 教AI导航 · 采集中心 · 契约与枚举
// -----------------------------------------------------------------------------
// 已知枚举（与 front/src/lib/data.ts 的 SCENES / ROLES 保持同步）。
// 这里硬编码而非跨项目 import，是为了不让 Next 构建引用 admin 目录外的文件。
// 若 front 的枚举有变动，需同步本文件。
export const KNOWN_SCENE_KEYS = [
  "beikeguihua",
  "kejian",
  "zuoye",
  "xueqing",
  "jiaxiao",
  "zixue",
  "keti",
  "shijian",
] as const;

export const KNOWN_ROLES = ["老师", "学生", "家长", "学校管理员"] as const;

export const SCENE_LABEL: Record<string, string> = {
  beikeguihua: "备课规划",
  kejian: "课件制作",
  zuoye: "作业考试",
  xueqing: "学情评价",
  jiaxiao: "家校班级",
  zixue: "自学答疑",
  keti: "教研课题",
  shijian: "综合实践",
};

export const PRICING_VALUES = ["Free", "Freemium", "Paid", "Enterprise"] as const;
export type Pricing = (typeof PRICING_VALUES)[number];

export type CollectProposal = {
  slug: string;
  name: string;
  url: string;
  tagline: string;
  pricing: Pricing;
  platform: string;
  roles: string[];
  scenes: string[];
  subjects: string[];
  pros: string[];
  cons: string[];
  alts: string[];
  compliance: string;
  logo: string; // 占位：取名称前 1-2 字
  color: string; // 占位：默认品牌蓝
  rating: number; // 0 未评
  urlVerified: boolean;
};

/** 只保留命中已知 scene key 的项；空集直接丢弃（分类纪律） */
export function normalizeScenes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v === "string" && (KNOWN_SCENE_KEYS as readonly string[]).includes(v)) {
      out.add(v);
    }
  }
  return [...out];
}

/** 只保留命中已知 role 的项 */
export function normalizeRoles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v === "string" && (KNOWN_ROLES as readonly string[]).includes(v)) {
      out.add(v);
    }
  }
  return [...out];
}

/** slug 必须是纯 ascii 小写字母/数字/连字符，供确认入库时校验 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}
