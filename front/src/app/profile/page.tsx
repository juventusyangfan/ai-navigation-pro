"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { content, type Tool } from "@/lib/content";
import type { NoteRecord } from "@/components/NoteBox";
import { Icon } from "@/lib/icons";

type User = { name: string; role: string; ts: number } | null;
type Feedback = { tool: string; type: string; text: string; ts: number };

const ROLE_LABEL: Record<string, string> = {
  teacher: "教师",
  student: "学生",
  parent: "家长",
  admin: "学校管理员",
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

  const [tools, setTools] = useState<Tool[]>([]);
  const [toolMap, setToolMap] = useState<Record<string, Tool>>({});
  const [sceneName, setSceneName] = useState<Record<string, string>>({});

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
    content.getTools().then(setTools);
    content.getToolMap().then(setToolMap);
    content.getSceneName().then(setSceneName);
  }, []);

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

  const favs: string[] = JSON.parse(localStorage.getItem("ea_favs") || "[]");
  const notes: Record<string, NoteRecord> = JSON.parse(
    localStorage.getItem("ea_notes") || "{}",
  );
  const fbList: Feedback[] = JSON.parse(localStorage.getItem("ea_fb") || "[]");

  const favTools = favs
    .map((slug) => tools.find((t) => t.slug === slug))
    .filter(Boolean) as Tool[];

  const roleLabel = ROLE_LABEL[user.role] || user.role;

  const handleLogout = () => {
    localStorage.removeItem("ea_user");
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
          <div className="n" id="st-fav">{favs.length}</div>
          <div className="l">收藏工具</div>
        </div>
        <div className="stat-card">
          <div className="n" id="st-note">{Object.keys(notes).length}</div>
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
          {favTools.length > 0 ? (
            favTools.map((t) => (
              <Link
                key={t.slug}
                className="note-item"
                href={`/tool/${t.slug}`}
                style={{ display: "block" }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    className="tool-logo"
                    style={{
                      background: t.color,
                      width: 40,
                      height: 40,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {t.logo}
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
            ))
          ) : (
            <div className="soon-card">
              还没有收藏，去工具详情点{" "}
              <Icon name="Heart" size={14} className="inline" /> 吧。
            </div>
          )}
        </div>
      )}

      {activeTab === "note" && (
        <div id="p-note">
          {Object.keys(notes).length > 0 ? (
            Object.entries(notes).map(([refId, rec]) => {
              return (
                <div key={refId} className="note-item">
                  <h4>{rec.title || refId}</h4>
                  <div className="meta">
                    我的 SOP 笔记 ·{" "}
                    {rec.href && (
                      <Link
                        href={rec.href}
                        style={{ color: "var(--color-primary)" }}
                      >
                        查看 SOP →
                      </Link>
                    )}
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
            fbList.map((f, i) => {
              const tool = toolMap[f.tool];
              return (
                <div key={i} className="note-item">
                  <h4>
                    {tool ? tool.name : f.tool} · {f.type}
                  </h4>
                  <div className="meta">{formatTime(f.ts)}</div>
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
