"use client";

import { useRating } from "@/lib/interactions";
import StarRating from "./StarRating";

// 工具详情页「评分」区：展示教师均分（只读），并提供用户本人可点击评分（打分）。
export default function ToolRating({
  slug,
  aggregate,
}: {
  slug: string;
  aggregate: number;
}) {
  const { value, rate } = useRating(slug);

  return (
    <div className="tool-rate-block">
      <div className="tool-rate-line">
        <span className="tr-label">教师评分</span>
        <StarRating value={aggregate} size={14} showNumber title={`${aggregate.toFixed(1)} 分`} />
      </div>
      <div className="tool-rate-line">
        <span className="tr-label">我的评分</span>
        <StarRating
          value={value ?? 0}
          size={18}
          interactive
          onRate={rate}
          title={value ? `已评 ${value} 分，点击可修改` : "点击为这个工具评分"}
        />
        {value != null && (
          <button type="button" className="rate-clear" onClick={() => rate(0)}>
            清除
          </button>
        )}
      </div>
    </div>
  );
}
