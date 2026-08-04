"use client";

import { useState, useEffect } from "react";
import { content, type Scene } from "@/lib/content";
import { Icon } from "@/lib/icons";

const ROLE_OPTIONS = ["老师", "学生", "家长", "学校管理员"] as const;

export default function SubmitPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  useEffect(() => {
    content.getScenes().then(setScenes);
  }, []);

  const SCENE_OPTIONS = scenes.map((s) => ({ key: s.key, name: s.name }));

  const [toolName, setToolName] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedScene, setSelectedScene] = useState("");
  const [tagline, setTagline] = useState("");
  const [sop, setSop] = useState("");

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("已提交，等待审核（原型）");
  };

  return (
    <main className="wrap">
      <div className="form-wrap" style={{ marginTop: "30px" }}>
        <div className="sec-head">
          <div>
            <h2>投稿一个 AI 工具</h2>
            <div className="sub">审核通过后将在对应场景展示，并邀请你撰写使用路径 SOP</div>
          </div>
        </div>
        <div className="form-note">
          <span className="ic">
            <Icon name="Info" size={16} />
          </span>
          <span>
            收录流程：<b>提交 → 编辑审核 → 发布 / 驳回</b>。若含 affiliate 链接将明确标注，绝不误导。
          </span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>工具名称</label>
            <input
              placeholder="如：秘塔写作猫"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>官网链接</label>
            <input
              placeholder="https://"
              value={toolUrl}
              onChange={(e) => setToolUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              适用角色<span className="hint">可多选</span>
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {ROLE_OPTIONS.map((role) => (
                <label key={role} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>适用场景</label>
            <select
              value={selectedScene}
              onChange={(e) => setSelectedScene(e.target.value)}
            >
              <option value="">请选择场景</option>
              {SCENE_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>一句话定位</label>
            <input
              placeholder="它最擅长解决什么"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              你常用的使用路径（SOP）
              <span className="hint">可选，优先收录</span>
            </label>
            <textarea
              placeholder="步骤1：… 步骤2：… 提示词：…"
              value={sop}
              onChange={(e) => setSop(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            提交投稿
          </button>
        </form>
      </div>
    </main>
  );
}
