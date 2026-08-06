import Link from "next/link";
import { content, type Tool } from "@/lib/content";
import { Icon } from "@/lib/icons";
import ToolCard from "@/components/ToolCard";

interface LitModule {
  num: string;
  title: string;
  desc: string;
  tools: string[];
  sops: { tool: string; title: string }[];
}

const MODULES: LitModule[] = [
  {
    num: "一",
    title: "什么是 AI",
    desc: "搞懂大模型 / 生成式 AI 是什么、能做什么、不能做什么，建立正确预期，不再神化也不轻视。",
    tools: ["tongyi", "wenxin"],
    sops: [
      { tool: "tongyi", title: "用通义千问给学生讲清「什么是大模型」" },
      { tool: "wenxin", title: "用文心一格生成 AI 概念配图" },
    ],
  },
  {
    num: "二",
    title: "提示词基础",
    desc: "学会把需求说清楚：角色设定 + 结构化指令 + 给示例 + 逐步迭代，让 AI 听懂你的真实意图。",
    tools: ["deepseek", "glm"],
    sops: [
      { tool: "deepseek", title: "用 DeepSeek 练「角色+任务+约束」三段式提示词" },
      { tool: "glm", title: "用智谱 GLM 把模糊需求改写成清晰指令" },
    ],
  },
  {
    num: "三",
    title: "AI 伦理与安全",
    desc: "理解隐私与数据风险、避免思维惰化、守住内容合规与学术诚信——这是教育场景的红线。",
    tools: ["deepseek", "kimi"],
    sops: [
      { tool: "deepseek", title: "用 DeepSeek 生成「AI 使用须知」卷首语（合规）" },
      { tool: "kimi", title: "用 Kimi 检查一份作业是否过度依赖 AI" },
    ],
  },
  {
    num: "四",
    title: "在学科中应用 AI",
    desc: "把 AI 用到语文 / 数学 / 英语等真实教学环节，而非当玩具——启发式引导，而非直接给答案。",
    tools: ["bishun", "tongyi", "deepseek"],
    sops: [
      { tool: "bishun", title: "用笔神做启发式作文批改（保护原创）" },
      { tool: "tongyi", title: "用通义千问做英语思路引导（不讲答案）" },
    ],
  },
];

const REL_TOOL_SLUGS = ["tongyi", "wenxin", "deepseek", "glm", "kimi", "bishun"];

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "AI通识课 · 教AI导航",
};

export default async function LiteracyPage() {
  const toolMap = await content.getToolMap();
  const relTools = REL_TOOL_SLUGS.map((s) => toolMap[s]).filter(Boolean) as Tool[];

  return (
    <main className="wrap">
      <div className="rel-banner">
        <Icon name="GraduationCap" size={14} className="inline" /> <b>AI通识课</b> 是一套<b>渐进式学习路径</b>（概念 → 提示词 → 伦理 → 学科应用）；想按教学环节<b>找工具</b>去{" "}
        <Link href="/scenes">全部场景 <Icon name="ArrowRight" size={12} className="inline" /></Link>，想看老师亲测<b>分步 SOP</b>去{" "}
        <Link href="/usages">用法库 <Icon name="ArrowRight" size={12} className="inline" /></Link>
      </div>

      <section className="lit-hero">
        <h1>AI通识课</h1>
        <p>
          不是又一个工具列表，而是一套<strong>教人搞懂并善用 AI</strong>的课程。无论你是老师想把 AI
          带进课堂、学生想搞清原理、还是家长想看懂孩子在用啥——跟着四个模块走完，你会对 AI
          有正确预期、会用、也用得安全。
        </p>
        <div className="lit-stats">
          <span>
            <Icon name="BookOpen" size={13} className="inline" /> 4 个模块
          </span>
          <span>
            <Icon name="Wrench" size={13} className="inline" /> 6 个配套工具
          </span>
          <span>
            <Icon name="LinkSimple" size={13} className="inline" /> 每个模块都接真实 SOP
          </span>
        </div>
      </section>

      <section className="block">
        <div className="sec-head">
          <div>
            <h2>课程路径</h2>
            <div className="sub">从概念到落地，循序渐进</div>
          </div>
        </div>
        <div className="lit-mods">
          {MODULES.map((m) => (
            <div className="lit-mod" key={m.num}>
              <div className="lit-mod-head">
                <span className="lit-num">{m.num}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p className="muted">{m.desc}</p>
                </div>
              </div>
              <div className="lit-row">
                <span className="lit-k">相关工具</span>
                {m.tools.map((s) => {
                  const t = toolMap[s];
                  if (!t) return null;
                  return (
                    <Link key={s} href={`/tool/${s}`} className="chip-link">
                      {t.name} <Icon name="ArrowUpRight" size={10} className="inline" />
                    </Link>
                  );
                })}
              </div>
              <div className="lit-row">
                <span className="lit-k">配套 SOP</span>
                {m.sops.map((sop, i) => (
                  <Link key={i} href={`/tool/${sop.tool}`} className="sop-link">
                    ▸ {sop.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="sec-head">
          <div>
            <h2>本路径相关工具</h2>
            <div className="sub">点开任一工具，看它的分步使用路径</div>
          </div>
          <Link className="link-more" href="/scenes">
            按场景找更多 <Icon name="ArrowRight" size={12} className="inline" />
          </Link>
        </div>
        <div className="tool-grid">
          {relTools.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      </section>
    </main>
  );
}
