import ToolsBrowser from "@/components/ToolsBrowser";

export const metadata = {
  title: "全部工具 · 智用笔记",
  description: "按角色、场景、学科、定价筛选，按评分排序，找到最适合你的教育 AI 工具。",
};

export default function ToolsPage() {
  return (
    <main>
      <section className="block">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h1>全部工具</h1>
              <div className="sub">
                按角色、场景、学科、定价筛选，按评分排序，找到最适合你的 AI 工具
              </div>
            </div>
          </div>
          <ToolsBrowser />
        </div>
      </section>
    </main>
  );
}
