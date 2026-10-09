/**
 * 武汉教育赛事雷达 · 上传解析
 *
 * 契约：接受技能 `radar.py` 产出的 `edu-events-YYYY-MM-DD.json`
 * 顶层形状 `{ meta, items, excluded? }`，或等价的裸数组。
 *
 * 版本闸门：meta.schema_version 与本地契约主版本不一致时**直接拒绝**。
 * 没有这道闸门，技能侧一旦改字段，后台会静默把新字段丢弃、把缺字段降级为默认值，
 * 表现为「上传成功但内容不对」——比报错危险得多。
 */
import { createHash } from "node:crypto";
import { CANDIDATE_SCHEMA_VERSION, MIN_SCHEMA_VERSION_MAJOR } from "./contract";
import { parseDate, type RawCandidate as Raw } from "./gate";

export interface ParsedPayload {
  schemaVersion: string | null;
  versionWarning: string | null;
  runDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  meta: Record<string, unknown>;
  candidates: Raw[];
  /** 技能侧已被硬门槛剔除的条目，仅作展示，不参与入库评审 */
  rejected: Raw[];
  fileHash: string;
}

export type ParseResult = { ok: true; data: ParsedPayload } | { ok: false; error: string };

function asArray(v: unknown): Raw[] {
  return Array.isArray(v) ? (v as Raw[]) : [];
}

function majorOf(v: string): number {
  const m = String(v).match(/^(\d+)/);
  return m ? Number(m[1]) : NaN;
}

/**
 * 解析上传内容。
 * @param text 原始文本（文件内容或粘贴的 JSON）
 * @param fileName 仅用于展示与溯源
 */
export function parseCandidatePayload(text: string, fileName = ""): ParseResult {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { ok: false, error: "内容为空，请上传技能产出的 JSON 文件或直接粘贴 JSON 文本。" };
  if (trimmed.length > 8 * 1024 * 1024) return { ok: false, error: "文件超过 8MB，请确认是否上传了正确的 JSON。" };

  let doc: unknown;
  try {
    doc = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "解析失败";
    return { ok: false, error: `JSON 解析失败：${msg}` };
  }

  let meta: Record<string, unknown> = {};
  let candidates: Raw[] = [];
  let rejected: Raw[] = [];

  if (Array.isArray(doc)) {
    candidates = asArray(doc);
  } else if (doc && typeof doc === "object") {
    const obj = doc as Record<string, unknown>;
    meta = (obj.meta && typeof obj.meta === "object" ? obj.meta : {}) as Record<string, unknown>;
    candidates = asArray(obj.items);
    // 技能侧把被剔除条目写在 meta.excluded（旧版可能在顶层 excluded），两处都认
    const topLevel = asArray(obj.excluded);
    rejected = topLevel.length ? topLevel : asArray(meta.excluded);
  } else {
    return { ok: false, error: "无法识别的结构：应为 `{ meta, items }` 或条目数组。" };
  }

  if (candidates.length === 0) {
    return { ok: false, error: "未解析到任何条目（items 为空）。若本周确实无新增活动，属正常情况，无需上传。" };
  }

  // —— 版本闸门 ——
  const rawVersion = meta.schema_version ?? meta.schemaVersion;
  const schemaVersion = rawVersion ? String(rawVersion) : null;
  let versionWarning: string | null = null;
  if (schemaVersion) {
    const major = majorOf(schemaVersion);
    if (Number.isFinite(major) && major !== MIN_SCHEMA_VERSION_MAJOR) {
      return {
        ok: false,
        error: `契约主版本不匹配：文件为 ${schemaVersion}，后台支持 ${CANDIDATE_SCHEMA_VERSION}。请同步升级技能与后台，避免字段被静默丢弃。`,
      };
    }
  } else {
    versionWarning = `未声明 schema_version，按 ${CANDIDATE_SCHEMA_VERSION} 解析。建议在技能侧补上该字段。`;
  }

  const window = (meta.window && typeof meta.window === "object" ? meta.window : {}) as Record<string, unknown>;
  const runDate = parseDate(meta.run_date) ?? null;
  const windowStart = parseDate(window.start) ?? null;
  const windowEnd = parseDate(window.end) ?? null;

  const fileHash = createHash("sha1").update(trimmed, "utf8").digest("hex").slice(0, 16);

  return {
    ok: true,
    data: {
      schemaVersion,
      versionWarning,
      runDate,
      windowStart,
      windowEnd,
      meta,
      candidates,
      rejected,
      fileHash,
    },
  };
}

/** 组装期次展示标题：有窗口用窗口，否则退回运行日 */
export function editionTitle(runDate: string | null, windowStart: string | null, windowEnd: string | null): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}`;
  };
  if (windowStart && windowEnd) return `${fmt(windowStart)}—${fmt(windowEnd)} 期`;
  if (runDate) return `${runDate} 期`;
  return "未命名期次";
}

export type { Raw as RawCandidate };
