"use client";

import { useState } from "react";
import { isImageLogo, firstHanChar } from "@/lib/logo";

/**
 * logo 优先以图片渲染；非图片（占位文字/空）才回退为工具名称第一个汉字（带主题色底）。
 * 图片模式不设置任何背景，避免容器底色透出而影响 favicon/og:image 展示；
 * 图片加载失败时自动回退为首汉字（此时才带主题色底）。
 */
export default function ToolLogo({
  logo,
  name,
  color,
}: {
  logo: string;
  name: string;
  color?: string;
}) {
  const [err, setErr] = useState(false);
  if (isImageLogo(logo) && !err) {
    return (
      <img
        src={logo}
        alt={name}
        onError={() => setErr(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "inherit",
          display: "block",
        }}
      />
    );
  }
  return (
    <span
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: color || "var(--color-primary)",
        color: "#fff",
        borderRadius: "inherit",
      }}
    >
      {firstHanChar(name)}
    </span>
  );
}
