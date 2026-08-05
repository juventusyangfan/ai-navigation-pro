"use client";

import { useState } from "react";

interface TagInputProps {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  hint?: string;
}

export default function TagInput({
  label,
  placeholder,
  values,
  onChange,
  suggestions = [],
  hint,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  const remaining = suggestions.filter((s) => !values.includes(s));

  return (
    <div className="field">
      <label>
        {label}
        {hint ? <span className="hint">{hint}</span> : null}
      </label>
      <div className="tag-box">
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button type="button" className="tag-x" onClick={() => remove(v)} aria-label={`移除 ${v}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          value={draft}
          placeholder={placeholder ?? "输入后回车添加"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
        />
      </div>
      {remaining.length > 0 ? (
        <div className="tag-suggest">
          {remaining.map((s) => (
            <button type="button" key={s} className="tag-suggest-item" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
