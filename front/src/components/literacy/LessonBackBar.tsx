"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/lib/icons";

// 回访条：用户点「去国家平台看这节课」时，OfficialCourseCta 写入
// localStorage['ea:lit:out:{moduleSlug}:{lessonSlug}'] = Date.now()。
// 本站标签页重新可见时，若距出站 > 90s 判定"真的去看了"，展开回访条。
// 24h 内同课只弹一次；点 × 写 dismiss，7 天内不再弹。
// localStorage 不可用时整个机制静默失效，页面其余部分不受影响。
const OUT_KEY = (m: string, l: string) => `ea:lit:out:${m}:${l}`;
const SHOWN_KEY = (l: string) => `ea:lit:backbar-shown:${l}`;
const DISMISS_KEY = (l: string) => `ea:lit:backbar-dismiss:${l}`;

const DAY = 24 * 60 * 60 * 1000;

function readNum(k: string): number | null {
  try {
    const v = localStorage.getItem(k);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function writeNum(k: string, v: number) {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* 隐私模式静默 */
  }
}

export default function LessonBackBar({
  moduleSlug,
  lessonSlug,
  lessonTitle,
  sopCount,
}: {
  moduleSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  sopCount: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      try {
        const out = readNum(OUT_KEY(moduleSlug, lessonSlug));
        if (!out) return;
        const diff = Date.now() - out;
        if (diff <= 90 * 1000) return; // 只是瞄了一眼，不打扰
        const shown = readNum(SHOWN_KEY(lessonSlug));
        if (shown && Date.now() - shown < DAY) return; // 24h 内只弹一次
        const dismissed = readNum(DISMISS_KEY(lessonSlug));
        if (dismissed && Date.now() - dismissed < 7 * DAY) return; // 7 天免打扰
        setShow(true);
        writeNum(SHOWN_KEY(lessonSlug), Date.now());
      } catch {
        /* 静默 */
      }
    };

    evaluate();
    const onVis = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [moduleSlug, lessonSlug]);

  if (!show) return null;

  const goPractice = () => {
    const el = document.getElementById("practice");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const close = () => {
    writeNum(DISMISS_KEY(lessonSlug), Date.now());
    setShow(false);
  };

  return (
    <div className="lit-back-bar" role="status" aria-live="polite">
      <div className="row">
        <Icon name="ArrowUUpLeft" size={16} className="ic" />
        <b>看完《{lessonTitle}》了？</b>
      </div>
      <div>
        下面这 {sopCount} 条 SOP 就是配套的动手练，趁热做一遍。
      </div>
      <div className="acts">
        <button type="button" className="go" onClick={goPractice}>
          跳到动手练 ↓
        </button>
        <button
          type="button"
          className="close"
          aria-label="关闭这条提示"
          onClick={close}
        >
          <Icon name="X" size={16} className="inline" />
        </button>
      </div>
    </div>
  );
}
