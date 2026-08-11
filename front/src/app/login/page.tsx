"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, setSession } from "@/lib/auth";

const PHONE_RE = /^1[3-9]\d{9}$/;

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!PHONE_RE.test(phone)) {
      setError("请输入正确的 11 位手机号");
      return;
    }
    if (!password) {
      setError("请输入登录密码");
      return;
    }
    setLoading(true);
    try {
      const data = await login(phone, password);
      setSession({
        id: data.user.id,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role,
        token: data.token,
        ts: Date.now(),
      });
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wrap" style={{ marginTop: 40, paddingBottom: 80 }}>
      <div className="form-wrap" style={{ maxWidth: 420 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div
            className="logo"
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: "var(--color-primary)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              margin: "0 auto 14px",
            }}
          >
            教
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 850 }}>登录智用笔记</h2>
          <p className="muted" style={{ margin: "6px 0 20px" }}>
            使用注册手机号与密码登录
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field" style={{ textAlign: "left" }}>
              <label>手机号</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 位手机号"
                inputMode="numeric"
                maxLength={11}
                autoComplete="tel"
              />
            </div>
            <div className="field" style={{ textAlign: "left" }}>
              <label>登录密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? "登录中…" : "登录"}
            </button>
          </form>

          <p className="auth-switch">
            还没有账号？<Link href="/register">立即注册</Link>
          </p>
          <p className="login-hint" style={{ marginTop: 10 }}>
            <Link href="/" style={{ color: "var(--color-primary)" }}>
              返回首页
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
