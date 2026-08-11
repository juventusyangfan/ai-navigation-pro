// 匿名行为埋点缝（与取数缝 content/ 平级：content 是读，track 是写）。
// 只存 anonId + 截断 UA，不存 IP / referer 全文 / 提示词正文；不接第三方 SDK。
"use client";

const AID_KEY = "eanavi_aid";

export interface TrackEvent {
  name: string;
  refType: string;
  refId: string;
  props?: Record<string, unknown>;
}

function getAid(): string {
  try {
    let v = localStorage.getItem(AID_KEY);
    if (!v) {
      v = (crypto.randomUUID?.() ?? `a_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(AID_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

function apiBase(): string {
  const b = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return b.replace(/\/+$/, "");
}

let queue: TrackEvent[] = [];

function send(events: TrackEvent[]): void {
  if (events.length === 0) return;
  try {
    const payload = JSON.stringify({ anonId: getAid(), events: events.slice(0, 20) });
    const url = `${apiBase()}/api/events`;
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // 埋点永远不能是故障源：静默吞掉
  }
}

/** 入队，不立即发（普通浏览/复制事件） */
export function track(e: TrackEvent): void {
  queue.push(e);
}

/** 立即发送（外链点击专用，须保证在页面跳走前投递） */
export function trackNow(e: TrackEvent): void {
  send([e]);
}

/** 批量 flush（visibilitychange hidden / pagehide 时调用） */
export function flush(): void {
  if (queue.length === 0) return;
  send(queue);
  queue = [];
}

if (typeof document !== "undefined") {
  const flushOnHide = () => flush();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flushOnHide);
}
