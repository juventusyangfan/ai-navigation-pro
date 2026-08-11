import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/lib/icons";

export const metadata: Metadata = {
  title: "合规与来源声明 · 智用笔记",
  description:
    "智用笔记是「国家中小学智慧教育平台」AI 通识课的导学桥接层：只做导学笔记与配套 SOP，不生产、不镜像官方课程，不代表官方观点。",
};

export default function CompliancePage() {
  return (
    <main className="wrap py-8">
      <nav className="crumb">
        <Link href="/">首页</Link>
        <span>/</span>
        <b>合规与来源声明</b>
      </nav>

      <section className="lit-hero">
        <h1>合规与来源声明</h1>
        <p>
          智用笔记是「国家中小学智慧教育平台」AI 通识课的导学桥接层。这一页说清我们做了什么、没做什么，以及内容从哪里来。
        </p>
      </section>

      <section className="block">
        <div className="card-stack">
          <section className="card">
            <h3>
              <span className="dot" />
              课程从哪里来
            </h3>
            <p style={{ fontSize: 14 }}>
              原理课正文与视频均在
              <b> 国家中小学智慧教育平台</b>
              （basic.smartedu.cn），由平台官方提供、免费、需在平台注册登录后观看。本站
              <b>不生产、不镜像、不改写</b>
              任何官方课程正文，只给每节课配一句「你为什么要看」、一段本土化点评，和看完就能上手的分步 SOP。
            </p>
          </section>

          <section className="card">
            <h3>
              <span className="dot" />
              我们不代表官方
            </h3>
            <div className="compliance">
              <Icon name="ShieldCheck" size={18} className="ic" />
              <div>
                本站与国家中小学智慧教育平台之间不存在「认证 / 授权 / 合作 / 指定」关系。本站观点仅代表编辑部，不代表任何官方立场，也不对课程内容的准确性、时效性负责。
              </div>
            </div>
          </section>

          <section className="card">
            <h3>
              <span className="dot" />
              我们不用官方标识
            </h3>
            <p style={{ fontSize: 14 }}>
              本站不使用国徽、党徽、教育部标识，也不复刻官方平台的 logo、主色与字体。在视觉上刻意与官方站点保持区隔，避免任何「本站即官方」的误读。
            </p>
          </section>

          <section className="card">
            <h3>
              <span className="dot" />
              我们怎么用你的数据
            </h3>
            <p style={{ fontSize: 14 }}>
              匿名行为统计仅用于改进导学（例如哪些课真被看了）。我们只存
              <b> 匿名设备标识 + 截断的 UA</b>
              ，不存 IP、不存来源页全文、不存你输入给 AI 的提示词正文，也不接入任何第三方分析 SDK。埋点永远不是故障源，失败即静默。
            </p>
          </section>

          <section className="card">
            <h3>
              <span className="dot" />
              链接失效怎么办
            </h3>
            <p style={{ fontSize: 14 }}>
              国家平台改版、课程地址调整是常有的事。若某节课的直达链接失效，页面不会跟着报废：我们会把动手练区提到最前，并保留常驻的「链接打不开？告诉我们」入口。搜索权重不会因单节课下架而受损。
            </p>
          </section>

          <section className="card">
            <h3>
              <span className="dot" />
              联系我们
            </h3>
            <p style={{ fontSize: 14 }}>
              内容纠错、死链反馈、合作咨询，都可以通过{" "}
              <a href="mailto:hi@eanavi.com" className="link-more">
                hi@eanavi.com
              </a>{" "}
              联系。
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
