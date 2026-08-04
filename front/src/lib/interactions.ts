"use client";

import { useEffect, useState, useCallback } from "react";

// 统一的前端本地交互状态层（后台就绪前的本地落盘）。
// 键名集中于此，避免多份写入逻辑漂移；后台接入后只需把这里换成远程调用。

const FAV_KEY = "ea_favs"; // 收藏的工具 slug 数组
const USEFUL_KEY = "ea_useful"; // 标记「有用」的用法 id 数组
const RATE_KEY = "ea_rating"; // 用户评分：{ [toolSlug]: number }

/* ---------------- 收藏（工具） ---------------- */
export function readFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function useFav(slug: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readFavs().includes(slug));
  }, [slug]);

  const toggle = useCallback(() => {
    const cur = readFavs();
    const next = cur.includes(slug)
      ? cur.filter((x) => x !== slug)
      : [...cur, slug];
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    setOn(next.includes(slug));
  }, [slug]);

  return { on, toggle };
}

/* ---------------- 有用（用法） ---------------- */
export function readUseful(): string[] {
  try {
    return JSON.parse(localStorage.getItem(USEFUL_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function useUseful(id: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readUseful().includes(id));
  }, [id]);

  const toggle = useCallback(() => {
    const cur = readUseful();
    const next = cur.includes(id)
      ? cur.filter((x) => x !== id)
      : [...cur, id];
    localStorage.setItem(USEFUL_KEY, JSON.stringify(next));
    setOn(next.includes(id));
  }, [id]);

  return { on, toggle };
}

/* ---------------- 评分（工具） ---------------- */
export type RatingMap = Record<string, number>;

export function readRatings(): RatingMap {
  try {
    return JSON.parse(localStorage.getItem(RATE_KEY) || "{}") as RatingMap;
  } catch {
    return {};
  }
}

export function useRating(slug: string) {
  const [val, setVal] = useState<number | null>(null);
  useEffect(() => {
    const all = readRatings();
    setVal(all[slug] ?? null);
  }, [slug]);

  const rate = useCallback(
    (v: number) => {
      const all = readRatings();
      if (v <= 0) delete all[slug];
      else all[slug] = v;
      localStorage.setItem(RATE_KEY, JSON.stringify(all));
      setVal(v > 0 ? v : null);
    },
    [slug],
  );

  return { value: val, rate };
}
