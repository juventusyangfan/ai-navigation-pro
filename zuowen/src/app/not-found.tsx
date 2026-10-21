import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="empty">
        <b>这份点评找不到了</b>
        链接可能已经失效，或者作文与点评已被删除。
      </div>
      <Link href="/" className="btn" style={{ display: "flex", textDecoration: "none" }}>
        去测一篇作文
      </Link>
    </div>
  );
}
