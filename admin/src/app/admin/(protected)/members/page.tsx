"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  student: "学生",
  parent: "家长",
  school_admin: "学校管理员",
};

interface Member {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export default function MembersPage() {
  const [items, setItems] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("page", String(page));
      const r = await fetch(`/api/admin/members?${params.toString()}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "加载失败");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [role, status, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async (m: Member) => {
    if (!confirm(`确认${m.status === "active" ? "禁用" : "启用"}「${m.name}」？`))
      return;
    const r = await fetch(`/api/admin/members/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: m.status === "active" ? "disabled" : "active" }),
    });
    if (r.ok) load();
    else alert("操作失败");
  };

  const remove = async (m: Member) => {
    if (!confirm(`确认删除「${m.name}」？该用户及其收藏/反馈/投稿将一并清除，不可恢复。`))
      return;
    const r = await fetch(`/api/admin/members/${m.id}`, { method: "DELETE" });
    if (r.ok) load();
    else alert("删除失败");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>注册用户</h1>
          <div className="desc">
            前台注册的终端用户（教师 / 学生 / 家长 / 学校管理员），共 {total} 人
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filterbar">
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">全部角色</option>
            <option value="teacher">教师</option>
            <option value="student">学生</option>
            <option value="parent">家长</option>
            <option value="school_admin">学校管理员</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="disabled">已禁用</option>
          </select>
          <input
            placeholder="搜索姓名 / 手机号"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }}
            style={{ minWidth: 180 }}
          />
          <button className="btn btn-sm" onClick={() => { setPage(1); load(); }}>
            查询
          </button>
          <button className="btn btn-sm" onClick={() => { setRole(""); setStatus(""); setQ(""); setPage(1); }}>
            重置
          </button>
        </div>
      </div>

      {error && <div className="form-errors">{error}</div>}

      <table className="tbl">
        <thead>
          <tr>
            <th>用户</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>加载中…</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>暂无用户</td></tr>
          ) : (
            items.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{m.phone || "（无手机号）"}</div>
                </td>
                <td>{ROLE_LABEL[m.role] || m.role}</td>
                <td>
                  {m.status === "active" ? (
                    <span className="badge ok">正常</span>
                  ) : (
                    <span className="badge bad">已禁用</span>
                  )}
                </td>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  {new Date(m.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </td>
                <td>
                  <div className="row-actions">
                    <Link href={`/admin/members/${m.id}`} className="btn btn-sm">查看</Link>
                    <button className="btn btn-sm" onClick={() => toggleStatus(m)}>
                      {m.status === "active" ? "禁用" : "启用"}
                    </button>
                    <button className="btn btn-sm danger" onClick={() => remove(m)}>删除</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pager">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>第 {page} / {totalPages} 页</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          下一页
        </button>
      </div>
    </>
  );
}
