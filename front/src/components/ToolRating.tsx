"use client";

import { useState } from "react";
import { useRating } from "@/lib/interactions";
import { toast } from "@/lib/toast";
import StarRating from "./StarRating";

// 工具详情页「评分」区：展示用户平均分（只读），并提供当前用户本人可点击评分（打分）。
// 评分规则：平均分 = 所有打分者所打分数的平均（服务端重算，见 /api/me/ratings）。
export default function ToolRating({
  slug,
  aggregate,
}: {
  slug: string;
  aggregate: number;
}) {
  const { value, average, rate } = useRating(slug);
  const [avg, setAvg] = useState(aggregate);

  const onRate = async (v: number) => {
    try {
      const res = await rate(v);
      if (res && "needLogin" in res) {
        toast("请先登录后再评分");
        return;
      }
      setAvg(res.average);
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div className="tool-rate-block">
      <div className="tool-rate-line">
        <span className="tr-label">用户评分</span>
        <StarRating value={avg} size={14} showNumber title={`${avg.toFixed(1)} 分`} />
      </div>
      <div className="tool-rate-line">
        <span className="tr-label">我的评分</span>
        <StarRating
          value={value ?? 0}
          size={18}
          interactive
          onRate={onRate}
          title={value ? `已评 ${value} 分，点击可修改` : "点击为这个工具评分"}
        />
        {value != null && (
          <button type="button" className="rate-clear" onClick={() => onRate(0)}>
            清除
          </button>
        )}
      </div>
    </div>
  );
}
