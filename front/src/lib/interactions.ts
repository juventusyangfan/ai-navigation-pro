"use client";

import { useEffect, useState, useCallback } from "react";
import { getSession, authFetch } from "@/lib/auth";

// 前台用户互动层（收藏 / 有用 / 评分）。
// 「收藏」「有用」「评分」均已对接后台 /api/me/*，以服务端为唯一数据源；
// 未登录时按钮仅提示登录，不写本地（避免本地/服务端数据漂移）。
// 评分规则：Tool.rating = 该工具全部打分者所打分数的平均分（服务端重算）。

export type ToggleOutcome =
  | { on: boolean; count: number }
  | { needLogin: true };

/* ---------------- 收藏（工具 / 用法路径多态） ---------------- */
// refType: "tool" -> refId 传工具 slug；"path" -> refId 传用法 usageId（或 sopPath id）。
// 与「有用」同范式，工具收藏与路径收藏各自独立记录、各自计数，互不串扰。
export function useFav(refType: "tool" | "path" | "lesson", refId: string) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = getSession();
      if (!me) {
        if (alive) {
          setOn(false);
          setReady(true);
        }
        return;
      }
      try {
        const r = await authFetch(
          `/api/me/favorites?refType=${refType}&refId=${encodeURIComponent(refId)}`,
        );
        if (!alive) return;
        if (r.ok) {
          const data = await r.json();
          setOn(!!data.on);
        } else {
          setOn(false);
        }
      } catch {
        if (alive) setOn(false);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refType, refId]);

  const toggle = useCallback(async (): Promise<ToggleOutcome> => {
    const me = getSession();
    if (!me) return { needLogin: true };
    const r = await authFetch(`/api/me/favorites`, {
      method: "POST",
      body: JSON.stringify({ refType, refId }),
    });
    if (r.status === 401) return { needLogin: true };
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error((e as { error?: string }).error || "收藏失败");
    }
    const data = await r.json();
    setOn(!!data.on);
    return { on: !!data.on, count: data.count };
  }, [refType, refId]);

  return { on, ready, toggle };
}

/* ---------------- 有用（工具 / 用法路径） ---------------- */
export function useUseful(id: string, refType: "tool" | "path" | "lesson" = "path") {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = getSession();
      if (!me) {
        if (alive) {
          setOn(false);
          setReady(true);
        }
        return;
      }
      try {
        const r = await authFetch(
          `/api/me/useful?refType=${refType}&refId=${encodeURIComponent(id)}`,
        );
        if (!alive) return;
        if (r.ok) {
          const data = await r.json();
          setOn(!!data.on);
        } else {
          setOn(false);
        }
      } catch {
        if (alive) setOn(false);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, refType]);

  const toggle = useCallback(async (): Promise<ToggleOutcome> => {
    const me = getSession();
    if (!me) return { needLogin: true };
    const r = await authFetch(`/api/me/useful`, {
      method: "POST",
      body: JSON.stringify({ refType, refId: id }),
    });
    if (r.status === 401) return { needLogin: true };
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error((e as { error?: string }).error || "操作失败");
    }
    const data = await r.json();
    setOn(!!data.on);
    return { on: !!data.on, count: data.count };
  }, [id, refType]);

  return { on, ready, toggle };
}

/* ---------------- 评分（工具，对接后台 /api/me/ratings） ---------------- */
// 评分规则：Tool.rating = 该工具全部打分者分数的平均分（服务端在每次写入后重算）。
// 前端不再本地存储评分，统一以服务端返回为准：
//   value:   当前用户本人给出的分（未打分为 null）
//   average: 该工具所有打分者的平均分（评分后即时刷新）
export function useRating(slug: string) {
  const [value, setValue] = useState<number | null>(null);
  const [average, setAverage] = useState<number>(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = getSession();
      if (!me) {
        if (alive) {
          setValue(null);
          setReady(true);
        }
        return;
      }
      try {
        const r = await authFetch(
          `/api/me/ratings?slug=${encodeURIComponent(slug)}`,
        );
        if (!alive) return;
        if (r.ok) {
          const data = await r.json();
          setValue(data.score ?? null);
          setAverage(typeof data.average === "number" ? data.average : 0);
        }
      } catch {
        // 网络异常时保持默认，不阻断页面
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const rate = useCallback(
    async (v: number): Promise<{ average: number } | { needLogin: true }> => {
      const me = getSession();
      if (!me) return { needLogin: true };
      const r = await authFetch(`/api/me/ratings`, {
        method: "POST",
        body: JSON.stringify({ slug, score: v }),
      });
      if (r.status === 401) return { needLogin: true };
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error || "评分失败");
      }
      const data = await r.json();
      setValue(v > 0 ? v : null);
      setAverage(data.average ?? 0);
      return { average: data.average ?? 0 };
    },
    [slug],
  );

  return { value, average, ready, rate };
}

/** 拉取当前用户收藏的工具 slug 列表（个人中心用） */
export async function fetchMyFavoritesSlugs(): Promise<string[]> {
  const me = getSession();
  if (!me) return [];
  try {
    const r = await authFetch(`/api/me/favorites`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.slugs as string[]) || [];
  } catch {
    return [];
  }
}

/** 拉取当前用户收藏的用法 path id 列表（个人中心用） */
export async function fetchMyFavoritesPathIds(): Promise<string[]> {
  const me = getSession();
  if (!me) return [];
  try {
    const r = await authFetch(`/api/me/favorites`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.pathIds as string[]) || [];
  } catch {
    return [];
  }
}

/* ---------------- 纠错 / 补充建议（工具，对接后台 /api/me/feedback） ---------------- */
export type FeedbackItem = {
  id: string;
  toolSlug: string;
  toolName: string;
  type: string;
  text: string;
  status: string;
  ts: number;
};

/** 拉取当前用户提交的反馈列表（个人中心用） */
export async function fetchMyFeedback(): Promise<FeedbackItem[]> {
  const me = getSession();
  if (!me) return [];
  try {
    const r = await authFetch(`/api/me/feedback`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.items as FeedbackItem[]) || [];
  } catch {
    return [];
  }
}

/** 提交纠错 / 补充建议。未登录返回 { needLogin: true }。 */
export async function submitFeedback(
  slug: string,
  type: string,
  text: string,
): Promise<{ needLogin?: true; error?: string }> {
  const me = getSession();
  if (!me) return { needLogin: true };
  const r = await authFetch(`/api/me/feedback`, {
    method: "POST",
    body: JSON.stringify({ slug, type, text }),
  });
  if (r.status === 401) return { needLogin: true };
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    return { error: (e as { error?: string }).error || "提交失败" };
  }
  return {};
}

/* ---------------- SOP 笔记（对接后台 /api/me/notes） ---------------- */
// 笔记按 (用户, refType, refId) 唯一：同一 SOP/工具只保留最新一份。
// refType: "path" -> refId 传用法 usageId（或 sopPath id）；"tool" -> 传工具 slug。
export type NoteItem = { refType: string; refId: string; content: string; ts: number };

/** 拉取当前用户全部笔记（个人中心用） */
export async function fetchMyNotes(): Promise<NoteItem[]> {
  const me = getSession();
  if (!me) return [];
  try {
    const r = await authFetch(`/api/me/notes`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.items as NoteItem[]) || [];
  } catch {
    return [];
  }
}

/** 读取单条笔记内容（NoteBox 挂载时回填） */
export async function fetchNote(refType: string, refId: string): Promise<string> {
  const me = getSession();
  if (!me) return "";
  try {
    const r = await authFetch(
      `/api/me/notes?refType=${encodeURIComponent(refType)}&refId=${encodeURIComponent(refId)}`,
    );
    if (!r.ok) return "";
    const data = await r.json();
    return typeof data.content === "string" ? data.content : "";
  } catch {
    return "";
  }
}

/** 保存（upsert）单条笔记。未登录返回 { needLogin: true }。 */
export async function saveNote(
  refType: string,
  refId: string,
  content: string,
): Promise<{ needLogin?: true; error?: string }> {
  const me = getSession();
  if (!me) return { needLogin: true };
  const r = await authFetch(`/api/me/notes`, {
    method: "POST",
    body: JSON.stringify({ refType, refId, content }),
  });
  if (r.status === 401) return { needLogin: true };
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    return { error: (e as { error?: string }).error || "保存失败" };
  }
  return {};
}
