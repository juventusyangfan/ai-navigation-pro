"use client";

import { useState } from "react";
import { isImageLogo, firstHanChar } from "@/lib/logo";

/**
 * logo 优先以图片渲染；非图片（占位文字/空）则回退为工具名称第一个汉字。
 * 图片加载失败时也回退为首汉字，避免裂图。
 * size 控制方块的边长（px）；非图片时以主题色背景显示首汉字。
 */
export default function ToolLogo({
  logo,
  name,
  color,
  size = 22,
}: {
  logo: string;
  name: string;
  color?: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  if (isImageLogo(logo) && !err) {
    return (
      <img
        src={logo}
        alt={name}
        onError={() => setErr(true)}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: 6,
          display: "inline-block",
          verticalAlign: "middle",
          background: "#fff",
          border: "1px solid #eee",
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: `${size}px`,
        textAlign: "center",
        borderRadius: 6,
        color: "#fff",
        background: color || "#2f6bff",
        fontSize: Math.max(11, Math.round(size * 0.5)),
        verticalAlign: "middle",
      }}
    >
      {firstHanChar(name)}
    </span>
  );
}
