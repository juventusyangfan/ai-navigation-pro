// 轻量 toast：复用 globals.css 的 .toast 样式
export function toast(msg: string) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(".toast") as HTMLElement | null;
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  window.setTimeout(() => el && el.classList.remove("show"), 1800);
}
