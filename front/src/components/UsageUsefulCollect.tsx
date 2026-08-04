"use client";

import { useUseful, useFav } from "@/lib/interactions";
import { Icon } from "@/lib/icons";
import { toast } from "@/lib/toast";

// 用法页「有用 / 收藏」可点按钮（B2）：
// - 有用：标记当前用法 id（本地 ea_useful），乐观 +1 显示。
// - 收藏：复用工具的收藏键（ea_favs），与工具卡片/个人中心一致，乐观 +1。
export default function UsageUsefulCollect({
  usageId,
  toolSlug,
  toolName,
  baseUseful,
  baseCollect,
}: {
  usageId: string;
  toolSlug: string;
  toolName: string;
  baseUseful: number;
  baseCollect: number;
}) {
  const useful = useUseful(usageId);
  const fav = useFav(toolSlug);

  const usefulCount = baseUseful + (useful.on ? 1 : 0);
  const collectCount = baseCollect + (fav.on ? 1 : 0);

  return (
    <>
      <button
        type="button"
        className={`sp-btn ${useful.on ? "on" : ""}`}
        onClick={() => {
          useful.toggle();
          toast(useful.on ? "已标记「有用」" : "已取消「有用」");
        }}
      >
        <Icon name="ThumbsUp" size={13} className="inline" /> 有用 <b>{usefulCount}</b>
      </button>
      <button
        type="button"
        className={`sp-btn ${fav.on ? "on" : ""}`}
        onClick={() => {
          fav.toggle();
          toast(fav.on ? `已收藏 ${toolName}` : "已取消收藏");
        }}
      >
        <Icon name="BookmarkSimple" size={13} className="inline" /> 收藏 <b>{collectCount}</b>
      </button>
    </>
  );
}
