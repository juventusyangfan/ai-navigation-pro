"use client";

import React, { useState, useEffect } from "react";

type IconComponent = React.ComponentType<{
  size?: number | string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}>;

// Global cache — load Phosphor once, reuse forever
let cachedIcons: Record<string, IconComponent> | null = null;
let loadPromise: Promise<Record<string, IconComponent>> | null = null;

function loadIcons(): Promise<Record<string, IconComponent>> {
  if (cachedIcons) return Promise.resolve(cachedIcons);
  if (loadPromise) return loadPromise;

  loadPromise = import("@phosphor-icons/react").then((mod) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = mod as Record<string, any>;
    const map: Record<string, IconComponent> = {};
    for (const [key, value] of Object.entries(all)) {
      // Phosphor components are React.memo/forwardRef objects with a .render method
      // Skip *Icon definitions (also objects, but the icon definition data)
      // Skip special exports (IconContext, IconBase, Icon)
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as any).render === "function" &&
        !key.endsWith("Icon") &&
        key !== "IconContext" &&
        key !== "IconBase" &&
        key !== "Icon"
      ) {
        map[key] = value as IconComponent;
      }
    }
    cachedIcons = map;
    return map;
  });

  return loadPromise;
}

interface IconProps {
  name: string;
  size?: number | string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Render a Phosphor icon by name. Loads icons on client, caches globally. */
export function Icon({ name, size = 20, weight = "regular", color, className, style }: IconProps) {
  const [icons, setIcons] = useState<Record<string, IconComponent> | null>(cachedIcons);

  useEffect(() => {
    if (cachedIcons) return;
    let cancelled = false;
    loadIcons().then((map) => {
      if (!cancelled) setIcons(map);
    });
    return () => { cancelled = true; };
  }, []);

  // Not loaded yet — render a hidden placeholder to avoid layout shift
  if (!icons) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: typeof size === "number" ? size : 20,
          height: typeof size === "number" ? size : 20,
          flexShrink: 0,
        }}
        className={className}
      />
    );
  }

  const Component = icons[name];
  if (!Component) {
    if (typeof window !== "undefined") {
      console.warn(`Phosphor icon "${name}" not found`);
    }
    return null;
  }

  return <Component size={size} weight={weight} color={color} className={className} style={style} />;
}
