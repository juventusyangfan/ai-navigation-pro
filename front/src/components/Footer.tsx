import Link from "next/link";
import { Icon } from "@/lib/icons";

export default function Footer() {
  return (
    <footer className="footer-site">
      <div className="wrap">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div>
            <div className="brand-f text-white">智用笔记</div>
            <p className="text-[13px] text-muted max-w-[300px]">
              面向老师/学生/家长的教育AI工具导航 + 使用路径SOP平台
            </p>
          </div>
          <div>
            <h4 className="text-white text-[13.5px] mb-3.5 font-mono tracking-wider">
              探索
            </h4>
            <Link href="/scenes">全部场景</Link>
            <Link href="/usages">用法库</Link>
            <Link href="/literacy">AI通识课</Link>
          </div>
          <div>
            <h4 className="text-white text-[13.5px] mb-3.5 font-mono tracking-wider">
              社区
            </h4>
            <Link href="/submit">投稿</Link>
            <Link href="/profile">个人中心</Link>
          </div>
          <div>
            <h4 className="text-white text-[13.5px] mb-3.5 font-mono tracking-wider">
              关于
            </h4>
            <Link href="/about">关于我们</Link>
            <Link href="/compliance">合规声明</Link>
            <a href="mailto:hi@eanavi.com">联系我们</a>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 pt-5 border-t border-border text-[12px] text-muted">
          <span>© 2026 智用笔记. All rights reserved.</span>
          <span>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal"
            >
              鄂ICP备2026041582号
            </a>
          </span>
          <span>
            Made with <Icon name="Heart" size={12} weight="fill" className="inline text-red" /> for K12 education
          </span>
        </div>
      </div>
    </footer>
  );
}
