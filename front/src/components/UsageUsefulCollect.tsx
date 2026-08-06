"use client";

import { useState } from "react";
import { useUseful, useFav } from "@/lib/interactions";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";

// 用法页「有用 / 收藏」可点按钮（B2）：
// - 有用：标记当前用法（path），对接 /api/me/useful。
// - 收藏：标记当前用法（path）本身，对接 /api/me/favorites?refType=path，
//        与工具收藏完全独立，计数只动该用法的 collectCount。
// 计数以服务端返回为准（接口返回 total，避免本地/服务端双重 +1）。
export default function UsageUsefulCollect({
  usageId,
  baseUseful,
  baseCollect,
}: {
  usageId: string;
  baseUseful: number;
  baseCollect: number;
}) {
  const useful = useUseful(usageId);
  const fav = useFav("path", usageId);
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
      toast(r.on ? "已收藏该用法" : "已取消收藏该用法");
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
