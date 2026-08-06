"use client";

import { useFav } from "@/lib/interactions";
import { toast } from "@/lib/toast";
import { Icon } from "@/lib/icons";

export default function FavButton({
  slug,
  name,
  inline = false,
}: {
  slug: string;
  name: string;
  inline?: boolean;
}) {
  const { on, toggle } = useFav("tool", slug);
  const cls = inline
    ? `btn btn-sm btn-ghost fav-inline ${on ? "on" : ""}`
    : `fav-btn ${on ? "on" : ""}`;

  return (
    <button
      className={cls}
      onClick={async () => {
        try {
          const r = await toggle();
          if (r && "needLogin" in r) {
            toast("请先登录后再收藏");
            return;
          }
          toast(r.on ? `已收藏 ${name}` : `已取消收藏 ${name}`);
        } catch (e) {
          toast(e instanceof Error ? e.message : "操作失败");
        }
      }}
      title={on ? "取消收藏" : "收藏"}
      aria-label={on ? `取消收藏 ${name}` : `收藏 ${name}`}
    >
      <Icon name="Heart" size={16} weight={on ? "fill" : "regular"} />
      {inline && <span>{on ? "已收藏" : "收藏"}</span>}
    </button>
  );
}
