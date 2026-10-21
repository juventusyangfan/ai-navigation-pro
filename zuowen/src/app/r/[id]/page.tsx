import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/store";
import { decryptText } from "@/lib/crypto";
import { bandOf } from "@/lib/grade";
import { DIM_LABEL, DIM_MAX, type DimKey, type Report } from "@/lib/rubric";
import { publicAssetExists } from "@/lib/assets";
import QrCard from "@/components/QrCard";

export const dynamic = "force-dynamic";

const LEVEL_CLASS: Record<string, string> = {
  优秀: "l1",
  良好: "l2",
  合格: "l3",
  待提升: "l4",
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) notFound();

  const row = await prisma.essayReview.findUnique({ where: { id } });
  if (!row) notFound();

  let report: Report;
  try {
    report = JSON.parse(row.report) as Report;
  } catch {
    notFound();
  }

  const text = decryptText(row.encText);
  const band = bandOf(row.grade);
  const R = 46;
  const C = 2 * Math.PI * R;
  const off = C * (1 - Math.min(100, Math.max(0, report.total)) / 100);
  const dimKeys: DimKey[] = ["content", "structure", "language", "norm"];

  // 二维码图片还没上传时不要渲染 <img>，否则是一个破图图标
  const mpRaw = process.env.NEXT_PUBLIC_MP_QR || "";
  const workRaw = process.env.NEXT_PUBLIC_WORK_QR || "";
  const qrMp = publicAssetExists(mpRaw) ? mpRaw : "";
  const qrWork = publicAssetExists(workRaw) ? workRaw : "";

  return (
    <div className="wrap">
      <div className="nav">
        <Link href="/" className="back">
          ← 再测一篇
        </Link>
        <span className="name">{band.label} · {report.charCount} 字</span>
      </div>

      <section className="card">
        <div className="score-box">
          <div className="ring">
            <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true">
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#dd6034" />
                  <stop offset="100%" stopColor="#f0a04b" />
                </linearGradient>
              </defs>
              <circle cx="54" cy="54" r={R} fill="none" stroke="#f3ece2" strokeWidth="9" />
              <circle
                cx="54"
                cy="54"
                r={R}
                fill="none"
                stroke="url(#rg)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={off}
              />
            </svg>
            <div className="num">
              <b>{report.total}</b>
              <span>总分 100</span>
            </div>
          </div>
          <div className="score-meta">
            <div className={`level ${LEVEL_CLASS[report.level] ?? "l2"}`}>{report.level}</div>
            <div className="sub">
              {band.label}参考篇幅 {band.minChars}—{band.maxChars} 字，本篇 {report.charCount} 字
            </div>
            {report.genre && <div className="sub">文体：{report.genre}</div>}
          </div>
        </div>
      </section>

      {report.summary && (
        <section className="card">
          <h2 className="card-t">
            <i className="dot" />
            一句话总评
          </h2>
          <p className="summary">{report.summary}</p>
        </section>
      )}

      <section className="card">
        <h2 className="card-t">
          <i className="dot" />
          四个维度
        </h2>
        <div className="dims">
          {dimKeys.map((k) => {
            const max = DIM_MAX[k];
            const v = report.dims?.[k] ?? 0;
            const pct = Math.round((v / max) * 100);
            return (
              <div className="dim" key={k}>
                <span className="name">{DIM_LABEL[k]}</span>
                <span className="bar">
                  <i style={{ width: `${pct}%` }} />
                </span>
                <span className="val">
                  {v}/{max}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {report.highlights?.length > 0 && (
        <section className="card">
          <h2 className="card-t">
            <i className="dot" />
            写得好的地方
          </h2>
          {report.highlights.map((h, i) => (
            <div className="item" key={i}>
              <blockquote className="quote">{h.quote}</blockquote>
              <p>{h.why}</p>
            </div>
          ))}
        </section>
      )}

      {report.advice?.length > 0 && (
        <section className="card">
          <h2 className="card-t">
            <i className="dot" />
            可以怎么改
          </h2>
          {report.advice.map((a, i) => (
            <div className="item" key={i}>
              <span className="lab">第 {i + 1} 处</span>
              <p>{a.issue}</p>
              <p className="fix">
                <b>这样改：</b>
                {a.how}
              </p>
            </div>
          ))}
        </section>
      )}

      {report.nextStep && (
        <section className="card">
          <h2 className="card-t">
            <i className="dot" />
            下一步练什么
          </h2>
          <div className="next">
            <span className="ico">✏️</span>
            <p>{report.nextStep}</p>
          </div>
        </section>
      )}

      {text && (
        <section className="card">
          <details className="origin">
            <summary>看看识别出的原文（图片上传时请核对有没有认错）</summary>
            <pre>{text}</pre>
          </details>
        </section>
      )}

      <section className="cta">
        <h3>想让孩子的作文有人带着改？</h3>
        <p>
          关注「树蕙伴学」，每周会有一次写作方法的小分享；也可以加老师微信，把孩子这篇的具体想法聊一聊。
        </p>
        <div className="qrs">
          <QrCard src={qrMp} label="关注树蕙伴学" />
          <QrCard src={qrWork} label="加老师企业微信" />
        </div>
      </section>

      <Link href="/" className="btn ghost" style={{ display: "flex", textDecoration: "none" }}>
        再测一篇
      </Link>

      <footer className="ft">
        <p>
          本页点评由程序自动生成，仅用于写作练习参考，不是考试评分，也不作为任何评价依据，不作任何结果承诺。
        </p>
        <p>如需删除本次作文与点评，请联系我们，将在 7 个工作日内处理。</p>
      </footer>
    </div>
  );
}
