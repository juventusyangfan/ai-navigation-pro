// logo 字段兼容：可能是图片 URL（采集来的 favicon/og:image），也可能是占位文字。
// 判断是否为"图片形式"，以及取工具名称第一个汉字作为兜底 logo。

export function isImageLogo(s: string): boolean {
  if (!s) return false;
  const t = s.trim().toLowerCase();
  if (/^data:image\//.test(t)) return true;
  if (/^(https?:\/\/|\/\/)/.test(t)) return true;
  if (t.startsWith("/")) return true;
  if (/\.(png|jpe?g|gif|svg|webp|ico|bmp|avif)(\?|#|$)/i.test(t)) return true;
  return false;
}

/** 取名称第一个汉字；无汉字时取首字符；都为空返回 ? */
export function firstHanChar(name: string): string {
  const m = name && name.match(/[一-鿿]/);
  if (m) return m[0];
  const c = (name || "").trim().charAt(0);
  return c || "?";
}
