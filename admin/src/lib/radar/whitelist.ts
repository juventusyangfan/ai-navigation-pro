/**
 * 武汉教育赛事雷达 · 白名单判定（服务端复刻）
 *
 * 与技能 `radar.py` 的 `resolve_whitelist()` 同口径。**名单数据两侧必须一致**
 * （技能侧 `references/whitelist.json` ↔ 本文件 `WHITELIST_ENTRIES`）——
 * 不一致会出现「技能标注在名单内、后台重算说不在」的静默矛盾，
 * 而人工录入本就绕过了技能，只能靠服务端这份名单兜住。
 *
 * 定位：白名单状态**不是硬门槛，但参与打分**——判为 `confirmed` 时在可信度（C）
 * 维度上调 `WHITELIST_C_BONUS` 分（见 contract.ts），总分约 +0.5。理由是白名单
 * 的本质为「主办方经教育部审核」，属可信度证据，与 C 分（信源层级）同源；
 * 直接加总分则会破坏 R×0.40 + T×0.35 + C×0.25 的权重结构。
 * **只加不减**：`not_listed` 不扣分，否则会系统性把武汉本地赛事挤出主推区。
 *
 * 合规红线（违反即为事故）：
 *  - `not_listed` 严禁表述为「山寨赛 / 野鸡赛 / 黑名单 / 违规竞赛」。
 *    名单只约束**全国性竞赛**，地方性竞赛与区级选拔本就不在名单内且完全合法。
 *  - `confirmed` 不得延伸为「官方推荐 / 有助于升学」。名单原文明确禁止
 *    竞赛结果与招生入学、评优挂钩。
 */
import { normKey } from "./contract";

/* ------------------------------- 名单数据 ------------------------------- */

export interface WhitelistEntry {
  seq: number;
  group: string;
  name: string;
  organizer: string;
  grades: string;
}

export const WHITELIST_LIST = {
  id: "moe-national-contest-2025-2028",
  name: "2025—2028学年面向中小学生的全国性竞赛活动名单",
  issuer: "教育部办公厅",
  published: "2025-09-11",
  /** 有效期止。到期前须核对教育部是否已公布新一期名单（见技能 references/whitelist.md 第六节） */
  effectiveTo: "2028-08-31",
  total: 47,
} as const;

export const WHITELIST_LIST_TITLE = `教育部《${WHITELIST_LIST.name}》`;

/** 教育部 2025-09-11 公布，共 47 项：自然科学素养类 22 / 人文综合素养类 12 / 艺术体育类 13 */
export const WHITELIST_ENTRIES: WhitelistEntry[] = [
  { seq: 1, group: "自然科学素养类", name: "全国青少年人工智能创新挑战赛", organizer: "中国少年儿童发展服务中心", grades: "小学、初中、普通高中、中职" },
  { seq: 2, group: "自然科学素养类", name: "世界机器人大会青少年机器人设计与信息素养大赛", organizer: "中国电子学会", grades: "小学、初中、普通高中、中职" },
  { seq: 3, group: "自然科学素养类", name: "全国青少年无人机大赛", organizer: "中国航空学会", grades: "小学、初中、普通高中、中职" },
  { seq: 4, group: "自然科学素养类", name: "宋庆龄少年儿童发明奖", organizer: "中国宋庆龄基金会、中国发明协会", grades: "小学、初中、普通高中、中职" },
  { seq: 5, group: "自然科学素养类", name: "全国中学生天文知识竞赛", organizer: "中国天文学会", grades: "初中、普通高中、中职" },
  { seq: 6, group: "自然科学素养类", name: "“地球小博士”全国地理科普知识大赛活动", organizer: "中国地理学会", grades: "普通高中" },
  { seq: 7, group: "自然科学素养类", name: "全国中学生水科技发明比赛暨斯德哥尔摩青少年水奖中国区选拔赛", organizer: "生态环境部宣传教育中心、水利部宣传教育中心", grades: "小学、初中、普通高中" },
  { seq: 8, group: "自然科学素养类", name: "全国中学生地球科学奥林匹克竞赛", organizer: "中国地震学会、中国地球物理学会", grades: "普通高中" },
  { seq: 9, group: "自然科学素养类", name: "全国中学生数学奥林匹克竞赛", organizer: "中国数学会", grades: "普通高中" },
  { seq: 10, group: "自然科学素养类", name: "全国中学生物理奥林匹克竞赛", organizer: "中国物理学会", grades: "普通高中" },
  { seq: 11, group: "自然科学素养类", name: "全国中学生化学奥林匹克竞赛", organizer: "中国化学会", grades: "普通高中" },
  { seq: 12, group: "自然科学素养类", name: "全国中学生生物学奥林匹克竞赛", organizer: "中国植物学会、中国动物学会", grades: "普通高中" },
  { seq: 13, group: "自然科学素养类", name: "全国中学生信息学奥林匹克竞赛", organizer: "中国计算机学会", grades: "普通高中" },
  { seq: 14, group: "自然科学素养类", name: "全国青少年科技创新大赛", organizer: "中国科协", grades: "普通高中、中职" },
  { seq: 15, group: "自然科学素养类", name: "全国青少年航天创新大赛", organizer: "中国航天科技国际交流中心", grades: "小学、初中、普通高中、中职" },
  { seq: 16, group: "自然科学素养类", name: "丘成桐中学科学奖", organizer: "清华大学", grades: "普通高中" },
  { seq: 17, group: "自然科学素养类", name: "全球发明大会（中国）竞赛活动", organizer: "中国友好和平发展基金会", grades: "小学、初中、普通高中、中职" },
  { seq: 18, group: "自然科学素养类", name: "全国青少年人工智能大赛", organizer: "中国福利会、中国妇女发展基金会", grades: "小学、初中、普通高中、中职" },
  { seq: 19, group: "自然科学素养类", name: "全国青少年科学实验能力大赛", organizer: "中国教育装备行业协会", grades: "小学、初中、普通高中、中职" },
  { seq: 20, group: "自然科学素养类", name: "全国青少年科学探究建模能力大赛", organizer: "北京师范大学", grades: "小学、初中、普通高中、中职" },
  { seq: 21, group: "自然科学素养类", name: "全国青少年心理成长知识与应用创新大赛", organizer: "中国心理卫生协会", grades: "小学、初中、普通高中、中职" },
  { seq: 22, group: "自然科学素养类", name: "全国青少年安全与应急科普创新大赛", organizer: "中国灾害防御协会", grades: "小学、初中、普通高中、中职" },
  { seq: 23, group: "人文综合素养类", name: "全国青少年禁毒知识竞赛", organizer: "中国禁毒基金会", grades: "小学、初中、普通高中、中职" },
  { seq: 24, group: "人文综合素养类", name: "世界华人学生作文大赛", organizer: "中华全国归国华侨联合会、中华全国台湾同胞联谊会", grades: "普通高中" },
  { seq: 25, group: "人文综合素养类", name: "“外研社杯”全国中学生外语素养大赛", organizer: "北京外国语大学", grades: "普通高中、中职" },
  { seq: 26, group: "人文综合素养类", name: "高中生创新能力大赛", organizer: "中国老教授协会", grades: "普通高中" },
  { seq: 27, group: "人文综合素养类", name: "全国中学生环境保护优秀作文征集活动", organizer: "中华环保联合会", grades: "普通高中、中职" },
  { seq: 28, group: "人文综合素养类", name: "“美丽中国”全国版图知识竞赛（中小学组）", organizer: "自然资源部宣传教育中心", grades: "小学、初中、普通高中、中职" },
  { seq: 29, group: "人文综合素养类", name: "全国青少年劳动技能与智能设计大赛", organizer: "中国自动化学会", grades: "小学、初中、普通高中、中职" },
  { seq: 30, group: "人文综合素养类", name: "中华诗词美育大赛", organizer: "中华诗词学会", grades: "小学、初中、普通高中、中职" },
  { seq: 31, group: "人文综合素养类", name: "鲁迅青少年文学大赛", organizer: "鲁迅文化基金会", grades: "普通高中" },
  { seq: 32, group: "人文综合素养类", name: "全国青少年红色文化传承与实践创新大赛", organizer: "中国红色文化研究会", grades: "小学、初中、普通高中、中职" },
  { seq: 33, group: "人文综合素养类", name: "“讲好中国故事”全国中小学语言素养大赛", organizer: "中国教育电视协会", grades: "小学、初中、普通高中、中职" },
  { seq: 34, group: "人文综合素养类", name: "同颂中华·全国青少年志愿文学创作与诵读大赛", organizer: "中国青年报社", grades: "小学、初中、普通高中、中职" },
  { seq: 35, group: "艺术体育类", name: "全国中小学生绘画书法作品比赛", organizer: "中国儿童中心（全国妇联儿童事业发展集团）", grades: "小学、初中、普通高中、中职" },
  { seq: 36, group: "艺术体育类", name: "“我爱祖国海疆”全国青少年航海模型教育竞赛", organizer: "中国航海模型运动协会", grades: "小学、初中、普通高中、中职" },
  { seq: 37, group: "艺术体育类", name: "“驾驭未来”全国青少年车辆模型教育竞赛", organizer: "中国车辆模型运动协会", grades: "小学、初中、普通高中、中职" },
  { seq: 38, group: "艺术体育类", name: "全国青少年模拟飞行锦标赛", organizer: "国家体育总局航空无线电模型运动管理中心", grades: "小学、初中、普通高中、中职" },
  { seq: 39, group: "艺术体育类", name: "“飞向北京·飞向太空”全国青少年航空航天模型教育竞赛活动", organizer: "中国航空运动协会", grades: "小学、初中、普通高中、中职" },
  { seq: 40, group: "艺术体育类", name: "全国青少年传统体育项目比赛", organizer: "中国青少年宫协会", grades: "小学、初中、普通高中、中职" },
  { seq: 41, group: "艺术体育类", name: "“希望颂”——全国青少年书画艺术大展", organizer: "中国国际书画艺术研究会", grades: "小学、初中、普通高中、中职" },
  { seq: 42, group: "艺术体育类", name: "全国中小学生海洋文化创意设计大赛", organizer: "中国海洋发展基金会、中国海洋大学、自然资源部北海局", grades: "小学、初中、普通高中、中职" },
  { seq: 43, group: "艺术体育类", name: "全国青少年国防素养大赛", organizer: "南京理工大学", grades: "小学、初中、普通高中、中职" },
  { seq: 44, group: "艺术体育类", name: "“戏剧中国”全国青少年戏剧文化艺术大赛", organizer: "中国戏剧文学学会", grades: "小学、初中、普通高中、中职" },
  { seq: 45, group: "艺术体育类", name: "全国青少年人工智能辅助生成数字艺术创作者大赛", organizer: "文化和旅游部艺术发展中心", grades: "小学、初中、普通高中、中职" },
  { seq: 46, group: "艺术体育类", name: "学校美育助力行动——青少年视觉艺术传承与创新工作坊展示", organizer: "中国艺术教育促进会", grades: "小学、初中、普通高中、中职" },
  { seq: 47, group: "艺术体育类", name: "“常青藤”全国青少年校园戏剧创意大赛", organizer: "中央戏剧学院", grades: "小学、初中、普通高中、中职" },
];

/** 预计算归一化键，避免每次判定重复归一化 47 条 */
const INDEX = WHITELIST_ENTRIES.map((entry) => ({ entry, key: normKey(entry.name) }));

/** 短键不参与包含匹配，避免误命中（名单最短条目「丘成桐中学科学奖」归一化后 8 字） */
const MIN_MATCH_KEY_LEN = 6;
const MIN_ENTRY_KEY_LEN = 6;

/* ------------------------------- 判定 ------------------------------- */

export const WHITELIST_MATCH_LABEL: Record<string, string> = {
  exact: "名称一致",
  contains: "名称包含",
  hint_verified: "上游标注经名单核验",
};

// 竞赛词必须优先判定：名单判不出类型时，「…征文活动」「…作品征集活动」这类名称
// 既含竞赛动作、又含"活动"二字，若让"活动"先命中就会被误判为非竞赛。
//
// 用单字「赛」而非逐个枚举（大赛/锦标赛/挑战赛/选拔赛/联赛/邀请赛/擂台赛…）：
// 活动名里带"赛"字的基本都是竞赛，逐条列举必然漏词——实测漏判过「写作擂台赛」。
const COMPETITION_RE = /赛|奥林匹克|奥赛|征文|推评|评选|评奖|作品征集|征集活动|比拼/;
const NON_COMPETITION_RE =
  /讲座|讲坛|培训|研修|教研|展览|展出|展演|汇演|读书|阅读活动|研学|夏令营|冬令营|公益|志愿服务|开放日|体验日|课程|课堂|沙龙|论坛|座谈|观摩|活动/;

interface MatchHit {
  entry: WhitelistEntry;
  how: "exact" | "contains";
}

/**
 * 按名称匹配名单项。
 *
 * 两步：精确匹配 → **唯一**最长包含匹配。
 *
 * 「唯一」这个约束不能省：「全国青少年人工智能创新挑战赛」（第 1 项）与
 * 「全国青少年人工智能大赛」（第 18 项）是名单里两个不同竞赛。若允许多个
 * 同等长度的包含命中都算，就会张冠李戴。宁可判不出来，不可判错。
 */
export function matchWhitelistEntry(name: string): MatchHit | null {
  const key = normKey(name);
  if (!key) return null;

  for (const item of INDEX) {
    if (item.key && item.key === key) return { entry: item.entry, how: "exact" };
  }

  const hits = INDEX.filter((x) => x.key.length >= MIN_ENTRY_KEY_LEN && key.length >= MIN_MATCH_KEY_LEN && key.includes(x.key)).sort(
    (a, b) => b.key.length - a.key.length,
  );
  if (!hits.length) return null;
  if (hits.length > 1 && hits[0].key.length === hits[1].key.length) return null;
  return { entry: hits[0].entry, how: "contains" };
}

export type ActivityKind = "competition" | "non_competition" | "unknown";

/**
 * 推断活动是否竞赛类。
 *
 * 返回值带 `declared`：区分「上游显式声明」与「据名称推断」。
 * 这个区分要落库——只有显式声明才值得存下来，因为推断结果存回库后，
 * 下次读取就会被当成声明，判定依据从「据名称推断」变成「上游标注」，
 * 依据文本会自己漂移。
 */
export function inferActivityKind(raw: Record<string, unknown>): { kind: ActivityKind; declared: boolean } {
  const declaredType = String(raw.activity_type ?? "").trim().toLowerCase();
  if (["competition", "contest", "match", "race"].includes(declaredType)) {
    return { kind: "competition", declared: true };
  }
  if (["non_competition", "noncompetition", "activity", "lecture", "camp"].includes(declaredType)) {
    return { kind: "non_competition", declared: true };
  }

  const name = String(raw.name ?? "");
  if (COMPETITION_RE.test(name)) return { kind: "competition", declared: false };
  if (NON_COMPETITION_RE.test(name)) return { kind: "non_competition", declared: false };
  return { kind: "unknown", declared: false };
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/**
 * 判定白名单状态。
 *
 * 判定权收敛在「可核验的名单文本」上：无论自动匹配还是上游标注（whitelist_hint），
 * 最终都必须在名单里查到对应条目才给 confirmed，避免主观抬高。
 */
export function resolveWhitelist(raw: Record<string, unknown>): WhitelistVerdict {
  let hit = matchWhitelistEntry(str(raw.name));
  let how: string = hit?.how ?? "";

  if (!hit) {
    const hint = raw.whitelist_hint as Record<string, unknown> | undefined;
    const hintName = hint && typeof hint === "object" ? str(hint.matched) : "";
    if (hintName) {
      const hk = normKey(hintName);
      const found = INDEX.find((x) => x.key === hk);
      if (found) {
        hit = { entry: found.entry, how: "exact" };
        how = "hint_verified";
      }
    }
  }

  if (hit) {
    return {
      status: "confirmed",
      scope: "national",
      matchedName: hit.entry.name,
      matchedSeq: hit.entry.seq,
      group: hit.entry.group,
      basis: `${WHITELIST_LIST_TITLE}第 ${hit.entry.seq} 项（${WHITELIST_MATCH_LABEL[how] ?? how}）`,
      kind: "competition",
      declaredKind: "competition",
    };
  }

  const { kind, declared } = inferActivityKind(raw);
  const declaredKind: Exclude<ActivityKind, "unknown"> | null =
    declared && kind !== "unknown" ? (kind as Exclude<ActivityKind, "unknown">) : null;

  if (kind === "non_competition") {
    return {
      status: "not_applicable",
      scope: null,
      matchedName: null,
      matchedSeq: null,
      group: null,
      basis: "非竞赛类活动，竞赛名单制度不适用",
      kind,
      declaredKind,
    };
  }
  if (kind === "competition") {
    return {
      status: "not_listed",
      scope: null,
      matchedName: null,
      matchedSeq: null,
      group: null,
      basis: `${declared ? "上游标注" : "据名称推断"}为竞赛类，未命中现行全国竞赛名单（不代表活动本身有问题）`,
      kind,
      declaredKind,
    };
  }
  return {
    status: "unknown",
    scope: null,
    matchedName: null,
    matchedSeq: null,
    group: null,
    basis: "信息不足，未能判定活动类型",
    kind,
    declaredKind,
  };
}

export interface WhitelistVerdict {
  status: string;
  scope: string | null;
  matchedName: string | null;
  matchedSeq: number | null;
  group: string | null;
  basis: string;
  /** 判定得到的活动类型（含推断） */
  kind: ActivityKind;
  /** 仅当上游显式声明 activity_type 时非空——用于落库，避免推断结果被当成声明 */
  declaredKind: "competition" | "non_competition" | null;
}
