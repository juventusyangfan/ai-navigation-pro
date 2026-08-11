"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_ACCOUNTS = [
  { email: "admin@ea.com", password: "admin123", role: "super_admin", name: "管理员" },
  { email: "editor@ea.com", password: "editor123", role: "editor", name: "编辑员" },
  { email: "reviewer@ea.com", password: "reviewer123", role: "reviewer", name: "审核员" },
  { email: "school@ea.com", password: "school123", role: "school_admin", name: "学校管理员" },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 演示模式：本地验证
      const account = DEMO_ACCOUNTS.find(
        (a) => a.email === email && a.password === password
      );

      if (account) {
        const adminUser = {
          id: `user_${Date.now()}`,
          email: account.email,
          name: account.name,
          role: account.role,
        };

        localStorage.setItem("admin_user", JSON.stringify(adminUser));
        router.push("/admin");
      } else {
        setError("邮箱或密码错误");
      }
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">教</span>
          </div>
          <h1>智用笔记 · 后台管理</h1>
          <p className="login-subtitle">请登录以访问管理后台</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="demo-hint">
          <details>
            <summary>演示账号</summary>
            <div className="demo-list">
              {DEMO_ACCOUNTS.map((a) => (
                <div key={a.email} className="demo-item">
                  <span className="demo-role">{getRoleLabel(a.role)}</span>
                  <code>{a.email}</code> / <code>{a.password}</code>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="login-footer">
          <a href="/" className="back-link">← 返回前台</a>
        </div>
      </div>
    </div>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: "超级管理员",
    editor: "编辑",
    reviewer: "审核员",
    school_admin: "学校管理员",
  };
  return labels[role] || role;
}