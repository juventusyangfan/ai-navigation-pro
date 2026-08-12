"use client";

import { useState } from "react";
import Link from "next/link";
import { register } from "@/lib/auth";

const PHONE_RE = /^1[3-9]\d{9}$/;

const ROLES = [
  { value: "teacher", label: "教师" },
  { value: "student", label: "学生" },
  { value: "parent", label: "家长" },
  { value: "school_admin", label: "学校管理员" },
];

export default function RegisterPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("teacher");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const phoneOk = PHONE_RE.test(phone);
  const pwdOk = password.length >= 6;
  const matchOk = password === confirm && confirm.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phoneOk) return setError("请输入正确的 11 位手机号");
    if (!name.trim()) return setError("请填写真实姓名");
    if (!pwdOk) return setError("登录密码至少 6 位");
    if (!matchOk) return setError("两次输入的密码不一致");

    setLoading(true);
    try {
      await register({ phone, name: name.trim(), role, password, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="wrap" style={{ marginTop: 40, paddingBottom: 80 }}>
        <div className="form-wrap" style={{ maxWidth: 420 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 850 }}>注册成功</h2>
            <p className="muted" style={{ margin: "10px 0 20px" }}>
              账号已创建，请使用手机号登录。
            </p>
            <Link href="/login" className="btn btn-primary btn-block">
              去登录
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
          <h2 style={{ fontSize: 22, fontWeight: 850 }}>注册智用笔记</h2>
          <p className="muted" style={{ margin: "6px 0 20px" }}>
            填写手机号与信息，创建你的账号
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field" style={{ textAlign: "left" }}>
              <label>手机号</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="11 位手机号"
                inputMode="numeric"
                maxLength={11}
                autoComplete="tel"
              />
              {phone && !phoneOk && <div className="field-err">手机号格式不正确</div>}
            </div>

            <div className="field" style={{ textAlign: "left" }}>
              <label>真实姓名</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：张明"
                autoComplete="name"
              />
            </div>

            <div className="field" style={{ textAlign: "left" }}>
              <label>入驻角色</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ textAlign: "left" }}>
              <label>登录密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                autoComplete="new-password"
              />
              {password && !pwdOk && <div className="field-err">密码至少 6 位</div>}
            </div>

            <div className="field" style={{ textAlign: "left" }}>
              <label>确认登录密码</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
              />
              {confirm && !matchOk && <div className="field-err">两次输入的密码不一致</div>}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? "提交中…" : "注册"}
            </button>
          </form>

          <p className="auth-switch">
            已有账号？<Link href="/login">去登录</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
