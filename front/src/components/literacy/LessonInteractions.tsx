"use client";

import { useState } from "react";
import { useUseful, useFav } from "@/lib/interactions";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";

// 伴学课「有用 / 收藏」可点按钮。refType="lesson"，与工具/用法收藏各自独立计数。
// 计数以服务端返回为准。未登录提示登录，不写本地。
export default function LessonInteractions({
  slug,
  baseUseful,
  baseCollect,
}: {
  slug: string;
  baseUseful: number;
  baseCollect: number;
}) {
  const useful = useUseful(slug, "lesson");
  const fav = useFav("lesson", slug);
  const [usefulCount, setUsefulCount] = useState(baseUseful);
  const [collectCount, setCollectCount] = useState(baseCollect);

  const onUseful = async () => {
    try {
      const r = await useful.toggle();
      if (r && "needLogin" in r) {
        toast("请先登录后再标记");
        return;
      }
      setUsefulCount(r.count);
      toast(r.on ? "已标记「有用」" : "已取消「有用」");
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败");
    }
  };

  const onFav = async () => {
    try {
      const r = await fav.toggle();
      if (r && "needLogin" in r) {
        toast("请先登录后再收藏");
        return;
      }
      setCollectCount(r.count);
      toast(r.on ? "已收藏这节课" : "已取消收藏这节课");
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <>
      <button
        type="button"
        className={`sp-btn ${useful.on ? "on" : ""}`}
        onClick={onUseful}
      >
        <Icon name="ThumbsUp" size={13} className="inline" /> 有用 <b>{usefulCount}</b>
      </button>
      <button
        type="button"
        className={`sp-btn ${fav.on ? "on" : ""}`}
        onClick={onFav}
      >
        <Icon name="BookmarkSimple" size={13} className="inline" /> 收藏 <b>{collectCount}</b>
      </button>
    </>
  );
}
