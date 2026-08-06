"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  student: "学生",
  parent: "家长",
  school_admin: "学校管理员",
};

interface Submission {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  submissions: Submission[];
}

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [m, setM] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/members/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) throw new Error("用户不存在");
        setM(d.user);
        setName(d.user.name);
        setRole(d.user.role);
        setStatus(d.user.status);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "保存失败");
      setMsg("已保存");
      setM((prev) => (prev ? { ...prev, name, role, status } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("确认删除该用户？相关数据将一并清除，不可恢复。")) return;
    const r = await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    if (r.ok) {
      window.location.href = "/admin/members";
    } else {
      alert("删除失败");
    }
  };

  if (loading) return <div className="empty">加载中…</div>;
  if (error && !m)
    return (
      <>
        <div className="form-errors">{error}</div>
        <Link href="/admin/members" className="btn btn-sm">← 返回列表</Link>
      </>
    );
  if (!m) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/admin/members" className="link">← 返回注册用户</Link>
          <h1 style={{ marginTop: 6 }}>{m.name}</h1>
          <div className="desc">
            {m.phone || "（无手机号）"} · 注册于{" "}
            {new Date(m.createdAt).toLocaleString("zh-CN", { hour12: false })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {m.status === "active" ? (
            <span className="badge ok">正常</span>
          ) : (
            <span className="badge bad">已禁用</span>
          )}
          <button className="btn btn-sm danger" onClick={remove}>删除用户</button>
        </div>
      </div>

      {msg && <div className="form-errors ok">{msg}</div>}
      {error && <div className="form-errors">{error}</div>}

      <div className="grid cols-2">
        <div className="card">
          <h3 className="sec-title">基本信息</h3>
          <label className="field">
            <span>真实姓名</span>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>入驻角色</span>
            <select className="inp" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="teacher">教师</option>
              <option value="student">学生</option>
              <option value="parent">家长</option>
              <option value="school_admin">学校管理员</option>
            </select>
          </label>
          <label className="field">
            <span>账号状态</span>
            <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">正常</option>
              <option value="disabled">已禁用</option>
            </select>
          </label>
          <button className="btn primary" disabled={saving} onClick={save}>
            {saving ? "保存中…" : "保存修改"}
          </button>
        </div>

        <div className="card">
          <h3 className="sec-title">投稿记录（{m.submissions.length}）</h3>
          {m.submissions.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>该用户暂无投稿。</p>
          ) : (
            <table className="tbl" style={{ border: "none", boxShadow: "none" }}>
              <thead>
                <tr>
                  <th>类型</th>
                  <th>状态</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {m.submissions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.type}</td>
                    <td>
                      <span className="badge" style={{ fontSize: 11 }}>{s.status}</span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                      {new Date(s.createdAt).toLocaleString("zh-CN", { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
