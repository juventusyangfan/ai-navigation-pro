"use client";

import { useState } from "react";
import Link from "next/link";

const ROLES = [
  { value: "teacher", label: "教师" },
  { value: "student", label: "学生" },
  { value: "parent", label: "家长" },
  { value: "admin", label: "学校管理员" },
];

export default function LoginPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("teacher");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("请输入昵称");
      return;
    }
    try {
      localStorage.setItem(
        "ea_user",
        JSON.stringify({ name: name.trim(), role, ts: Date.now() }),
      );
      window.location.href = "/profile";
    } catch {
      alert("登录失败，请重试");
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
              background: "linear-gradient(135deg,var(--color-primary),#7c3aed)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              margin: "0 auto 14px",
            }}
          >
            教
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 850 }}>登录教AI导航</h2>
          <p className="muted" style={{ margin: "6px 0 20px" }}>
            原型用本地模拟登录，正式版接入账号体系
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ textAlign: "left" }}>
              <label>昵称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：李老师"
                autoComplete="off"
              />
            </div>
            <div className="field" style={{ textAlign: "left" }}>
              <label>我是</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              进入
            </button>
          </form>
          <p className="login-hint" style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: "var(--color-primary)" }}>
              返回首页
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
