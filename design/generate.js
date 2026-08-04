/* 教AI导航平台 · 原型生成器
 * 运行: node generate.js  -> 产出一堆自包含 HTML（每个页面/每个产品一文件）
 */
const fs = require('fs');
const path = require('path');
const CSS = fs.readFileSync(path.join(__dirname, 'assets/styles.css'), 'utf8');
const JS  = fs.readFileSync(path.join(__dirname, 'assets/app.js'), 'utf8');

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- 分类与场景 ---------------- */
const CATS = {
  '教学准备': { icon: '🧭', phase: '课前', desc: '上课前：备课规划、资源搜集与课堂导入设计' },
  '课堂教学': { icon: '🎨', phase: '课中', desc: '在课堂：课件制作、综合实践与课堂互动生成' },
  '评价协同': { icon: '📊', phase: '课后', desc: '下课后：作业考试、学情评价与家校沟通协同' },
  '成长教研': { icon: '📚', phase: '发展', desc: '长期成长：自学答疑、教研课题与专业发展' },
};
const SCENES = [
  { key: 'beikeguihua', name: '备课规划', cat: '教学准备', icon: '📝', roles: ['老师'] },
  { key: 'kejian',      name: '课件制作', cat: '课堂教学', icon: '🎨', roles: ['老师'] },
  { key: 'zuoye',       name: '作业考试', cat: '评价协同', icon: '📋', roles: ['老师', '学生'] },
  { key: 'xueqing',     name: '学情评价', cat: '评价协同', icon: '📈', roles: ['老师', '家长'] },
  { key: 'jiaxiao',     name: '家校班级', cat: '评价协同', icon: '💬', roles: ['老师', '家长'] },
  { key: 'zixue',       name: '自学答疑', cat: '成长教研', icon: '📚', roles: ['学生', '老师'] },
  { key: 'keti',        name: '教研课题', cat: '成长教研', icon: '🔬', roles: ['老师', '学生'] },
  { key: 'shijian',     name: '综合实践', cat: '课堂教学', icon: '🧩', roles: ['老师', '学生'] },
];
const SCENE_NAME = Object.fromEntries(SCENES.map(s => [s.key, s.name]));

/* ---------------- 工具数据 ---------------- */
const TOOLS = [
  {
    slug: 'doubao', name: '豆包', logo: '豆', color: '#2f6bff',
    tagline: '字节跳动出品的中文全能 AI 助手', url: 'https://doubao.com',
    roles: ['老师', '学生', '家长'], scenes: ['beikeguihua', 'kejian', 'jiaxiao', 'zuoye'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页 / APP / 插件', rating: 4.6,
    pros: ['中文语感自然', '支持语音对话', '免费额度充足'],
    cons: ['长文易跑题', '学科深度有限'],
    compliance: '请勿上传含学生真实姓名、肖像的隐私内容；建议学校统一开通教育版账号并制定使用规范。',
    alts: ['deepseek', 'glm'],
    paths: [
      { title: '用豆包做课堂导入（配图）', steps: [
        { action: '让豆包生成情境化导入语 + 生图描述', prompt: '你是一名初中语文老师，请为朱自清《春》设计一段约 2 分钟的课堂导入：先抛一个贴近学生生活的问题，再给出可用于 AI 生图的画面描述（含构图与色调）。', output: '导入讲稿 + 配图提示词', media: { type: 'image', label: '课堂导入配图示意（AI 生成）' } },
        { action: '把生图描述丢进生图工具出图并投屏', prompt: '', output: '可直接投屏的导入图', pitfall: '避免生成带具体校名、班牌的图片，防止信息泄露。' },
      ] },
      { title: '用豆包写家校班级话术', steps: [
        { action: '说明学生情况与沟通目的', prompt: '请以班主任口吻，给一位数学作业连续缺交的学生家长写一段微信：先肯定孩子优点，再委婉说明情况并给出可执行的改进建议，语气温和。', output: '可直接发送的微信话术', pitfall: '涉及学生负面评价时注意措辞，并保留沟通记录。' },
      ] },
    ],
  },
  {
    slug: 'deepseek', name: 'DeepSeek', logo: 'DS', color: '#4d6bfe',
    tagline: '深度推理大模型，擅长逻辑与解题', url: 'https://deepseek.com',
    roles: ['老师', '学生'], scenes: ['zuoye', 'xueqing', 'keti', 'zixue'],
    subjects: ['数学'], pricing: 'Free', platform: '网页 / APP / API', rating: 4.7,
    pros: ['推理能力强', '完全免费', '支持长上下文'],
    cons: ['高峰期易繁忙', '中文润色稍弱'],
    compliance: '出题涉及考试公平，建议仅用于日常练习与复习，不用于正式测验原题生成。',
    alts: ['kimi', 'tongyi'],
    paths: [
      { title: '用 DeepSeek 出一套初三数学期中卷', steps: [
        { action: '明确范围与难度，生成双向细目表', prompt: '你是初三数学备课组长。请按“一元二次方程 / 二次函数 / 旋转 / 圆”四章，出一份期中试卷双向细目表：题型、分值、难度（易:中:难=6:3:1）、对应知识点。', output: '试卷结构表', media: { type: 'file', label: '期中卷命题细目表.md' } },
        { action: '按细目表生成基础题', prompt: '基于上面的细目表，先生成“容易”档的 12 道选择题与 4 道填空题，附答案与解析要点。', output: '基础题 + 答案' },
        { action: '生成中档与压轴题', prompt: '再生成 4 道中等解答题（含过程分步骤）和 1 道压轴综合题，给出评分标准。', output: '中档+压轴题 + 评分标准', pitfall: '务必人工核对答案与知识点覆盖，避免超纲或重复。' },
        { action: '生成卷首语与合规说明', prompt: '写一段卷首语，提醒学生诚信作答、本卷仅用于阶段练习。', output: '卷首语', media: { type: 'file', label: '试卷卷首语（合规）.md' } },
      ] },
      { title: '用 DeepSeek 做错题归因', steps: [
        { action: '粘贴错题请其归因', prompt: '下面是一道学生常错的二次函数题，请分析典型错误原因，并给出 2 道同类变式题用于巩固。', output: '错因分析 + 变式题' },
      ] },
    ],
  },
  {
    slug: 'glm', name: '智谱 GLM', logo: 'GLM', color: '#7c3aed',
    tagline: '国产大模型，文档与 Agent 能力强', url: 'https://zhipuai.cn',
    roles: ['老师', '学生'], scenes: ['keti', 'beikeguihua', 'xueqing'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页 / API', rating: 4.5,
    pros: ['长文档处理稳', '工具调用成熟', '支持智能体'],
    cons: ['免费额度有限', '界面偏专业'],
    compliance: '上传课题资料时注意脱敏；生成的申报书需人工把关学术规范。',
    alts: ['kimi', 'deepseek'],
    paths: [
      { title: '用 GLM 写课题申报书框架', steps: [
        { action: '给研究方向让其列框架', prompt: '我正在申报一项市级课题：《核心素养导向的初中跨学科作业设计研究》。请输出申报书标准框架（问题提出、文献综述、研究目标、内容、方法、创新点、预期成果）。', output: '申报书框架', pitfall: '框架仅为脚手架，核心论点须由教师原创。' },
        { action: '逐节扩写并校验', prompt: '请就“研究目标”一节扩写 300 字，语言学术化、可考核。', output: '各节初稿' },
      ] },
    ],
  },
  {
    slug: 'kimi', name: 'Kimi', logo: 'Ki', color: '#0ea5e9',
    tagline: '超长上下文，擅长读文献与整理', url: 'https://kimi.moonshot.cn',
    roles: ['老师', '学生'], scenes: ['keti', 'zixue', 'xueqing'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页 / APP', rating: 4.6,
    pros: ['长文档碾压', '摘要精准', '联网检索'],
    cons: ['深度推理一般', '高峰期限速'],
    compliance: '上传文献注意版权；引用须核对原文页码。',
    alts: ['glm', 'deepseek'],
    paths: [
      { title: '用 Kimi 整理长篇文献', steps: [
        { action: '上传 PDF 让其做结构化摘要', prompt: '请阅读这篇论文，输出：①研究问题 ②方法 ③主要结论 ④可迁移到中学教学的 3 个启示。用表格呈现。', output: '结构化文献卡片' },
        { action: '对比多篇提炼综述', prompt: '把上面 3 篇摘要对比，找出共识与分歧，帮我起草一段文献综述。', output: '文献综述初稿', pitfall: '综述观点需回到原文核对，勿直接照搬生成文本。' },
      ] },
    ],
  },
  {
    slug: 'mistral', name: '秘塔写作猫', logo: '秘', color: '#0d9488',
    tagline: '中文纠错与润色，批改好帮手', url: 'https://xiezuocat.com',
    roles: ['老师'], scenes: ['zuoye'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页 / 插件', rating: 4.4,
    pros: ['错别字捕捉强', '润色自然', '批改高效'],
    cons: ['创意弱', '长文需分段'],
    compliance: '仅处理教学文本，勿让学生作文原文外传至公共网络。',
    alts: ['doubao', 'wenxin'],
    paths: [
      { title: '用秘塔写作猫润色评语', steps: [
        { action: '粘贴学生作业评语草稿', prompt: '（在写作猫中粘贴）请把这段评语改得更具体、更有鼓励性，保留“计算步骤完整但符号易错”的要点。', output: '润色后评语', pitfall: '保留教师个人信息与判断，AI 只做语言优化。' },
      ] },
    ],
  },
  {
    slug: 'bishun', name: '笔神', logo: '笔', color: '#db2777',
    tagline: '面向学生的 AI 作文辅导', url: 'https://bishun.com',
    roles: ['学生', '老师'], scenes: ['zuoye', 'zixue'],
    subjects: ['语文'], pricing: 'Freemium', platform: '网页 / APP', rating: 4.3,
    pros: ['作文思路引导', '素材推荐', '批改反馈'],
    cons: ['需防代写', '部分功能付费'],
    compliance: '应设置“启发而非代写”模式，避免学生直接复制成文。',
    alts: ['doubao', 'kimi'],
    paths: [
      { title: '用笔神改一篇作文', steps: [
        { action: '提交作文获取批改', prompt: '（在笔神中提交）请指出这篇记叙文的结构问题与 3 处可优化的描写，并给修改建议，不要直接重写。', output: '批改意见 + 建议', pitfall: '产品须引导“改”而非“替写”，保护原创能力。' },
      ] },
    ],
  },
  {
    slug: 'gamma', name: 'Gamma', logo: 'G', color: '#f59e0b',
    tagline: '一句话生成精美演示文稿', url: 'https://gamma.app',
    roles: ['老师'], scenes: ['kejian'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页', rating: 4.5,
    pros: ['排版惊艳', '生成快', '可导出 PPT'],
    cons: ['中文偶有瑕疵', '需联网'],
    compliance: '课件中勿出现真实学生信息；导出后请人工核对事实。',
    alts: ['canva', 'kejian'],
    paths: [
      { title: '用 Gamma 把大纲变课件', steps: [
        { action: '输入章节大纲生成', prompt: '基于《勾股定理》一节的教学大纲（概念、证明、例题、应用），生成一套 12 页教学课件，风格简洁学术。', output: '课件初稿', media: { type: 'image', label: 'Gamma 课件排版示意' } },
        { action: '调整并导出为 PPT', prompt: '', output: '可下载的 .pptx 模板', media: { type: 'file', label: '勾股定理课件模板.pptx' }, pitfall: '导出后务必核对例题答案与版式错乱。' },
      ] },
    ],
  },
  {
    slug: 'canva', name: 'Canva', logo: 'C', color: '#e11d48',
    tagline: '海量模板的视觉设计工具', url: 'https://canva.com',
    roles: ['老师', '学生'], scenes: ['kejian'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页 / APP', rating: 4.4,
    pros: ['模板极多', '易上手', '协作方便'],
    cons: ['AI 能力弱于专用', '高级素材付费'],
    compliance: '使用正版素材；学生作品注意肖像权。',
    alts: ['gamma', 'jianying'],
    paths: [
      { title: '用 Canva 做课堂海报', steps: [
        { action: '选教育模板改文字', prompt: '（在 Canva 中）搜索“读书海报”模板，替换为班级共读活动信息。', output: '海报设计稿' },
      ] },
    ],
  },
  {
    slug: 'jianying', name: '剪映', logo: '剪', color: '#111827',
    tagline: '全民易用的视频剪辑与 AI 成片', url: 'https://capcut.cn',
    roles: ['老师'], scenes: ['shijian'],
    subjects: ['综合'], pricing: 'Free', platform: 'APP / 桌面', rating: 4.5,
    pros: ['免费', '字幕/配音自动化', '模板多'],
    cons: ['精细控制弱', '水印（免费）'],
    compliance: '微课中不得出现未成年学生正面特写而不经授权。',
    alts: ['canva', 'gamma'],
    paths: [
      { title: '用剪映做一节微课', steps: [
        { action: '用“图文成片”生成初剪', prompt: '（剪映 AI）把《光的折射》讲解稿生成带配音的短视频初稿。', output: '微课初稿', media: { type: 'video', label: '《光的折射》微课演示' } },
        { action: '加字幕与转场精修', prompt: '', output: '成片', pitfall: 'AI 配音可能念错术语，逐句核对字幕。' },
      ] },
    ],
  },
  {
    slug: 'wenxin', name: '文心一言', logo: '文', color: '#2563eb',
    tagline: '百度大模型，中文知识广', url: 'https://yiyan.baidu.com',
    roles: ['老师', '学生'], scenes: ['jiaxiao', 'zuoye', 'keti'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页 / APP', rating: 4.3,
    pros: ['知识面广', '插件丰富', '国产化'],
    cons: ['深度推理一般', '长文偶散'],
    compliance: '家校班级话术需教师把关；学生内容注意适龄。',
    alts: ['doubao', 'glm'],
    paths: [
      { title: '用文心一言拟家长通知', steps: [
        { action: '给出活动信息生成通知', prompt: '请写一则家长会通知：时间本周五 19:00、地点本班教室、议程含期中分析与家庭教育分享，语气正式亲切。', output: '通知文案' },
      ] },
    ],
  },
  {
    slug: 'tongyi', name: '通义千问', logo: '通', color: '#0891b2',
    tagline: '阿里大模型，答疑与多模态', url: 'https://tongyi.aliyun.com',
    roles: ['学生', '老师'], scenes: ['zixue', 'beikeguihua'],
    subjects: ['英语'], pricing: 'Free', platform: '网页 / APP', rating: 4.4,
    pros: ['免费', '多模态', '英文强'],
    cons: ['复杂推理一般'],
    compliance: '英语口语练习建议学生自主使用，教师定期检查使用记录。',
    alts: ['kimi', 'deepseek'],
    paths: [
      { title: '用通义做英语答疑', steps: [
        { action: '拍照/输入题目求讲解', prompt: '请讲解这道英语完形填空的解题思路，并标注涉及的语法点，不要只给答案。', output: '讲解 + 语法点', pitfall: '引导学生理解而非直接抄答案。' },
      ] },
    ],
  },
  {
    slug: 'wenku', name: '文库 AI', logo: '库', color: '#475569',
    tagline: '百度文库 AI，资料与总结', url: 'https://wenku.baidu.com',
    roles: ['老师', '学生'], scenes: ['beikeguihua', 'zuoye'],
    subjects: ['综合'], pricing: 'Freemium', platform: '网页', rating: 4.2,
    pros: ['资料库大', '总结快', '可出题'],
    cons: ['质量参差', '部分付费'],
    compliance: '引用资料需标注来源；注意版权与适龄。',
    alts: ['kimi', 'doubao'],
    paths: [
      { title: '用文库 AI 汇总备课资料', steps: [
        { action: '上传/检索资料生成摘要', prompt: '请基于检索到的《苏州园林》教学资料，生成一份 5 分钟备课要点（重点、难点、活动设计）。', output: '备课要点', pitfall: '资料真实性需教师核实，勿盲目采信。' },
      ] },
    ],
  },
];
const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.slug, t]));
const toolsByScene = k => TOOLS.filter(t => t.scenes.includes(k));

/* ---------------- 用法库数据 ---------------- */
const USAGES = [
  { id: 'u1', title: '用豆包生成课堂导入（配图）', scene: 'beikeguihua', role: '老师', subj: '综合', tool: 'doubao', pick: true, useful: 128, collect: 64, steps: 3, summary: '情境提问 + AI 配图，3 分钟搞定一节课的开场。' },
  { id: 'u2', title: '用 DeepSeek 出一套初三数学期中卷', scene: 'zuoye', role: '老师', subj: '数学', tool: 'deepseek', pick: true, useful: 256, collect: 131, steps: 4, summary: '细目表 → 分层命题 → 评分标准，附合规卷首语。' },
  { id: 'u3', title: '用 Gamma 把大纲变课件', scene: 'kejian', role: '老师', subj: '综合', tool: 'gamma', pick: false, useful: 92, collect: 47, steps: 3, summary: '输入章节大纲，一键生成可导出 PPT 的精美课件。' },
  { id: 'u4', title: '用剪映做一节微课', scene: 'shijian', role: '老师', subj: '综合', tool: 'jianying', pick: false, useful: 73, collect: 39, steps: 2, summary: '图文成片 + 字幕精修，零基础产出短视频。' },
  { id: 'u5', title: '用秘塔写作猫润色评语', scene: 'zuoye', role: '老师', subj: '综合', tool: 'mistral', pick: false, useful: 58, collect: 22, steps: 2, summary: '把生硬草稿改成具体、鼓励性评语。' },
  { id: 'u6', title: '用 Kimi 整理长篇文献', scene: 'keti', role: '老师', subj: '综合', tool: 'kimi', pick: true, useful: 141, collect: 70, steps: 3, summary: '上传 PDF 出结构化卡片，多篇对比写综述。' },
  { id: 'u7', title: '用笔神帮学生改作文', scene: 'zixue', role: '学生', subj: '语文', tool: 'bishun', pick: false, useful: 64, collect: 28, steps: 3, summary: '启发式批改，保护原创而非代写。' },
  { id: 'u8', title: '用通义千问做英语答疑', scene: 'zixue', role: '学生', subj: '英语', tool: 'tongyi', pick: false, useful: 88, collect: 41, steps: 2, summary: '讲思路不讲答案，引导真正理解。' },
  { id: 'u9', title: '用智谱 GLM 写课题申报书', scene: 'keti', role: '老师', subj: '综合', tool: 'glm', pick: false, useful: 77, collect: 35, steps: 3, summary: '标准框架 + 逐节扩写，学术规范需把关。' },
];

/* ---------------- 通用片段 ---------------- */
const NAV = active => `
<header class="site"><div class="wrap nav">
  <a class="brand" href="index.html"><span class="logo">教</span><span>教AI导航<span class="logo-sub">·</span></span></a>
  <nav class="nav-links">
    <a href="index.html" class="${active==='home'?'active':''}">首页</a>
    <a href="scenes.html" class="${active==='scenes'?'active':''}">全部场景</a>
    <a href="usages.html" class="${active==='usages'?'active':''}">用法库</a>
    <a href="ailiteracy.html" class="${active==='literacy'?'active':''}">AI通识课</a>
    <a href="submit.html" class="${active==='submit'?'active':''}">投稿</a>
  </nav>
  <div class="nav-right">
    <form class="searchbar" action="index.html" method="get"><span>🔍</span><input name="q" placeholder="搜工具 / 场景 / 用法…"></form>
    <span id="ea-userbox"></span>
  </div>
</div></header>`;

const FOOTER = `
<footer class="site"><div class="wrap">
  <div class="cols">
    <div><div class="brand-f"><span class="logo" style="width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--primary),#7c3aed);color:#fff;display:grid;place-items:center">教</span>教AI导航</div>
      <p class="desc">教育垂类的 AI 工具导航站：不止帮你找到工具，更教你怎么用在课堂。</p></div>
    <div><h4>导航</h4><a href="index.html">首页</a><a href="scenes.html">全部场景</a><a href="usages.html">用法库</a><a href="ailiteracy.html">AI通识课</a><a href="submit.html">投稿工具</a></div>
    <div><h4>角色</h4><a href="scenes.html?role=teacher">教师</a><a href="scenes.html?role=student">学生</a><a href="scenes.html?role=parent">家长</a><a href="scenes.html?role=admin">学校管理员</a></div>
    <div><h4>关于</h4><a href="#">产品理念</a><a href="#">内容规范</a><a href="#">商务合作</a></div>
  </div>
  <div class="legal"><span>© 2026 教AI导航 · 原型演示</span><span>教育场景标注适龄与数据风险 · affiliate 明示</span></div>
</div></footer>`;

const LOGIN_MODAL = `
<div class="modal-overlay" id="ea-login"><div class="modal">
  <button class="modal-close" aria-label="关闭">×</button>
  <h3>登录教AI导航</h3><p class="sub">原型用本地模拟登录，正式版将接入账号体系</p>
  <form id="ea-login-form">
    <div class="field"><label>昵称</label><input id="ea-name" placeholder="如：李老师" autocomplete="off"></div>
    <div class="field"><label>我是</label><select id="ea-role"><option value="teacher">教师</option><option value="student">学生</option><option value="parent">家长</option><option value="admin">学校管理员</option></select></div>
    <button class="btn btn-primary btn-block" type="submit">进入</button>
  </form>
</div></div>`;

const FB_MODAL = `
<div class="modal-overlay" id="ea-fb"><div class="modal">
  <button class="modal-close" aria-label="关闭">×</button>
  <h3>反馈 / 纠错</h3><p class="sub">帮我们改进这个工具的 SOP</p>
  <form id="ea-fb-form">
    <input type="hidden" id="ea-fb-tool">
    <div class="field"><label>类型</label><select id="ea-fb-type"><option>补充使用建议</option><option>步骤纠错</option><option>合规 / 风险提示</option><option>好评</option></select></div>
    <div class="field"><label>内容</label><textarea id="ea-fb-text" placeholder="请描述你的建议或发现的问题…"></textarea></div>
    <button class="btn btn-primary btn-block" type="submit">提交反馈</button>
  </form>
</div></div>`;

function shell({ title, active, body, page = '', slug = '', extraScript = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · 教AI导航（原型）</title>
<style>${CSS}</style>
</head>
<body data-page="${page}" data-slug="${slug}">
${NAV(active)}
<main class="wrap">
${body}
</main>
${FOOTER}
${LOGIN_MODAL}
${FB_MODAL}
<script>${JS}</script>
${extraScript ? `<script>${extraScript}</script>` : ''}
</body>
</html>`;
}

/* ---------------- 标签渲染 ---------------- */
function priceTag(p) { return `<span class="price ${p}">${p === 'Free' ? '免费' : p === 'Freemium' ? '免费+增值' : p === 'Paid' ? '付费' : '企业版'}</span>`; }
function roleTags(roles) { return roles.map(r => `<span class="tag role">${r}</span>`).join(''); }
function sceneTags(keys) { return keys.map(k => `<a class="tag scene" href="scene-${k}.html">${SCENE_NAME[k] || k}</a>`).join(''); }
function subjTags(subs) { return subs.map(s => `<span class="tag subj">${s}</span>`).join(''); }
function roleClass(r) { return r === '老师' ? 'teacher' : r === '学生' ? 'student' : r === '家长' ? 'parent' : 'admin'; }

function mediaHtml(m) {
  if (!m) return '';
  if (m.type === 'image') return `<div class="step-media"><div class="ph">🖼️ ${esc(m.label)}</div><div class="cap">配图示意 · 点击可放大（原型占位）</div></div>`;
  if (m.type === 'video') return `<div class="step-media vid"><div class="ph">🎬 ${esc(m.label)}</div><div class="play">▶</div><div class="cap">视频演示（原型占位）</div></div>`;
  if (m.type === 'file') return `<div class="att"><span class="ic">📎</span><div><b>${esc(m.label)}</b><small>课件模板 · 点击下载</small></div><span class="dl">下载</span></div>`;
  return '';
}

/* ---------------- 页面：首页 ---------------- */
function renderHome() {
  const totalTools = TOOLS.length;
  const totalSops = USAGES.length;
  const totalScenes = SCENES.length;

  const sceneCards = SCENES.map(s => {
    const roles = s.roles.map(r => `<span class="rb rb-${roleClass(r)}">${r}</span>`).join('');
    const rep = TOOLS.filter(t => (t.scenes || []).includes(s.key)).slice(0, 2).map(t => `<span class="rt">${esc(t.name)}</span>`).join('');
    const sopN = USAGES.filter(x => x.scene === s.key).length;
    return `<div class="scene-card" data-roles="${s.roles.join(',')}">
      <a class="sc-main" href="scene-${s.key}.html">
        <div class="ic">${s.icon}</div><h3>${s.name}</h3>
        <div class="cnt">${toolsByScene(s.key).length} 个工具</div>
        <span class="arrow">→</span>
      </a>
      <div class="scene-roles">${roles}</div>
      ${rep ? `<div class="scene-rep">代表工具：${rep}</div>` : ''}
      ${sopN ? `<a class="scene-sop-link" href="usages.html?scene=${s.key}">📘 ${sopN} 个用法 SOP →</a>` : ''}
    </div>`;
  }).join('');

  const homeRoleTabs = `
    <div class="role-tabs" style="margin:6px 0 18px">
      <button class="active" data-role="all">全部角色</button>
      <button data-role="老师">老师</button>
      <button data-role="学生">学生</button>
      <button data-role="家长">家长</button>
    </div>`;

  const trending = TOOLS.slice(0, 6).map(toolCard).join('');
  const latest = TOOLS.slice(6).map(toolCard).join('');

  /* Spotlight: pick the first editor-pick usage */
  const spotUsage = USAGES.find(u => u.pick) || USAGES[0];
  const spotTool = TOOL_MAP[spotUsage.tool];

  const body = `
  <section class="hero">
    <h1>老师家长的 <span class="hl">AI 工具地图</span><br>不止找到，更教你怎么用</h1>
    <p>按角色与教学场景整理 AI 工具，每个工具都配「分步使用路径 + 可复制提示词」，让 AI 真正落进课堂。</p>
    <form class="hero-search" action="index.html" method="get"><div class="searchbar" style="width:100%"><span>🔍</span><input name="q" placeholder="试试搜：初三数学 / 评语 / 课件"></div><button class="btn btn-primary" type="submit">搜索</button></form>
    <div class="hero-chips">${SCENES.slice(0, 6).map(s => `<a class="chip" href="scene-${s.key}.html">${s.name}</a>`).join('')}</div>
    <div class="term-prompt"><span class="tp-arrow">❯</span> 试试说「帮我找能做课件的 AI 工具」<span class="tp-cursor"></span></div>
  </section>

  <div class="stats-ticker">
    <div class="st-item"><div class="st-val">${totalTools}</div><div class="st-lbl">收录工具</div></div>
    <div class="st-item"><div class="st-val">${totalSops}</div><div class="st-lbl">使用路径 SOP</div></div>
    <div class="st-item"><div class="st-val">${totalScenes}</div><div class="st-lbl">教学场景</div></div>
    <div class="st-item"><div class="st-val">${SCENES.map(s=>s.roles).flat().filter((v,i,a)=>a.indexOf(v)===i).length}</div><div class="st-lbl">覆盖角色</div></div>
  </div>

  <section class="block" style="padding-top:28px">
    <div class="sec-head"><div><h2>按教学场景找工具</h2><div class="sub">先选身份，再挑场景：点卡片直达对应工具</div></div><a class="link-more" href="scenes.html">查看全部场景 →</a></div>
    ${homeRoleTabs}
    <div class="bento-grid">${sceneCards}</div>
  </section>

  <div class="divider-geo"></div>

  <section class="block" style="padding-top:28px">
    <div class="sec-head"><div><h2>精选用法推荐</h2><div class="sub">帮你看到工具怎么真正用起来</div></div><a class="link-more" href="usages.html">逛用法库 →</a></div>
    <div class="spotlight">
      <a class="spotlight-main" href="tool-${spotUsage.tool}.html">
        <span class="sm-label">◆ 编辑精选</span>
        <h3>${esc(spotUsage.title)}</h3>
        <p>${esc(spotUsage.summary)}</p>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
          <span style="font-family:var(--font-mono);font-size:12px;color:var(--primary)">${esc(spotUsage.steps)} 步操作</span>
          <span style="color:var(--muted)">·</span>
          <span style="font-size:12px;color:var(--muted)">${esc(spotTool ? spotTool.name : spotUsage.tool)}</span>
        </div>
      </a>
      <div class="spotlight-side">
        ${USAGES.filter(u => u.pick && u.id !== spotUsage.id).slice(0, 2).map(u => {
          const t = TOOL_MAP[u.tool];
          return `<a class="ss-card" href="tool-${u.tool}.html">
            <div class="ss-num">${String(u.steps).padStart(2,'0')}</div>
            <h4>${esc(u.title)}</h4>
            <p>${esc(t ? t.name : u.tool)} · ${esc(u.subj)}</p>
          </a>`;
        }).join('')}
      </div>
    </div>
  </section>

  <section class="block" style="padding-top:10px">
    <a class="feat-cta" href="ailiteracy.html">
      <div class="feat-cta-l"><span class="feat-ico">🎓</span><div><b>AI通识课 · 系统学 AI 基础</b><div class="muted" style="font-weight:400;font-size:12.5px">从「什么是大模型」→「提示词」→「伦理安全」→「学科应用」，一套渐进式学习路径，配工具与 SOP。</div></div></div>
      <span class="feat-go">开始学习 →</span>
    </a>
  </section>

  <section class="block">
    <div class="sec-head"><div><h2>热门用法工具</h2><div class="sub">老师们正在用这些提效</div></div><a class="link-more" href="usages.html">逛用法库 →</a></div>
    <div class="tool-grid">${trending}</div>
  </section>
  <section class="block">
    <div class="sec-head"><div><h2>最新收录</h2></div><a class="link-more" href="submit.html">投稿工具 →</a></div>
    <div class="tool-grid">${latest}</div>
  </section>
  <section class="block">
    <div class="card" style="background:var(--primary-soft);border-color:rgba(0,204,255,.15)">
      <h3 style="color:var(--primary)">📩 每周一封「新工具 + 一个用法 SOP」</h3>
      <p class="muted" style="margin:6px 0 14px">留下邮箱，跟上 AI 助教的最前线。</p>
      <form class="hero-search" onsubmit="EA.toast('已订阅（原型）');return false"><div class="searchbar" style="width:100%"><span>✉️</span><input placeholder="you@school.edu.cn"></div><button class="btn btn-primary" type="submit">订阅</button></form>
    </div>
  </section>`;
  return shell({ title: '首页', active: 'home', body });
}

/* ---------------- 工具卡片 ---------------- */
function toolCard(t) {
  const hasSop = t.paths && t.paths.length;
  return `
  <div class="tool-card">
    <button class="fav-btn" data-slug="${t.slug}" title="收藏">♡</button>
    <a class="tool-top" href="tool-${t.slug}.html">
      <div class="tool-logo" style="background:${t.color}">${t.logo}</div>
      <div><div class="tool-name">${esc(t.name)}</div><div class="tool-tagline">${esc(t.tagline)}</div></div>
    </a>
    <div>${roleTags(t.roles)}</div>
    <div class="tool-meta">${sceneTags(t.scenes)} ${priceTag(t.pricing)}</div>
    ${hasSop ? `<div style="margin-top:4px"><span class="tool-sop-badge">📘 含 ${t.paths.length} 条使用路径</span></div>` : ''}
  </div>`;
}

/* ---------------- 页面：全部场景（角色 + 分类导航） ---------------- */
function renderScenes() {
  const roleTabs = `
    <div class="role-tabs" style="margin-bottom:18px">
      <button class="active" data-role="all">全部角色</button>
      <button data-role="老师">老师</button>
      <button data-role="学生">学生</button>
      <button data-role="家长">家长</button>
      <button data-role="学校管理员">学校管理员</button>
    </div>`;
  const catKeys = Object.keys(CATS);
  const spine = catKeys.map((c, i) => `<a class="phase-chip" href="#cat-${c}"><b>${i + 1}</b><span class="pc-phase">${CATS[c].phase}</span><span class="pc-name">${c}</span></a>`).join('<span class="phase-arrow">→</span>');
  const catNav = catKeys.map((c, i) => `<a href="#cat-${c}" data-cat="${c}"><span class="cn">${CATS[c].icon}</span><span class="cl"><b>${i + 1}</b> ${c}<small>${CATS[c].phase}</small></span></a>`).join('');
  const blocks = catKeys.map((cat, idx) => {
    const list = SCENES.filter(s => s.cat === cat);
    const rolesUnion = [...new Set(list.flatMap(s => s.roles))];
    const sopN = list.reduce((a, s) => a + USAGES.filter(x => x.scene === s.key).length, 0);
    const cards = list.map(s => {
      const roles = s.roles.map(r => `<span class="rb rb-${r === '老师' ? 'teacher' : r === '学生' ? 'student' : r === '家长' ? 'parent' : 'admin'}">${r}</span>`).join('');
      const sop = USAGES.filter(x => x.scene === s.key).length;
      return `<div class="scene-card" data-roles="${s.roles.join(',')}">
        <a class="sc-main" href="scene-${s.key}.html">
          <div class="ic">${s.icon}</div><h3>${s.name}</h3>
          <div class="cnt">${toolsByScene(s.key).length} 个工具</div>
          <div class="scene-roles">${roles}</div>
          <span class="arrow">→</span>
        </a>
        ${sop ? `<a class="scene-sop-link" href="usages.html?scene=${s.key}">📘 ${sop} 个用法 SOP →</a>` : ''}
      </div>`;
    }).join('');
    return `<div class="cat-block" id="cat-${cat}">
      <div class="cat-head">
        <span class="cat-step">${idx + 1}</span>
        <div class="cat-htext">
          <div class="cat-title"><span class="ci">${CATS[cat].icon}</span>${cat}<span class="cat-phase">${CATS[cat].phase}</span></div>
          <p class="cat-desc">${CATS[cat].desc}</p>
        </div>
        <div class="cat-meta"><span>🧩 ${list.length} 个场景</span><span>📘 ${sopN} 个 SOP</span><span>👥 ${rolesUnion.join('、')}</span></div>
      </div>
      <div class="scene-grid">${cards}</div>
    </div>`;
  }).join('');
  const legend = `<div class="role-legend">适用角色：
    <span class="rb rb-teacher">老师</span><span class="rb rb-student">学生</span>
    <span class="rb rb-parent">家长</span><span class="rb rb-admin">学校管理员</span>
    <span class="muted">· 切换上方角色可筛选场景</span></div>`;
  const body = `
  <div class="scenes-hero">
    <h1>全部教学场景</h1>
    <p>按「教学全流程」组织：从课前备课，到课中教学，到课后评价协同，再到长期成长教研。先看你在哪个环节，再找对应的 AI 工具。</p>
    <div class="phase-spine">${spine}</div>
    <div class="rel-banner">🔎 <b>全部场景</b> 帮你按教学环节<b>找到工具</b>；想看老师亲测的<b>分步用法</b>，去 <a href="usages.html">用法库 →</a></div>
  </div>
  ${roleTabs}
  <div class="scenes-layout">
    <nav class="cat-nav">${catNav}</nav>
    <div>
      ${legend}
      ${blocks}
    </div>
  </div>`;
  const extra = `
  // 深链角色
  (function(){const p=new URLSearchParams(location.search).get('role');if(p){const b=document.querySelector('.role-tabs button[data-role="'+p+'"]');b&&b.click();}})();
  // 滚动高亮左侧分类
  (function(){const navs=[...document.querySelectorAll('.cat-nav a')];const blocks=[...document.querySelectorAll('.cat-block')];
    const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){const id=e.target.id.replace('cat-','');navs.forEach(n=>n.classList.toggle('active',n.dataset.cat===id));}});},{rootMargin:'-80px 0px -70% 0px'});
    blocks.forEach(b=>io.observe(b));})();`;
  return shell({ title: '全部场景', active: 'scenes', body, extraScript: extra });
}

/* ---------------- 页面：单场景筛选 ---------------- */
function renderScene(key) {
  const sc = SCENES.find(s => s.key === key) || SCENES[0];
  const tools = toolsByScene(sc.key);
  const cards = tools.map(toolCard).join('') || `<div class="empty"><div class="big">🗂️</div>该场景暂无工具，欢迎投稿。</div>`;
  const body = `
  <div class="crumb"><a href="index.html">首页</a> / <a href="scenes.html">全部场景</a> / <b>${sc.name}</b></div>
  <div class="sec-head"><div><h2>${sc.icon} ${sc.name}</h2><div class="sub">${CATS[sc.cat].desc} · 适用角色：${sc.roles.join('、')}</div></div></div>
  <div class="rel-banner">📘 本场景共 <b>${USAGES.filter(x => x.scene === sc.key).length}</b> 个精选用法 SOP，<a href="usages.html?scene=${sc.key}">查看分步做法 →</a></div>
  <div class="filterbar">
    <div class="filter-group"><span class="lbl">角色</span><div class="filter-opts" id="f-role">
      <span class="fopt active" data-v="all">全部</span><span class="fopt" data-v="老师">老师</span><span class="fopt" data-v="学生">学生</span><span class="fopt" data-v="家长">家长</span></div></div>
    <div class="filter-group"><span class="lbl">定价</span><div class="filter-opts" id="f-price">
      <span class="fopt active" data-v="all">全部</span><span class="fopt" data-v="Free">免费</span><span class="fopt" data-v="Freemium">免费+增值</span><span class="fopt" data-v="Paid">付费</span></div></div>
    <div class="filter-group"><span class="lbl">平台</span><div class="filter-opts" id="f-plat">
      <span class="fopt active" data-v="all">全部</span><span class="fopt" data-v="网页">网页</span><span class="fopt" data-v="APP">APP</span></div></div>
    <div class="filter-count" id="f-count">${tools.length} 个工具</div>
  </div>
  <div class="tool-grid" id="scene-grid">${cards}</div>`;
  const extra = `
  (function(){const grid=document.getElementById('scene-grid');
    function val(g){const a=document.querySelector('#'+g+' .fopt.active');return a?a.dataset.v:'all';}
    function apply(){const role=val('f-role'),price=val('f-price'),plat=val('f-plat');
      let n=0;[...grid.children].forEach(c=>{if(c.classList.contains('empty'))return;
        const ok=(role==='all'||(c.dataset.roles||'').split(',').includes(role))&&(price==='all'||c.dataset.price===price)&&(plat==='all'||(c.dataset.plat||'').includes(plat));
        c.style.display=ok?'':'none';if(ok)n++;});
      document.getElementById('f-count').textContent=n+' 个工具';}
    document.querySelectorAll('.filter-opts').forEach(g=>g.addEventListener('click',e=>{const o=e.target.closest('.fopt');if(!o)return;[...g.children].forEach(x=>x.classList.remove('active'));o.classList.add('active');apply();}));
    // 注入 data 属性：重写卡片携带信息
    const MAP=${JSON.stringify(Object.fromEntries(TOOLS.map(t=>[t.slug,{roles:t.roles,price:t.pricing,plat:t.platform}])))};
    [...grid.children].forEach(c=>{const slug=c.querySelector('.fav-btn')?.dataset.slug;if(slug&&MAP[slug]){c.dataset.roles=MAP[slug].roles.join(',');c.dataset.price=MAP[slug].price;c.dataset.plat=MAP[slug].plat;}});
    apply();})();`;
  return shell({ title: sc.name, active: 'scenes', body, extraScript: extra });
}

/* ---------------- 页面：工具详情 ---------------- */
function renderTool(t) {
  const sopTabs = t.paths.map((p, i) => `<div class="sop-tab ${i === 0 ? 'active' : ''}" data-path="${i}">${esc(p.title)}</div>`).join('');
  const sopPanels = t.paths.map((p, i) => {
    const steps = p.steps.map((s, si) => {
      const promptBox = s.prompt ? `<div class="prompt-box">${esc(s.prompt)}<button class="copy-btn">复制</button></div>` : '';
      const out = s.output ? `<div class="step-output"><b>产出：</b>${esc(s.output)}</div>` : '';
      const pit = s.pitfall ? `<div class="pitfall"><span class="ic">⚠️</span><span>${esc(s.pitfall)}</span></div>` : '';
      return `<div class="step"><div class="step-num">${si + 1}</div><div class="step-body"><div class="step-action">${esc(s.action)}</div>${promptBox}${out}${mediaHtml(s.media)}${pit}</div></div>`;
    }).join('');
    return `<div class="sop-panel" data-path="${i}" style="${i === 0 ? '' : 'display:none'}">${steps}</div>`;
  }).join('');

  const alts = (t.alts || []).map(slug => {
    const a = TOOL_MAP[slug]; if (!a) return '';
    return `<a class="alt-tool" href="tool-${a.slug}.html"><div class="alt-logo" style="background:${a.color}">${a.logo}</div><div><div class="alt-name">${esc(a.name)}</div><div class="alt-tag">${esc(a.tagline)}</div></div><span style="margin-left:auto">→</span></a>`;
  }).join('');

  const body = `
  <div class="crumb"><a href="index.html">首页</a> / <a href="scenes.html">全部场景</a> / ${sceneTags(t.scenes)} / <b>${esc(t.name)}</b></div>
  <div class="detail-head">
    <div class="detail-logo" style="background:${t.color}">${t.logo}</div>
    <div style="flex:1">
      <h1>${esc(t.name)}</h1>
      <div class="detail-tagline">${esc(t.tagline)}</div>
      <div class="detail-actions">
        <a class="btn btn-primary" href="${t.url}" target="_blank" rel="noopener">访问官网 ↗</a>
        <button class="btn btn-ghost fav-btn" data-slug="${t.slug}" style="position:static;width:auto;height:auto;padding:10px 16px">♡ 收藏</button>
        <span class="rate-row"><span class="stars">${'★'.repeat(Math.round(t.rating))}</span><span class="rate-num">${t.rating}</span></span>
      </div>
      <div class="detail-tags">${roleTags(t.roles)} ${sceneTags(t.scenes)} ${subjTags(t.subjects)} ${priceTag(t.pricing)} <span class="tag">${esc(t.platform)}</span></div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <h3><span class="dot"></span>使用路径 SOP <span class="tool-sop-badge" style="margin-left:6px">核心差异件</span></h3>
      <div class="sop-tabs">${sopTabs}</div>
      ${sopPanels}
      <div class="note-box">
        <div class="note-head">📝 我的笔记 <span class="login-hint">（仅自己可见，登录后保存）</span></div>
        <textarea id="ea-note" placeholder="记录你在这个工具上的用法心得、提示词变体…"></textarea>
      </div>
      <div class="fb-row">
        <button class="btn btn-ghost btn-sm" data-fb-tool="${t.slug}">🐞 反馈 / 纠错</button>
        <span class="fb-count" id="ea-fb-count">0 条反馈</span>
      </div>
    </div>
    <div>
      <div class="card aside-card">
        <h3><span class="dot"></span>优势 / 局限</h3>
        <div class="pros-cons">
          <ul class="pc-list pro">${t.pros.map(p => `<li><span class="mk">+</span>${esc(p)}</li>`).join('')}</ul>
          <ul class="pc-list con">${t.cons.map(c => `<li><span class="mk">−</span>${esc(c)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="card aside-card">
        <h3><span class="dot"></span>合规提示</h3>
        <div class="compliance"><span class="ic">🛡️</span><span>${esc(t.compliance)}</span></div>
      </div>
      ${alts ? `<div class="card aside-card"><h3><span class="dot"></span>替代工具</h3>${alts}</div>` : ''}
    </div>
  </div>`;
  const extra = `document.querySelectorAll('.sop-tab').forEach(tb=>tb.onclick=()=>{document.querySelectorAll('.sop-tab').forEach(x=>x.classList.remove('active'));tb.classList.add('active');const i=tb.dataset.path;document.querySelectorAll('.sop-panel').forEach(p=>p.style.display=p.dataset.path===i?'':'none');});`;
  return shell({ title: t.name, active: '', body, page: 'tool', slug: t.slug, extraScript: extra });
}

/* ---------------- 页面：用法库 ---------------- */
function renderUsages() {
  const cards = USAGES.map((u, idx) => {
    const t = TOOL_MAP[u.tool];
    const rb = `<span class="rb rb-${u.role === '老师' ? 'teacher' : u.role === '学生' ? 'student' : 'parent'}">${u.role}</span>`;
    return `<div class="pb-card" data-id="${idx}" data-scene="${u.scene}" data-role="${u.role}" data-subj="${u.subj}" data-useful="${u.useful}" data-collect="${u.collect}">
      <div class="pb-top"><span class="pb-cat">${SCENE_NAME[u.scene]}</span>${u.pick ? '<span class="editor-pick">⭐ 编辑精选</span>' : ''}</div>
      <h3>${esc(u.title)}</h3>
      <p>${esc(u.summary)}</p>
      <div class="pb-meta"><span class="pb-steps">📶 ${u.steps} 步 SOP</span><span class="pb-tool">来自 ${esc(t ? t.name : u.tool)}</span></div>
      <div class="pb-tags">${rb}<span class="rb" style="background:var(--surface-2);color:var(--muted)">${u.subj}</span><a class="rb" style="background:var(--primary-soft);color:var(--primary);text-decoration:none" href="tool-${u.tool}.html">${esc(t ? t.name : u.tool)} ↗</a></div>
      <div class="sp-row">
        <button class="sp-btn" data-kind="useful" data-key="u:${u.id}" data-base="${u.useful}">👍 有用 <b>${u.useful}</b></button>
        <button class="sp-btn" data-kind="collect" data-key="c:${u.id}" data-base="${u.collect}">📌 收藏 <b>${u.collect}</b></button>
      </div>
    </div>`;
  }).join('');
  const body = `
  <div class="rel-banner">📘 <b>用法库</b> 是老师亲测的<b>分步使用 SOP</b>；若想按教学环节<b>浏览工具</b>，请去 <a href="scenes.html">全部场景 →</a></div>
  <div class="sec-head" style="margin-top:22px"><div><h2>用法库 · 分步使用 SOP</h2><div class="sub">「全部场景」找工具，「用法库」学方法：每张卡片都是打开即用的步骤，用 👍有用 / 📌收藏 沉淀优质内容</div></div></div>
  <div class="filterbar">
    <div class="filter-group"><span class="lbl">学科</span><div class="filter-opts" id="f-subj"><span class="fopt active" data-v="all">全部</span><span class="fopt" data-v="综合">综合</span><span class="fopt" data-v="语文">语文</span><span class="fopt" data-v="数学">数学</span><span class="fopt" data-v="英语">英语</span></div></div>
    <div class="filter-group"><span class="lbl">角色</span><div class="filter-opts" id="f-role"><span class="fopt active" data-v="all">全部</span><span class="fopt" data-v="老师">老师</span><span class="fopt" data-v="学生">学生</span><span class="fopt" data-v="家长">家长</span></div></div>
    <div class="filter-group"><span class="lbl">排序</span><select class="sortsel" id="pb-sort"><option value="useful">最有用</option><option value="collect">最多收藏</option><option value="pick">编辑精选优先</option><option value="new">最新</option></select></div>
    <div class="filter-count" id="f-count">${USAGES.length} 条 SOP</div>
  </div>
  <div class="scene-chips"><span class="lbl2">按场景：</span><div class="filter-opts" id="f-scene"><span class="fopt active" data-v="all">全部</span>${SCENES.map(s => `<span class="fopt" data-v="${s.key}">${s.name}</span>`).join('')}</div></div>
  <div class="pb-grid" id="pb-grid">${cards}</div>`;
  const extra = `
  (function(){const grid=document.getElementById('pb-grid');const sort=document.getElementById('pb-sort');
    function val(g){const a=document.querySelector('#'+g+' .fopt.active');return a?a.dataset.v:'all';}
    function apply(){const sc=val('f-scene'),role=val('f-role'),subj=val('f-subj');
      let arr=[...grid.children];
      arr.forEach(c=>{const ok=(sc==='all'||c.dataset.scene===sc)&&(role==='all'||c.dataset.role===role)&&(subj==='all'||c.dataset.subj===subj);c.style.display=ok?'':'none';});
      const vis=arr.filter(c=>c.style.display!=='none');
      const sp=sort.value;
      vis.sort((a,b)=>sp==='collect'?b.dataset.collect-a.dataset.collect:sp==='pick'?( (b.querySelector('.editor-pick')?1:0)-(a.querySelector('.editor-pick')?1:0)||b.dataset.useful-a.dataset.useful):sp==='new'?b.dataset.id-a.dataset.id:a.dataset.useful-b.dataset.useful);
      vis.forEach(c=>grid.appendChild(c));
      document.getElementById('f-count').textContent=vis.length+' 条 SOP';}
    document.querySelectorAll('.filter-opts').forEach(g=>g.addEventListener('click',e=>{const o=e.target.closest('.fopt');if(!o)return;[...g.children].forEach(x=>x.classList.remove('active'));o.classList.add('active');apply();}));
    sort.addEventListener('change',apply);
    (function(){const p=new URLSearchParams(location.search).get('scene');if(p){const b=document.querySelector('#f-scene .fopt[data-v="'+p+'"]');b&&b.click();}})();
    apply();})();`;
  return shell({ title: '用法库', active: 'usages', body, extraScript: extra });
}

/* ---------------- 页面：投稿 ---------------- */
function renderSubmit() {
  const body = `
  <div class="form-wrap" style="margin-top:30px">
    <div class="sec-head"><div><h2>投稿一个 AI 工具</h2><div class="sub">审核通过后将在对应场景展示，并邀请你撰写使用路径 SOP</div></div></div>
    <div class="form-note"><span class="ic">ℹ️</span><span>收录流程：<b>提交 → 编辑审核 → 发布 / 驳回</b>。若含 affiliate 链接将明确标注，绝不误导。</span></div>
    <form onsubmit="EA.toast('已提交，等待审核（原型）');return false">
      <div class="field"><label>工具名称</label><input placeholder="如：秘塔写作猫"></div>
      <div class="field"><label>官网链接</label><input placeholder="https://"></div>
      <div class="field"><label>适用角色<span class="hint">可多选</span></label><div style="display:flex;gap:8px;flex-wrap:wrap">
        <label><input type="checkbox"> 老师</label><label><input type="checkbox"> 学生</label><label><input type="checkbox"> 家长</label><label><input type="checkbox"> 学校管理员</label></div></div>
      <div class="field"><label>适用场景</label><select><option>备课规划</option><option>课件制作</option><option>作业考试</option><option>自学答疑</option><option>家校班级</option><option>学情评价</option><option>教研课题</option><option>综合实践</option></select></div>
      <div class="field"><label>一句话定位</label><input placeholder="它最擅长解决什么"></div>
      <div class="field"><label>你常用的使用路径（SOP）<span class="hint">可选，优先收录</span></label><textarea placeholder="步骤1：… 步骤2：… 提示词：…"></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">提交投稿</button>
    </form>
  </div>`;
  return shell({ title: '投稿', active: 'submit', body });
}

/* ---------------- 页面：个人中心 ---------------- */
function renderProfile() {
  const toolmap = JSON.stringify(Object.fromEntries(TOOLS.map(t => [t.slug, { name: t.name, color: t.color, logo: t.logo }])));
  const body = `
  <div style="margin-top:24px">
    <div class="me-head">
      <div class="avatar" id="me-avatar">U</div>
      <div><h1 id="me-name">—</h1><span class="role-tag" id="me-role">—</span></div>
    </div>
    <div class="me-stats">
      <div class="stat-card"><div class="n" id="st-fav">0</div><div class="l">收藏工具</div></div>
      <div class="stat-card"><div class="n" id="st-note">0</div><div class="l">SOP 笔记</div></div>
      <div class="stat-card"><div class="n" id="st-fb">0</div><div class="l">我的反馈</div></div>
    </div>
    <div class="me-tabs">
      <button class="active" data-tab="fav">我的收藏</button>
      <button data-tab="note">SOP 笔记</button>
      <button data-tab="fb">我的反馈</button>
      <button data-tab="contrib">贡献中心 (P2)</button>
    </div>
    <div id="p-fav"></div>
    <div id="p-note" style="display:none"></div>
    <div id="p-fb" style="display:none"></div>
    <div id="p-contrib" style="display:none"></div>
  </div>`;
  const extra = `
  (function(){const MAP=${toolmap};const u=EA.user();
    if(!u){const head=document.querySelector('.me-head');head.outerHTML='<div class="soon-card" style="margin-top:24px">请先 <a href="#" id="go-login" style="color:var(--primary);font-weight:700">登录</a> 后查看个人中心。</div>';document.getElementById('go-login').onclick=e=>{e.preventDefault();EA.openLogin();};return;}
    document.getElementById('me-name').textContent=u.name;
    document.getElementById('me-role').textContent={teacher:'教师',student:'学生',parent:'家长',admin:'学校管理员'}[u.role]||u.role;
    document.getElementById('me-avatar').textContent=(u.name||'U')[0];
    EA.renderStats();
    const tabs=document.querySelectorAll('.me-tabs button');
    const panels={fav:document.getElementById('p-fav'),note:document.getElementById('p-note'),fb:document.getElementById('p-fb'),contrib:document.getElementById('p-contrib')};
    tabs.forEach(tb=>tb.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));tb.classList.add('active');Object.keys(panels).forEach(k=>panels[k].style.display=k===tb.dataset.tab?'':'none');});
    const favs=EA.favs();
    panels.fav.innerHTML=favs.length?favs.map(function(s){var t=MAP[s];return t?'<a class="note-item" href="tool-'+s+'.html" style="display:block"><h4>'+t.name+'</h4><div class="meta">已收藏</div></a>':'';}).join(''):'<div class="soon-card">还没有收藏，去工具详情点 ♡ 吧。</div>';
    const notes=JSON.parse(localStorage.getItem('ea_notes')||'{}');const nk=Object.keys(notes);
    panels.note.innerHTML=nk.length?nk.map(function(s){var t=MAP[s];return '<div class="note-item"><h4>'+(t?t.name:s)+'</h4><div class="meta">我的 SOP 笔记</div><p>'+EA.esc(notes[s])+'</p></div>';}).join(''):'<div class="soon-card">还没有笔记，在工具页「我的笔记」里记录心得。</div>';
    const fb=EA.fb();
    panels.fb.innerHTML=fb.length?fb.map(function(f){return '<div class="note-item"><h4>'+(MAP[f.tool]?MAP[f.tool].name:f.tool)+' · '+f.type+'</h4><div class="meta">'+new Date(f.ts).toLocaleString('zh-CN')+'</div><p>'+EA.esc(f.text)+'</p></div>';}).join(''):'<div class="soon-card">还没有反馈，在工具页点「反馈 / 纠错」。</div>';
    panels.contrib.innerHTML='<div class="soon-card"><b>贡献中心（规划中 P2）</b><br>发布 SOP · 评论点赞 · 认证贡献者 · 校方内训版</div>';
  })();`;
  return shell({ title: '个人中心', active: '', body, extraScript: extra });
}

/* ---------------- 页面：登录（独立页） ---------------- */
function renderLogin() {
  const body = `
  <div class="form-wrap" style="margin-top:40px;max-width:420px">
    <div class="card" style="text-align:center">
      <div class="logo" style="width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#7c3aed);color:#fff;display:grid;place-items:center;font-size:24px;margin:0 auto 14px">教</div>
      <h2 style="font-size:22px;font-weight:850">登录教AI导航</h2>
      <p class="muted" style="margin:6px 0 20px">原型用本地模拟登录，正式版接入账号体系</p>
      <form id="login-page-form">
        <div class="field" style="text-align:left"><label>昵称</label><input id="lp-name" placeholder="如：李老师"></div>
        <div class="field" style="text-align:left"><label>我是</label><select id="lp-role"><option value="teacher">教师</option><option value="student">学生</option><option value="parent">家长</option><option value="admin">学校管理员</option></select></div>
        <button class="btn btn-primary btn-block" type="submit">进入</button>
      </form>
      <p class="login-hint" style="margin-top:14px"><a href="index.html" style="color:var(--primary)">返回首页</a></p>
    </div>
  </div>`;
  const extra = `document.getElementById('login-page-form').onsubmit=e=>{e.preventDefault();const n=document.getElementById('lp-name').value.trim();const r=document.getElementById('lp-role').value;if(!n){EA.toast('请输入昵称');return;}EA.login(n,r);location.href='profile.html';};`;
  return shell({ title: '登录', active: '', body, extraScript: extra });
}

/* ---------------- 写出文件 ---------------- */
/* ---------------- 页面：AI通识课（学习路径） ---------------- */
function renderLiteracy() {
  const LIT_MODS = [
    { n: '一', title: '什么是 AI', goal: '搞懂大模型 / 生成式 AI 是什么、能做什么、不能做什么，建立正确预期，不再神化也不轻视。',
      tools: ['tongyi', 'wenxin'], sops: [
        { t: '用通义千问给学生讲清「什么是大模型」', tool: 'tongyi' },
        { t: '用文心一格生成 AI 概念配图', tool: 'wenxin' } ] },
    { n: '二', title: '提示词基础', goal: '学会把需求说清楚：角色设定 + 结构化指令 + 给示例 + 逐步迭代，让 AI 听懂你的真实意图。',
      tools: ['deepseek', 'glm'], sops: [
        { t: '用 DeepSeek 练「角色+任务+约束」三段式提示词', tool: 'deepseek' },
        { t: '用智谱 GLM 把模糊需求改写成清晰指令', tool: 'glm' } ] },
    { n: '三', title: 'AI 伦理与安全', goal: '理解隐私与数据风险、避免思维惰化、守住内容合规与学术诚信——这是教育场景的红线。',
      tools: ['deepseek', 'kimi'], sops: [
        { t: '用 DeepSeek 生成「AI 使用须知」卷首语（合规）', tool: 'deepseek' },
        { t: '用 Kimi 检查一份作业是否过度依赖 AI', tool: 'kimi' } ] },
    { n: '四', title: '在学科中应用 AI', goal: '把 AI 用到语文 / 数学 / 英语等真实教学环节，而非当玩具——启发式引导，而非直接给答案。',
      tools: ['bishun', 'tongyi', 'deepseek'], sops: [
        { t: '用笔神做启发式作文批改（保护原创）', tool: 'bishun' },
        { t: '用通义千问做英语思路引导（不讲答案）', tool: 'tongyi' } ] },
  ];
  const REL_TOOLS = ['tongyi', 'wenxin', 'deepseek', 'glm', 'kimi', 'bishun'].filter(s => TOOL_MAP[s]);
  const modsHtml = LIT_MODS.map(m => `
    <div class="lit-mod">
      <div class="lit-mod-head"><span class="lit-num">${m.n}</span><div><h3>${esc(m.title)}</h3><p class="muted">${esc(m.goal)}</p></div></div>
      <div class="lit-row"><span class="lit-k">相关工具</span>${m.tools.map(s => { const t = TOOL_MAP[s]; return t ? `<a class="chip-link" href="tool-${s}.html">${esc(t.name)} ↗</a>` : ''; }).join('')}</div>
      <div class="lit-row"><span class="lit-k">配套 SOP</span>${m.sops.map(o => `<a class="sop-link" href="tool-${o.tool}.html">▸ ${esc(o.t)}</a>`).join('')}</div>
    </div>`).join('');
  const relHtml = REL_TOOLS.map(s => toolCard(TOOL_MAP[s])).join('');
  const body = `
  <div class="rel-banner">🎓 <b>AI通识课</b> 是一套<b>渐进式学习路径</b>（概念 → 提示词 → 伦理 → 学科应用）；想按教学环节<b>找工具</b>去 <a href="scenes.html">全部场景 →</a>，想看老师亲测<b>分步 SOP</b>去 <a href="usages.html">用法库 →</a></div>
  <section class="lit-hero">
    <h1>AI通识课</h1>
    <p>不是又一个工具列表，而是一套<strong>教人搞懂并善用 AI</strong>的课程。无论你是老师想把 AI 带进课堂、学生想搞清原理、还是家长想看懂孩子在用啥——跟着四个模块走完，你会对 AI 有正确预期、会用、也用得安全。</p>
    <div class="lit-stats"><span>📚 4 个模块</span><span>🛠️ ${REL_TOOLS.length} 个配套工具</span><span>🔗 每个模块都接真实 SOP</span></div>
  </section>
  <section class="block">
    <div class="sec-head"><div><h2>课程路径</h2><div class="sub">从概念到落地，循序渐进</div></div></div>
    <div class="lit-mods">${modsHtml}</div>
  </section>
  <section class="block">
    <div class="sec-head"><div><h2>本路径相关工具</h2><div class="sub">点开任一工具，看它的分步使用路径</div></div><a class="link-more" href="scenes.html">按场景找更多 →</a></div>
    <div class="tool-grid">${relHtml}</div>
  </section>`;
  return shell({ title: 'AI通识课', active: 'literacy', body });
}

const out = __dirname;
const files = {
  'index.html': renderHome(),
  'scenes.html': renderScenes(),
  'usages.html': renderUsages(),
  'submit.html': renderSubmit(),
  'profile.html': renderProfile(),
  'login.html': renderLogin(),
  'ailiteracy.html': renderLiteracy(),
};
SCENES.forEach(s => { files[`scene-${s.key}.html`] = renderScene(s.key); });
TOOLS.forEach(t => { files[`tool-${t.slug}.html`] = renderTool(t); });

Object.entries(files).forEach(([name, html]) => {
  fs.writeFileSync(path.join(out, name), html, 'utf8');
  console.log('wrote', name, '(' + html.length + ' bytes)');
});
console.log('Done. Total files:', Object.keys(files).length);
