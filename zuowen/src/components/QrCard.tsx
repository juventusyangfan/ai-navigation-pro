"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 二维码卡片。图片没放或加载失败时，退化成一句文字引导，
 * 不留下一个破图 —— 引流位是整页最后的印象，不能难看。
 *
 * 两道保险：
 * 1. src 为空（服务端已确认文件不存在）→ 直接渲染占位；
 * 2. 浏览器加载失败 → onError 兜底。
 *    另外补一个 ref 检查：图片 404 常常发生在 React 绑定事件之前，
 *    那次 error 会被丢掉，所以要主动看一眼 naturalWidth。
 */
export default function QrCard({ src, label }: { src: string; label: string }) {
  const [bad, setBad] = useState(!src);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setBad(true);
  }, [src]);

  if (bad || !src) {
    return (
      <div className="qr placeholder">
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={label} onError={() => setBad(true)} />
      <span>{label}</span>
    </div>
  );
}
