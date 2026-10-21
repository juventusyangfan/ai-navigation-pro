import fs from "node:fs";
import path from "node:path";

/**
 * 判断 public 下的静态资源是否真的存在。
 *
 * 为什么要查文件：二维码是引流位，配置了路径但图片还没放上去时，
 * 如果直接把 <img src> 渲染出去，浏览器会显示一个破图图标。
 * 而靠 <img onError> 兜底并不可靠 —— 图片 404 往往发生在 React 完成
 * hydration 之前，那个 error 事件没有任何监听者，等于被丢掉（实测如此）。
 * 所以服务端先查一次，不存在就干脆不渲染 img。
 */
export function publicAssetExists(p: string): boolean {
  if (!p) return false;
  if (/^https?:\/\//i.test(p) || p.startsWith("data:")) return true; // 远程或内联，交给浏览器
  try {
    const rel = p.replace(/^\/+/, "");
    return fs.existsSync(path.join(process.cwd(), "public", rel));
  } catch {
    return false;
  }
}
