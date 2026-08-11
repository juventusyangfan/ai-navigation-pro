import { Icon } from "@/lib/icons";

// 常驻来源声明：L2 层级。三句话分别锁死「课在哪 / 不代表官方 / 这页是啥」。
// 必须放在 CTA 之前，决策点之前先说清「这不是我们的课」。
export default function OfficialSourceNote({
  provider = "国家中小学智慧教育平台",
  host,
}: {
  provider?: string;
  host?: string;
}) {
  return (
    <div className="lit-source">
      <Icon name="SealCheck" size={16} className="ic" />
      <div>
        这节课的正文和视频在<b>{provider}</b>
        {host ? `（${host}）` : ""}
        ，本站不提供课程内容、也不代表官方观点。这一页是「智用笔记」给这节课做的导学笔记。
      </div>
    </div>
  );
}
