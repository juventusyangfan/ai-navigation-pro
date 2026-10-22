"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getJson, postJson } from "@/lib/api-client";
import QrCard from "@/components/QrCard";

/** 二维码走构建期注入的环境变量，图没放也不至于渲染出破图 */
const QR_MP = process.env.NEXT_PUBLIC_MP_QR || "/qr/mp.png";
const QR_WORK = process.env.NEXT_PUBLIC_WORK_QR || "/qr/work.png";

const GRADES = [1, 2, 3, 4, 5, 6];
const GRADES_CN = ["一", "二", "三", "四", "五", "六"];
const MAX_IMAGES = 3;
const CONSENT_KEY = "zw_consent_v1";

const LOADING_STEPS = [
  "正在逐字读孩子的作文…",
  "正在看篇幅、分段和用词…",
  "正在想该怎么跟您说清楚…",
];

/** 与后端同一套口径：去掉标点与空白后计数 */
const PUNCT = /[\s，。！？、；：“”‘’（）《》〈〉…—～·,.!?;:"'()[\]{}<>\-—~]/g;
function countChars(s: string) {
  return s.replace(PUNCT, "").length;
}

/** 长边压到 1600、JPEG 0.82：一张手写照片通常在 200-400KB，模型识别足够 */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持图片处理");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function Page() {
  const router = useRouter();
  const [grade, setGrade] = useState(0);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 本机识别码：家长要放开次数时，把这个码发给老师即可。
  // 拿不到就不显示 —— 它只是辅助信息，不该让页脚出现一块「加载失败」。
  const [dev, setDev] = useState<{ display: string; limited: boolean; remaining: number | null } | null>(
    null,
  );
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let alive = true;
    getJson<{ code: string; display: string; limited: boolean; remaining: number | null }>("/api/device")
      .then((r) => {
        if (alive && r.ok) setDev({ display: r.data.display, limited: r.data.limited, remaining: r.data.remaining });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const copyCode = useCallback(async () => {
    if (!dev) return;
    try {
      await navigator.clipboard.writeText(dev.display);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      /* 非 https 或用户拒绝授权时静默失败，家长仍可手抄 */
    }
  }, [dev]);

  useEffect(() => {
    try {
      if (localStorage.getItem(CONSENT_KEY) === "1") setConsent(true);
      else setShowPrivacy(true);
    } catch {
      setShowPrivacy(true);
    }
  }, []);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 2600);
    return () => clearInterval(t);
  }, [loading]);

  const chars = countChars(text);

  const pickPhoto = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setBusyPhoto(true);
    try {
      const room = MAX_IMAGES - images.length;
      const picked = Array.from(files).slice(0, Math.max(0, room));
      if (!picked.length) {
        setError(`最多上传 ${MAX_IMAGES} 张照片`);
        return;
      }
      const out: string[] = [];
      for (const f of picked) {
        if (!/^image\//.test(f.type)) {
          setError("请选择图片文件");
          continue;
        }
        try {
          out.push(await compressImage(f));
        } catch {
          setError("这张照片读不出来，换成 JPG 或先截图后再上传试试");
        }
      }
      if (out.length) setImages((prev) => [...prev, ...out].slice(0, MAX_IMAGES));
    } finally {
      setBusyPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [images.length]);

  const canSubmit =
    !loading &&
    !busyPhoto &&
    consent &&
    grade > 0 &&
    (mode === "text" ? chars >= 10 : images.length > 0);

  async function submit() {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res = await postJson<{ id: string }>("/api/evaluate", {
        grade,
        title: title.trim(),
        text: mode === "text" ? text : "",
        images: mode === "image" ? images : [],
        consent: true,
      });
      if (!res.ok) {
        setError(res.message);
        setLoading(false);
        return;
      }
      router.push(`/r/${res.data.id}`);
      // 不清 loading：跳转期间保持"分析中"的视觉，避免闪一下表单
    } catch {
      setError("提交失败了，请稍后再试");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="wrap">
        <div className="hd">
          <h1>正在给孩子看这篇作文</h1>
          <p>通常十几秒就好，请不要关掉页面</p>
        </div>
        <div className="card">
          <div className="loading">
            <div className="spinner" />
            <p>{LOADING_STEPS[step]}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="hd">
        <span className="badge">树蕙伴学 · 写作水平测评</span>
        <h1>看看孩子这篇作文，写得怎么样</h1>
        <p>把孩子写的作文拍下来或粘贴进来，就能拿到一份具体的点评：分项分数、写得好的地方，以及今晚就能动手改的两三处。</p>
      </header>

      <section className="card">
        <h2 className="card-t">
          <i className="dot" />
          孩子在读几年级
        </h2>
        <div className="grades">
          {GRADES.map((g, i) => (
            <button
              key={g}
              type="button"
              className={`grade${grade === g ? " on" : ""}`}
              onClick={() => setGrade(g)}
            >
              {GRADES_CN[i]}年级
            </button>
          ))}
        </div>
        <p className="tip">不同年级的评判标准不一样，选对了分数才准</p>
      </section>

      <section className="card">
        <h2 className="card-t">
          <i className="dot" />
          作文内容
          <span className="hint">
            {mode === "text" ? `${chars} 字` : `${images.length}/${MAX_IMAGES} 张`}
          </span>
        </h2>

        <div className="tabs">
          <button
            type="button"
            className={`tab${mode === "text" ? " on" : ""}`}
            onClick={() => setMode("text")}
          >
            粘贴文字
          </button>
          <button
            type="button"
            className={`tab${mode === "image" ? " on" : ""}`}
            onClick={() => setMode("image")}
          >
            上传照片
          </button>
        </div>

        <input
          className="field"
          style={{ marginBottom: 10 }}
          placeholder="作文题目（选填）"
          value={title}
          maxLength={40}
          onChange={(e) => setTitle(e.target.value)}
        />

        {mode === "text" ? (
          <textarea
            className="field"
            placeholder="把作文正文粘贴到这里，从正文第一句开始就行，不用带题目。"
            value={text}
            maxLength={2500}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <>
            <div
              className="drop"
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            >
              <b>{busyPhoto ? "正在处理照片…" : "拍照或选一张作文照片"}</b>
              <span>一页一张，字迹清楚就行；最多 {MAX_IMAGES} 张</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => pickPhoto(e.target.files)}
            />
            {images.length > 0 && (
              <div className="thumbs">
                {images.map((src, i) => (
                  <div className="thumb" key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`第 ${i + 1} 张`} />
                    <button
                      type="button"
                      aria-label="删除"
                      onClick={() => setImages((prev) => prev.filter((_, k) => k !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="tip">照片只用来识别文字，不会保存原件</p>
          </>
        )}

        {error && <div className="alert">{error}</div>}

        <button className="btn" type="button" disabled={!canSubmit} onClick={submit}>
          {grade === 0
            ? "先选一个年级"
            : mode === "text" && chars < 10
              ? "还差几个字"
              : mode === "image" && images.length === 0
                ? "先上传一张作文照片"
                : "开始测评"}
        </button>

        {!consent && <p className="tip">需要先阅读并同意《儿童个人信息处理规则》</p>}
      </section>

      {/* 引流位：表单之后、页脚之前，这一屏剩下的空白用在这里 */}
      <section className="card follow">
        <h2 className="card-t">
          <i className="dot" />
          关注「树蕙伴学」
        </h2>
        <p className="lead">
          每周一次写作方法的小分享；孩子这篇想有人带着改一改，也可以直接加老师微信。
        </p>
        <div className="qrs light">
          <QrCard src={QR_MP} label="关注树蕙伴学" />
          <QrCard src={QR_WORK} label="加老师企业微信" />
        </div>
      </section>

      <footer className="ft">
        {dev && (
          <p className="devcode">
            本机识别码
            <b>{dev.display}</b>
            <button type="button" onClick={copyCode}>
              {copiedCode ? "已复制" : "复制"}
            </button>
            {dev.limited && dev.remaining !== null && dev.remaining <= 1 && (
              <span className="quota">
                {dev.remaining === 0
                  ? "今天的次数已用完，把这个码发给老师可以多练几篇"
                  : "今天还剩 1 次，想多练可以把这个码发给老师"}
              </span>
            )}
          </p>
        )}
        <p>本工具由程序自动生成点评，仅用于写作练习参考，不是考试评分，也不作为任何评价依据。</p>
        <p>不收集孩子姓名、学校、班级等信息。</p>
      </footer>

      {showPrivacy && (
        <div className="mask" onClick={() => setShowPrivacy(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>儿童个人信息处理规则</h2>
            <ol>
              <li>我们只收集孩子作文的文字内容，用于生成这份点评，不收集姓名、学校、班级等身份信息。</li>
              <li>上传的照片只用于识别文字，识别完成后立即丢弃，不会保存原件。</li>
              <li>识别出的作文正文加密保存，除生成点评外不用于其他用途，不向第三方提供。</li>
              <li>点评由程序自动生成，仅供写作练习参考，不代表任何考试评分或升学评价，也不作任何结果承诺。</li>
              <li>您可随时联系我们删除孩子的作文与点评，我们会在收到后 7 个工作日内物理删除。</li>
            </ol>
            <button
              className="btn"
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(CONSENT_KEY, "1");
                } catch {
                  /* 隐私模式下写不进去也不影响本次使用 */
                }
                setConsent(true);
                setShowPrivacy(false);
              }}
            >
              我已阅读并同意
            </button>
            <p className="tip">点击即表示您作为监护人已阅读并同意上述内容</p>
          </div>
        </div>
      )}
    </div>
  );
}
