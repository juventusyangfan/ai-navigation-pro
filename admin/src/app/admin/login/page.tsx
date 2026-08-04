"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@ea.test");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setErr(data.error || "登录失败");
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>教AI导航 · 后台登录</h1>
        <p className="sub">内容中台 · 仅限管理员</p>
        <label className="field">
          <span>邮箱</span>
          <input className="inp" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            className="inp"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="login-err">{err}</div>
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </button>
        <p className="sub" style={{ marginTop: 14 }}>
          默认账号 admin@ea.test / admin123（请在 .env 修改 AUTH_SECRET）
        </p>
      </form>
    </div>
  );
}
