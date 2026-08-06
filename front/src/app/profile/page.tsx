"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { content, type Tool, type Usage } from "@/lib/content";
import { Icon } from "@/lib/icons";
import ToolLogo from "@/components/ToolLogo";
import { clearSession } from "@/lib/auth";
import {
  fetchMyFavoritesSlugs,
  fetchMyFavoritesPathIds,
  fetchMyFeedback,
  fetchMyNotes,
  type FeedbackItem,
  type NoteItem,
} from "@/lib/interactions";

type User = { id: string; name: string; phone: string; role: string; token: string; ts: number } | null;

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  student: "学生",
  parent: "家长",
  school_admin: "学校管理员",
};

type Tab = "fav" | "note" | "fb" | "contrib";

const TABS: { key: Tab; label: string }[] = [
  { key: "fav", label: "我的收藏" },
  { key: "note", label: "SOP 笔记" },
  { key: "fb", label: "我的反馈" },
  { key: "contrib", label: "贡献中心 (P2)" },
];

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function ProfilePage() {
  const [user, setUser] = useState<User>(null);
  const [activeTab, setActiveTab] = useState<Tab>("fav");

  const [toolMap, setToolMap] = useState<Record<string, Tool>>({});
  const [sceneName, setSceneName] = useState<Record<string, string>>({});
  const [favSlugs, setFavSlugs] = useState<string[]>([]);
  const [favPathIds, setFavPathIds] = useState<string[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [fbList, setFbList] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("ea_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    content.getToolMap().then(setToolMap);
    content.getSceneName().then(setSceneName);
  }, []);

  // 登录后从后台拉取收藏列表（未登录回退本地镜像，兼容旧数据）
  useEffect(() => {
    if (!user) return;
    (async () => {
      let slugs: string[] = [];
      try {
        slugs = await fetchMyFavoritesSlugs();
      } catch {
        slugs = [];
      }
      if (!slugs.length) {
        try {
          slugs = JSON.parse(localStorage.getItem("ea_favs") || "[]");
        } catch {
          slugs = [];
        }
      }
      setFavSlugs(slugs);
    })();
  }, [user]);

  // 拉取收藏的用法列表
  useEffect(() => {
    if (!user) return;
    (async () => {
      let pids: string[] = [];
      try {
        pids = await fetchMyFavoritesPathIds();
      } catch {
        pids = [];
      }
      if (!pids.length) {
        try {
          pids = JSON.parse(localStorage.getItem("ea_fav_paths") || "[]");
        } catch {
          pids = [];
        }
      }
      setFavPathIds(pids);
    })();
    content.getUsages().then(setUsages);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [n, f] = await Promise.all([fetchMyNotes(), fetchMyFeedback()]);
      setNotes(n);
      setFbList(f);
    })();
  }, [user]);

  const favUsages = favPathIds
    .map((id) => usages.find((u) => u.id === id))
    .filter(Boolean) as Usage[];

  if (!user) {
    return (
      <main className="wrap" style={{ marginTop: 24 }}>
        <div className="soon-card">
          请先{" "}
          <Link
            href="/login"
            style={{ color: "var(--color-primary)", fontWeight: 700 }}
          >
            登录
          </Link>{" "}
          后查看个人中心。
        </div>
      </main>
    );
  }

  const favTools = favSlugs
    .map((slug) => toolMap[slug])
    .filter(Boolean) as Tool[];

  const roleLabel = ROLE_LABEL[user.role] || user.role;

  const handleLogout = () => {
    clearSession();
    window.location.href = "/";
  };

  return (
    <main className="wrap" style={{ marginTop: 24 }}>
      <div className="me-head">
        <div className="avatar" id="me-avatar">
          {(user.name || "U")[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h1 id="me-name">{user.name}</h1>
          <span className="role-tag" id="me-role">
            {roleLabel}
          </span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          style={{ marginLeft: "auto" }}
        >
          退出登录
        </button>
      </div>

      <div className="me-stats">
        <div className="stat-card">
          <div className="n" id="st-fav">{favTools.length + favUsages.length}</div>
          <div className="l">我的收藏</div>
        </div>
        <div className="stat-card">
          <div className="n" id="st-note">{notes.length}</div>
          <div className="l">SOP 笔记</div>
        </div>
        <div className="stat-card">
          <div className="n" id="st-fb">{fbList.length}</div>
          <div className="l">我的反馈</div>
        </div>
      </div>

      <div className="me-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={activeTab === t.key ? "active" : ""}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "fav" && (
        <div id="p-fav">
          {favTools.length === 0 && favUsages.length === 0 ? (
            <div className="soon-card">
              还没有收藏，去工具详情或用法页点{" "}
              <Icon name="Heart" size={14} className="inline" /> 吧。
            </div>
          ) : (
            <>
              {favTools.map((t) => (
                <Link
                  key={`tool-${t.slug}`}
                  className="note-item"
                  href={`/tool/${t.slug}`}
                  style={{ display: "block" }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div
                      className="tool-logo"
                      style={{
                        width: 40,
                        height: 40,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      <ToolLogo logo={t.logo} name={t.name} color={t.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4>{t.name}</h4>
                      <div className="meta">{t.tagline}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {t.scenes.slice(0, 2).map((s) => (
                          <span key={s} className="tag scene">
                            {sceneName[s] || s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {favUsages.map((u) => {
                const tool = toolMap[u.tool];
                return (
                  <Link
                    key={`usage-${u.id}`}
                    className="note-item"
                    href={`/usages/${u.id}`}
                    style={{ display: "block" }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div
                        className="tool-logo"
                        style={{
                          background: "var(--color-teal-soft)",
                          color: "var(--color-teal)",
                          width: 40,
                          height: 40,
                          fontSize: 14,
                          flexShrink: 0,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Icon name="Notebook" size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4>{u.title}</h4>
                        <div className="meta">
                          {tool?.name || u.tool} · {u.subj} · {u.steps} 步 SOP
                        </div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <span className={`rb rb-${u.role === "老师" ? "teacher" : u.role === "学生" ? "student" : u.role === "家长" ? "parent" : "admin"}`}>
                            {u.role}
                          </span>
                          <span className="tag scene">
                            {sceneName[u.scene] || u.scene}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      )}

      {activeTab === "note" && (
        <div id="p-note">
          {notes.length > 0 ? (
            notes.map((rec) => {
              const usage =
                rec.refType === "path"
                  ? usages.find((u) => u.id === rec.refId)
                  : undefined;
              const title = usage?.title || toolMap[rec.refId]?.name || rec.refId;
              const link =
                rec.refType === "path" ? `/usages/${rec.refId}` : `/tool/${rec.refId}`;
              return (
                <div key={`${rec.refType}:${rec.refId}`} className="note-item">
                  <h4>{title}</h4>
                  <div className="meta">
                    我的 SOP 笔记 ·{" "}
                    <Link href={link} style={{ color: "var(--color-primary)" }}>
                      查看 SOP →
                    </Link>
                  </div>
                  <p>{rec.content}</p>
                </div>
              );
            })
          ) : (
            <div className="soon-card">还没有笔记，在工具/SOP 页底部「我的笔记」里记录心得。</div>
          )}
        </div>
      )}

      {activeTab === "fb" && (
        <div id="p-fb">
          {fbList.length > 0 ? (
            fbList.map((f) => {
              const tool = toolMap[f.toolSlug];
              const badge =
                f.status === "approved"
                  ? "ok"
                  : f.status === "rejected"
                    ? "bad"
                    : "warn";
              const label =
                f.status === "approved"
                  ? "已采纳"
                  : f.status === "rejected"
                    ? "已忽略"
                    : "待处理";
              return (
                <div key={f.id} className="note-item">
                  <h4>
                    {tool ? tool.name : f.toolName} · {f.type}
                  </h4>
                  <div className="meta">
                    {formatTime(f.ts)} · <span className={`badge ${badge}`}>{label}</span>
                  </div>
                  <p>{f.text}</p>
                </div>
              );
            })
          ) : (
            <div className="soon-card">还没有反馈，在工具页点「反馈 / 纠错」。</div>
          )}
        </div>
      )}

      {activeTab === "contrib" && (
        <div id="p-contrib" className="soon-card">
          <b>贡献中心（规划中 P2）</b>
          <br />
          发布 SOP · 评论点赞 · 认证贡献者 · 校方内训版
        </div>
      )}
    </main>
  );
}
