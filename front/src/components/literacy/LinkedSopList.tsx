"use client";

import Link from "next/link";
import { Icon } from "@/lib/icons";
import { trackNow } from "@/lib/track";
import type { LitSopRef } from "@/lib/content";

// 学完立刻练：复用用法库 .pb-card 视觉，链接指向 /usages/{id}（站内，非工具页）。
// 点击即发 lit_sop_click（转化链路埋点）。空态复用 .empty，绝不留白。
export default function LinkedSopList({
  sops,
  title = "学完立刻练",
  anchorId = "practice",
  lessonSlug,
}: {
  sops: LitSopRef[];
  title?: string;
  anchorId?: string;
  lessonSlug?: string;
}) {
  if (!sops || sops.length === 0) {
    return (
      <section className="card" id={anchorId}>
        <h3>
          <span className="dot" />
          {title}
        </h3>
        <div className="empty">
          <div className="big">
            <Icon name="ListChecks" size={40} />
          </div>
          <p>
            这节课的配套 SOP 还在做。先去
            <Link href="/usages">用法库</Link>
            里挑一条练手，或者
            <Link href="/about">投稿</Link>
            你自己的做法。
          </p>
        </div>
      </section>
    );
  }

  const shown = sops.slice(0, 3);
  return (
    <section className="card" id={anchorId}>
      <h3>
        <span className="dot" />
        {title}
      </h3>
      <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 14 }}>
        上面是原理，下面是打开就能做的步骤。
      </p>
      <div className="pb-grid">
        {shown.map((s) => (
          <Link
            key={s.id}
            href={`/usages/${s.id}`}
            className="pb-card"
            onClick={() =>
              trackNow({
                name: "lit_sop_click",
                refType: "lesson",
                refId: lessonSlug ?? s.id,
                props: { sopId: s.id },
              })
            }
          >
            <div className="pb-top">
              <span className="pb-cat">{s.toolName}</span>
              {s.level ? <span className="tag">{s.level}</span> : null}
            </div>
            <h3>{s.title}</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              {s.reason ?? `用 ${s.toolName} 上手练`}
            </p>
            <div
              className="lit-row"
              style={{ borderBottom: "none", paddingBottom: 0, marginTop: "auto" }}
            >
              <span className="lit-k">步骤</span>
              <span>{s.steps} 步</span>
              {s.estMinutes ? (
                <span className="muted">· 约 {s.estMinutes} 分</span>
              ) : null}
              <Icon
                name="ArrowUpRight"
                size={12}
                className="inline muted"
                style={{ marginLeft: "auto" }}
              />
            </div>
          </Link>
        ))}
      </div>
      {sops.length > 3 && (
        <div
          className="lit-row"
          style={{ borderBottom: "none", paddingBottom: 0, marginTop: 14 }}
        >
          <Link href="/usages" className="link-more">
            查看全部 {sops.length} 条 SOP →
          </Link>
        </div>
      )}
    </section>
  );
}
