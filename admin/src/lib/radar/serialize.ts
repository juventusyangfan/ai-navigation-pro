/**
 * 武汉教育赛事雷达 · 序列化
 *
 * 两个方向：
 *  1) toDbData()  —— EvaluatedCandidate → Prisma 写入形状（JSON 数组字段统一 stringify）
 *  2) toApiItem() —— Prisma 行 → 前台/后台展示形状（JSON 字段解析回数组）
 *
 * 后台与前台共用同一套输出，避免两处各自拼装导致字段口径漂移。
 */
import type { RadarEvent, RadarEdition } from "@prisma/client";
import {
  BUCKET_LABEL,
  CATEGORY_LABEL,
  FEE_LABEL,
  GRADE_LABEL,
  KEYDATE_LABEL,
  REGION_LABEL,
  ROLE_LABEL,
  WHITELIST_STATUS_LABEL,
  WHITELIST_VISIBLE_STATUSES,
} from "./contract";
import { WHITELIST_ENTRIES } from "./whitelist";
import { daysBetween, todayIso, type EvaluatedCandidate, type SiblingRef } from "./gate";

const arr = <T>(s: string | null | undefined): T[] => {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

/** EvaluatedCandidate → 可直接写入 Prisma 的字段集 */
export function toDbData(c: EvaluatedCandidate, editionId: string, sortOrder: number) {
  return {
    editionId,
    externalId: c.externalId,
    source: "radar" as const,

    name: c.name,
    organizer: c.organizer,
    coOrganizer: c.coOrganizer,
    audienceRaw: c.audienceRaw,
    grades: JSON.stringify(c.grades),
    roles: JSON.stringify(c.roles),
    category: c.category,
    region: c.region,
    keyDate: c.keyDate,
    keyDateType: c.keyDateType,
    timeRange: c.timeRange,
    location: c.location,
    fee: c.fee,
    signupMethod: c.signupMethod,
    sourceUrl: c.sourceUrl,
    sourceName: c.sourceName,
    sourceTier: c.sourceTier,
    notes: c.notes,
    siblings: JSON.stringify(c.siblings),

    suggestedBucket: c.suggestedBucket,
    rScore: c.rScore,
    tScore: c.tScore,
    cScore: c.cScore,
    suggestedTotal: c.suggestedTotal,
    bucket: c.suggestedBucket,
    totalScore: c.suggestedTotal,
    promoted: c.promoted,

    gatePassed: c.gatePassed,
    gateCodes: JSON.stringify(c.gateCodes),
    complianceNote: c.complianceNote,

    // 白名单判定随条目落库：前台要展示、后台可复核，且被判错的记录要能回看
    activityType: c.whitelist.declaredKind,
    whitelistStatus: c.whitelist.status,
    whitelistScope: c.whitelist.scope,
    whitelistMatched: c.whitelist.matchedName,
    whitelistSeq: c.whitelist.matchedSeq,
    whitelistBasis: c.whitelist.basis,

    // 被门槛拦截的条目落 blocked，确保「拦了什么」可回溯
    status: c.gatePassed ? ("draft" as const) : ("blocked" as const),
    sortOrder,
  };
}

/* ------------------------------- 白名单 ------------------------------- */

export interface ApiWhitelist {
  status: string;
  statusLabel: string;
  scope?: string;
  /** 命中的名单条目全称 */
  matchedName?: string;
  /** 名单序号 */
  matchedSeq?: number;
  /** 名单分组（由序号反查，未落库） */
  group?: string;
  /** 判定依据，可核验 */
  basis: string;
  /** 人工改过判定 */
  manual: boolean;
  /** 是否建议前台显示标记 */
  visible: boolean;
}

/** Prisma 行 → 白名单展示形状。后台与前台共用，避免两处口径漂移。 */
export function toApiWhitelist(e: RadarEvent): ApiWhitelist {
  const status = e.whitelistStatus || "unknown";
  const group = e.whitelistSeq != null ? WHITELIST_ENTRIES.find((x) => x.seq === e.whitelistSeq)?.group : undefined;
  return {
    status,
    statusLabel: WHITELIST_STATUS_LABEL[status] ?? status,
    scope: e.whitelistScope ?? undefined,
    matchedName: e.whitelistMatched ?? undefined,
    matchedSeq: e.whitelistSeq ?? undefined,
    group,
    basis: e.whitelistBasis ?? "",
    manual: e.whitelistManual,
    visible: (WHITELIST_VISIBLE_STATUSES as readonly string[]).includes(status),
  };
}

export interface ApiSibling {
  name: string;
  location?: string;
  signupMethod?: string;
  notes?: string;
}

export interface RadarEventApi {
  id: string;
  externalId: string | null;
  source: string;
  editionId: string | null;

  name: string;
  organizer: string;
  coOrganizer?: string;
  audienceRaw: string;
  grades: string[];
  roles: string[];
  gradeLabel: string;
  roleLabel: string;
  category: string;
  categoryLabel: string;
  region: string;
  regionLabel: string;
  keyDate: string;
  keyDateType: string;
  keyDateTypeLabel: string;
  daysToKeyDate: number;
  timeRange?: string;
  location?: string;
  fee: string;
  feeLabel: string;
  signupMethod: string;
  sourceUrl: string;
  sourceName: string;
  sourceTier: number;
  notes?: string;
  siblings: ApiSibling[];
  complianceNote: string;
  whitelist: ApiWhitelist;

  bucket: string;
  bucketLabel: string;
  totalScore: number;
  rScore: number;
  tScore: number;
  cScore: number;
  promoted: boolean;
  scoreOverridden: boolean;
  suggestedBucket: string;

  gatePassed: boolean;
  gateCodes: string[];
  status: string;
  archiveReason?: string;
  updatedAt: string;
}

/** Prisma 行 → 展示形状。today 用于现算倒计时（相对值不落库，避免陈旧）。 */
export function toApiItem(e: RadarEvent, today = todayIso()): RadarEventApi {
  const grades = arr<string>(e.grades);
  const roles = arr<string>(e.roles);
  return {
    id: e.id,
    externalId: e.externalId,
    source: e.source,
    editionId: e.editionId,

    name: e.name,
    organizer: e.organizer,
    coOrganizer: e.coOrganizer ?? undefined,
    audienceRaw: e.audienceRaw,
    grades,
    roles,
    gradeLabel: grades.map((g) => GRADE_LABEL[g] ?? g).join("、"),
    roleLabel: roles.map((r) => ROLE_LABEL[r] ?? r).join("、"),
    category: e.category,
    categoryLabel: CATEGORY_LABEL[e.category] ?? e.category,
    region: e.region,
    regionLabel: REGION_LABEL[e.region] ?? e.region,
    keyDate: e.keyDate,
    keyDateType: e.keyDateType,
    keyDateTypeLabel: KEYDATE_LABEL[e.keyDateType] ?? e.keyDateType,
    daysToKeyDate: e.keyDate ? daysBetween(today, e.keyDate) : NaN,
    timeRange: e.timeRange ?? undefined,
    location: e.location ?? undefined,
    fee: e.fee,
    feeLabel: FEE_LABEL[e.fee] ?? e.fee,
    signupMethod: e.signupMethod,
    sourceUrl: e.sourceUrl,
    sourceName: e.sourceName,
    sourceTier: e.sourceTier,
    notes: e.notes ?? undefined,
    siblings: arr<SiblingRef>(e.siblings),
    complianceNote: e.complianceNote,
    whitelist: toApiWhitelist(e),

    bucket: e.bucket,
    bucketLabel: BUCKET_LABEL[e.bucket] ?? e.bucket,
    totalScore: e.totalScore,
    rScore: e.rScore,
    tScore: e.tScore,
    cScore: e.cScore,
    promoted: e.promoted,
    scoreOverridden: e.scoreOverridden,
    suggestedBucket: e.suggestedBucket,

    gatePassed: e.gatePassed,
    gateCodes: arr<string>(e.gateCodes),
    status: e.status,
    archiveReason: e.archiveReason ?? undefined,
    updatedAt: e.updatedAt.toISOString(),
  };
}

export interface RadarEditionApi {
  id: string;
  runDate: string;
  windowStart: string;
  windowEnd: string;
  title: string;
  status: string;
  fileName?: string;
  fileHash?: string;
  schemaVersion?: string;
  totalCount: number;
  acceptedCount: number;
  blockedCount: number;
  counts: { A: number; B: number; C: number; blocked: number; archived: number };
  publishedAt?: string;
  note?: string;
  createdAt: string;
}

export function toApiEdition(
  e: RadarEdition & { events?: Pick<RadarEvent, "bucket" | "status">[] },
): RadarEditionApi {
  const events = e.events ?? [];
  return {
    id: e.id,
    runDate: e.runDate,
    windowStart: e.windowStart,
    windowEnd: e.windowEnd,
    title: e.title,
    status: e.status,
    fileName: e.fileName ?? undefined,
    fileHash: e.fileHash ?? undefined,
    schemaVersion: e.schemaVersion ?? undefined,
    totalCount: e.totalCount,
    acceptedCount: e.acceptedCount,
    blockedCount: e.blockedCount,
    counts: {
      A: events.filter((x) => x.status === "published" && x.bucket === "A").length,
      B: events.filter((x) => x.status === "published" && x.bucket === "B").length,
      C: events.filter((x) => x.status === "published" && x.bucket === "C").length,
      blocked: events.filter((x) => x.status === "blocked").length,
      archived: events.filter((x) => x.status === "archived").length,
    },
    publishedAt: e.publishedAt?.toISOString(),
    note: e.note ?? undefined,
    createdAt: e.createdAt.toISOString(),
  };
}

/* --------------------------- 对外（公众）输出 --------------------------- */

export interface PublicRadarItem {
  name: string;
  organizer: string;
  coOrganizer?: string;
  audienceRaw: string;
  gradeLabel: string;
  roleLabel: string;
  categoryLabel: string;
  regionLabel: string;
  keyDate: string;
  keyDateTypeLabel: string;
  daysToKeyDate: number;
  timeRange?: string;
  location?: string;
  feeLabel: string;
  signupMethod: string;
  sourceName: string;
  sourceUrl: string;
  notes?: string;
  siblings: ApiSibling[];
  complianceNote: string;
  whitelist: ApiWhitelist;
  bucket: string;
}

/**
 * 公众可见字段。
 * 刻意剔除：内部分数（R/T/C）、门槛码、状态机字段、externalId。
 * 这些是运营侧信息，外露既无意义，也容易被误读为「本平台对活动做了评级」。
 */
export function toPublicItem(e: RadarEvent, today = todayIso()): PublicRadarItem {
  const grades = arr<string>(e.grades);
  const roles = arr<string>(e.roles);
  return {
    name: e.name,
    organizer: e.organizer,
    coOrganizer: e.coOrganizer ?? undefined,
    audienceRaw: e.audienceRaw,
    gradeLabel: grades.map((g) => GRADE_LABEL[g] ?? g).join("、"),
    roleLabel: roles.map((r) => ROLE_LABEL[r] ?? r).join("、"),
    categoryLabel: CATEGORY_LABEL[e.category] ?? e.category,
    regionLabel: REGION_LABEL[e.region] ?? e.region,
    keyDate: e.keyDate,
    keyDateTypeLabel: KEYDATE_LABEL[e.keyDateType] ?? e.keyDateType,
    daysToKeyDate: e.keyDate ? daysBetween(today, e.keyDate) : NaN,
    timeRange: e.timeRange ?? undefined,
    location: e.location ?? undefined,
    feeLabel: FEE_LABEL[e.fee] ?? e.fee,
    signupMethod: e.signupMethod,
    sourceName: e.sourceName,
    sourceUrl: e.sourceUrl,
    notes: e.notes ?? undefined,
    siblings: arr<SiblingRef>(e.siblings),
    complianceNote: e.complianceNote,
    whitelist: toApiWhitelist(e),
    bucket: e.bucket,
  };
}
