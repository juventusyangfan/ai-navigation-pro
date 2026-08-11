// 智用笔记 · 采集中心 · 契约与枚举
// -----------------------------------------------------------------------------
// 已知枚举（与 prisma/seed-data.ts 的 SCENES / ROLES 保持同步）。
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

export type CollectMedia = { type: "image" | "video" | "file"; label: string };
export type CollectBranch = { when: string; then: string };

export type CollectStepProposal = {
  goal?: string;
  action: string;
  prompt: string;
  outputSample: string;
  media?: CollectMedia | null;
  pitfall?: string;
  tip?: string;
  branch?: CollectBranch[];
};

export type CollectPathProposal = {
  title: string;
  summary?: string;
  estMinutes?: number;
  level?: string; // 入门|进阶|熟练
  forRole?: string; // Role
  steps: CollectStepProposal[];
};

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
  logo: string; // 公司 logo URL（favicon / og:image），空串待补
  color: string; // 占位：默认品牌蓝
  rating: number; // 0 未评
  urlVerified: boolean;
  urlWarning?: string; // 校验未通过时的提示（品牌词不匹配 / 不可达）
  paths: CollectPathProposal[]; // LLM 生成的 SOP 使用路径
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

// -----------------------------------------------------------------------------
// 已知品牌白名单：纠正 LLM 编造的 URL / slug，防止同一工具重复入库或地址错误。
// key 为产品中文名（含常见别名），value 为已核实的官方 URL 与规范 slug。
// 维护：发现新的常见 K12 产品时在此追加即可。
export const KNOWN_BRANDS: Record<string, { url: string; slug: string }> = {
  班级优化大师: { url: "https://care.seewo.com", slug: "banjiyouhua" },
  火花思维: { url: "https://www.huohua.cn", slug: "huohua" },
  掌门一对一: { url: "http://www.zhangmen.com", slug: "zhangmen" },
  掌门1对1: { url: "http://www.zhangmen.com", slug: "zhangmen" },
  光速写作: { url: "https://guangsuxie.com", slug: "guangsuxie" },
  阿尔法蛋: { url: "https://www.toycloud.com", slug: "alfa" },
  读书郎: { url: "https://www.readboy.com", slug: "readboy" },
  优学派: { url: "https://www.youxuepai.com", slug: "youxuepai" },
  家长帮: { url: "http://www.jzb.com", slug: "jiazhangbang" },
  校宝在线: { url: "https://www.xiaobaoonline.com", slug: "xiaobao" },
  斑马AI课: { url: "https://banmaaike.com", slug: "banma" },
  小盒科技: { url: "https://hixiaohe.cn", slug: "xiaoxiang" },
  松鼠AI: { url: "https://www.songshuai.com", slug: "songshuai" },
  洋葱学园: { url: "https://yangcongxueyuan.com", slug: "yangcong" },
  新东方在线: { url: "https://www.koolearn.com", slug: "koolearn" },
  题拍拍: { url: "https://tipaipai.com", slug: "tipaipai" },
  快对: { url: "https://www.kuaiduizuoye.com", slug: "kuaidui" },
  学而思网校: { url: "https://www.xueersi.com", slug: "xueersi" },
  学而思: { url: "https://www.xueersi.com", slug: "xueersi" },
  作业帮: { url: "https://www.zuoyebang.com", slug: "zuoyebang" },
  猿辅导: { url: "https://www.yuanfudao.com", slug: "yuanfudao" },
  高途: { url: "https://www.gaotu.cn", slug: "gaotu" },
  网易有道: { url: "https://www.youdao.com", slug: "youdao" },
  讯飞AI学习机: { url: "https://www.iflytek.com", slug: "iflytek" },
  希沃白板: { url: "https://easinote.seewo.com", slug: "seewoban" },
  瓜瓜龙: { url: "https://www.ggl.cn", slug: "guagualong" },
  洪恩: { url: "https://www.ihuman.com", slug: "ihuman" },
  编程猫: { url: "https://www.codemao.cn", slug: "codemao" },
  核桃编程: { url: "https://www.hetao101.com", slug: "hetao" },
  小猿口算: { url: "https://www.xiaoyuankousuan.com", slug: "xiaoyuankousuan" },
  凯叔讲故事: { url: "https://www.kaishustory.com", slug: "kaishu" },
  少年得到: { url: "https://www.igetcool.com", slug: "shaonian" },
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 取 URL 的注册域主机名（去 www.），失败返回空串 */
export function normalizeHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 名称归一化：去空格 + 小写，用于同名去重 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/** 由 URL 主机名推导规范 slug（取二级域名，如 yangcongxueyuan.com → yangcongxueyuan） */
export function canonicalSlugFromUrl(url: string): string {
  const host = normalizeHost(url);
  if (!host) return "";
  const parts = host.split(".");
  const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return slugify(sld);
}

/**
 * 命中已知品牌则强制使用官方 URL + 规范 slug（杜绝编造/错地址）；
 * 未命中则从 URL 推导规范 slug，让同一工具每次采集得到相同 slug（避免换 slug 重复入库）。
 */
export function applyKnownBrand(name: string, url: string): { url: string; slug: string; matched: boolean } {
  const n = name.trim();
  for (const key of Object.keys(KNOWN_BRANDS)) {
    if (n === key || n.includes(key) || key.includes(n)) {
      const b = KNOWN_BRANDS[key];
      return { url: b.url, slug: b.slug, matched: true };
    }
  }
  return { url, slug: canonicalSlugFromUrl(url) || slugify(n), matched: false };
}

