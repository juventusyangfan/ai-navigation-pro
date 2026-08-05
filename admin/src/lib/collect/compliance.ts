// 教AI导航 · 采集中心 · compliance 纯规则推导
// -----------------------------------------------------------------------------
// 与 prisma/seed-data.ts 中 12 条 curated 工具同一口径：compliance = 使用合规/隐私护栏提示，
// 不是公司法律资质。按 scenes/roles 推导，零 LLM 调用。
import { SCENE_LABEL } from "./contract";

const SCENE_GUARD: Record<string, string> = {
  beikeguihua: "备课规划：课件素材注意版权，引用须标注来源。",
  kejian: "课件制作：课件中勿出现真实学生信息；导出后请人工核对事实。",
  zuoye: "作业考试：提供解题思路而非直接答案，避免助长抄作业；学生数据勿外传。",
  xueqing: "学情评价：学情数据须脱敏，报告由教师复核后使用。",
  jiaxiao: "家校班级：家校沟通话术需教师把关；班级数据注意学生隐私，不公开排名。",
  zixue: "自学答疑：内容适龄；建议启发式引导，避免直接代写代做。",
  keti: "教研课题：课题资料注意脱敏；生成内容需人工把关学术规范。",
  shijian: "综合实践：实践内容适龄；低龄活动家长陪伴，控制屏幕时间。",
};

const ROLE_GUARD: Record<string, string> = {
  老师: "教师端内容须与课堂结合并人工复核。",
  学生: "内容适龄，家长合理管控使用时长。",
  家长: "社区/交流勿泄露孩子真实身份与学校信息。",
  学校管理员: "校园数据须脱敏，统一审核后发送。",
};

/**
 * 由场景 + 角色推导合规护栏文案。
 * 同一场景只产出一条，去重后用空串连接（与 30 条采集块风格一致）。
 */
export function deriveCompliance(scenes: string[], roles: string[]): string {
  const parts = new Set<string>();
  for (const s of scenes) {
    if (SCENE_GUARD[s]) parts.add(SCENE_GUARD[s]);
  }
  for (const r of roles) {
    if (ROLE_GUARD[r]) parts.add(ROLE_GUARD[r]);
  }
  return [...parts].join("");
}

export { SCENE_LABEL };
