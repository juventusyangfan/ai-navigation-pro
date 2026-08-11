import type { LitSource, LitLinkStatus } from "../serialize";

export interface ValidationResult {
  ok: boolean;
  error?: string;
  fields?: string[];
}

const SOURCES: LitSource[] = ["official", "original", "ugc"];
const LINK_STATUSES: LitLinkStatus[] = ["unchecked", "ok", "warn", "broken"];
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * 模块发布校验。对传入对象做字段校验；status 非法也报错。
 * 用于 POST（全量）与 PATCH（调用方先合并已有值再校验）。
 */
export function validateLitModule(input: Record<string, unknown>): ValidationResult {
  const fields: string[] = [];
  if (!input?.slug || typeof input.slug !== "string" || !SLUG_RE.test(input.slug))
    fields.push("slug");
  if (!input?.title || typeof input.title !== "string") fields.push("title");
  if (!input?.num || typeof input.num !== "string") fields.push("num");
  if (!input?.summary || typeof input.summary !== "string") fields.push("summary");
  if (!input?.desc || typeof input.desc !== "string") fields.push("desc");
  if (input?.status && !["draft", "published"].includes(String(input.status)))
    fields.push("status");
  if (fields.length) return { ok: false, error: `字段校验失败：${fields.join(", ")}`, fields };
  return { ok: true };
}

/**
 * 课时校验。发布硬校验（架构红线）：
 * - source=official 且 status=published 时，officialUrl 与 fallbackUrl 必填
 *   （失效兜底必填，否则 L1 降级无落点）。
 * 其余字段缺失按创建场景报错；PATCH 时调用方先合并再校验。
 */
export function validateLitLesson(input: Record<string, unknown>): ValidationResult {
  const fields: string[] = [];
  if (!input?.slug || typeof input.slug !== "string" || !SLUG_RE.test(input.slug))
    fields.push("slug");
  if (!input?.title || typeof input.title !== "string") fields.push("title");
  if (!input?.hook || typeof input.hook !== "string") fields.push("hook");
  if (!input?.guideIntro || typeof input.guideIntro !== "string") fields.push("guideIntro");
  if (!input?.afterAction || typeof input.afterAction !== "string") fields.push("afterAction");
  if (input?.source && !SOURCES.includes(input.source as LitSource)) fields.push("source");
  if (input?.linkStatus && !LINK_STATUSES.includes(input.linkStatus as LitLinkStatus))
    fields.push("linkStatus");

  if (String(input?.status) === "published" && input?.source === "official") {
    if (!input?.officialUrl) fields.push("officialUrl");
    if (!input?.fallbackUrl) fields.push("fallbackUrl");
  }

  if (fields.length) return { ok: false, error: `字段校验失败：${fields.join(", ")}`, fields };
  return { ok: true };
}
