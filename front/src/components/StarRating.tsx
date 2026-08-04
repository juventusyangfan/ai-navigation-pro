"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";

const STARS = [1, 2, 3, 4, 5];

// 评星组件：
// - 只读时按 value 小数填充（B4 半星），底层用「整星轨道 + 裁剪填充层」实现像素级对齐。
// - interactive 时鼠标左右半区可打 0.5 / 1.0 分（打分）。
export default function StarRating({
  value,
  size = 13,
  interactive = false,
  onRate,
  title,
  showNumber = false,
}: {
  value: number;
  size?: number;
  interactive?: boolean;
  onRate?: (v: number) => void;
  title?: string;
  showNumber?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const pct = Math.max(0, Math.min(100, (shown / 5) * 100));

  return (
    <span
      className={`star-rating${interactive ? " interactive" : ""}`}
      title={title ?? `${value.toFixed(1)} 分`}
      onMouseLeave={() => interactive && setHover(null)}
    >
      <span className="sr-stars">
        <span className="sr-track" aria-hidden="true">
          {STARS.map((s) => (
            <Icon key={s} name="Star" size={size} className="sr-empty" />
          ))}
        </span>
        <span className="sr-fill" style={{ width: `${pct}%` }} aria-hidden="true">
          {STARS.map((s) => (
            <Icon key={s} name="Star" size={size} weight="fill" className="sr-full" />
          ))}
        </span>
        {interactive && (
          <span className="sr-hit">
            {STARS.map((s) => (
              <span key={s} className="sr-half">
                <button
                  type="button"
                  className="sr-zone sr-left"
                  onMouseEnter={() => setHover(s - 0.5)}
                  onClick={() => onRate?.(s - 0.5)}
                  aria-label={`${s - 0.5} 分`}
                />
                <button
                  type="button"
                  className="sr-zone sr-right"
                  onMouseEnter={() => setHover(s)}
                  onClick={() => onRate?.(s)}
                  aria-label={`${s} 分`}
                />
              </span>
            ))}
          </span>
        )}
      </span>
      {showNumber && <span className="sr-num">{value.toFixed(1)}</span>}
    </span>
  );
}
