"use client";

import Link from "next/link";
import { Icon } from "@/lib/icons";
import { trackNow } from "@/lib/track";
import type { LitLinkStatus } from "@/lib/content";

function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

// 外链按钮 + 四级降级。外链坏了页面不能跟着废：broken 时不渲染主按钮，
// 只给导学正文与关联 SOP（它们由页面其余部分渲染）。
export default function OfficialCourseCta({
  officialUrl,
  linkStatus,
  fallbackUrl,
  archiveNote,
  provider,
  moduleSlug,
  lessonSlug,
}: {
  officialUrl?: string;
  linkStatus: LitLinkStatus;
  fallbackUrl?: string;
  archiveNote?: string;
  provider?: string;
  moduleSlug: string;
  lessonSlug: string;
}) {
  function markOut() {
    try {
      localStorage.setItem(
        `ea:lit:out:${moduleSlug}:${lessonSlug}`,
        String(Date.now()),
      );
    } catch {
      /* 隐私模式静默 */
    }
  }

  // broken：隐藏主按钮，只给兜底入口
  if (linkStatus === "broken") {
    return (
      <div className="lit-fallback">
        <Icon name="WarningCircle" size={16} className="ic" />
        <div>
          这节课的官方直达链接暂时失效{archiveNote ? `（${archiveNote}）` : ""}。
          你可以先看下面的导学要点，再自行到《学AI》栏目查找。
          {fallbackUrl && (
            <div className="btns">
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-primary"
                onClick={() =>
                  trackNow({
                    name: "lit_fallback_click",
                    refType: "lesson",
                    refId: lessonSlug,
                  })
                }
              >
                去平台首页找这节课 <Icon name="ArrowSquareOut" size={12} className="inline" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  const host = hostOf(officialUrl);

  return (
    <div className="lit-official-cta">
      <a
        href={officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        onClick={() => {
          markOut();
          trackNow({
            name: "lit_official_click",
            refType: "lesson",
            refId: lessonSlug,
            props: { linkStatus },
          });
        }}
      >
        去国家平台看这节课
        <Icon name="ArrowSquareOut" size={14} className="inline" aria-hidden="true" />
        <span className="sr-only">（在新页面打开，前往 {host ?? provider ?? "国家平台"}）</span>
      </a>
      <span className="domain">
        免费 · 需在平台注册登录{host ? ` · ${host}` : ""}
      </span>
      {linkStatus === "warn" && (
        <span className="muted" style={{ fontSize: 12 }}>
          官方页面近期有调整，若打不开请从
          {fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
              平台首页
            </a>
          ) : (
            "平台首页"
          )}
          进入《学AI》栏目查找。
        </span>
      )}
      {!officialUrl && (
        <Link href="/literacy" className="muted" style={{ fontSize: 12 }}>
          官方课地址待录入
        </Link>
      )}
    </div>
  );
}
