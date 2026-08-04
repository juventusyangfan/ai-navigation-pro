"use client";

import { useFav } from "@/lib/interactions";
import { toast } from "@/lib/toast";
import { Icon } from "@/lib/icons";

export default function FavButton({ slug, name }: { slug: string; name: string }) {
  const { on, toggle } = useFav(slug);

  return (
    <button
      className={`fav-btn ${on ? "on" : ""}`}
      onClick={() => {
        toggle();
        toast(on ? `已取消收藏 ${name}` : `已收藏 ${name}`);
      }}
      title={on ? "取消收藏" : "收藏"}
      aria-label={on ? `取消收藏 ${name}` : `收藏 ${name}`}
    >
      <Icon name="Heart" size={16} weight={on ? "fill" : "regular"} />
    </button>
  );
}
