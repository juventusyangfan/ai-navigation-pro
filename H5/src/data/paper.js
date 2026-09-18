// 体验卷：内置样例题，纯前端运行，无后端依赖
// audioUrl 留空 -> 使用浏览器 TTS 朗读（零素材成本）；填入 mp3 地址后自动改用音频文件
export const paper = {
  id: 'demo-speaking-001',
  title: '英语听说能力测评 · 体验卷',
  totalScore: 30,
  sections: [
    {
      id: 'listening',
      type: 'choice',
      title: '一、听后选择',
      score: 10,
      tip: '听录音，选出最佳答案。每段可重听一次。',
      items: [
        {
          id: 'L1',
          audioText:
            'Woman: Tom, why were you late for school this morning? Boy: My bike broke down on the way, so I had to walk for twenty minutes.',
          question: 'Why was Tom late?',
          options: ['He got up late.', 'His bike broke down.', 'He missed the bus.'],
          answer: 1,
          replayLimit: 2
        },
        {
          id: 'L2',
          audioText:
            'Girl: Dad, can I join the school reading club? Father: Of course. But it meets every Friday afternoon, so you need to finish your homework first.',
          question: 'What does the father ask the girl to do first?',
          options: ['Join the club on Friday.', 'Finish her homework.', 'Buy some new books.'],
          answer: 1,
          replayLimit: 2
        }
      ]
    },
    {
      id: 'reading',
      type: 'read_aloud',
      title: '二、模仿朗读',
      score: 5,
      tip: '先听示范朗读，再完整朗读全文，注意发音、停顿与完整度。',
      items: [
        {
          id: 'R1',
          passage:
            'Good morning, everyone. Today I want to share a small habit that changed my study life. Every evening, I write down three things I learned at school. It takes only five minutes, but it helps me remember what really matters. Try it for one week, and you may be surprised by the result.',
          audioText:
            'Good morning, everyone. Today I want to share a small habit that changed my study life. Every evening, I write down three things I learned at school. It takes only five minutes, but it helps me remember what really matters. Try it for one week, and you may be surprised by the result.',
          prepareSec: 20,
          suggestSec: 35,
          replayLimit: 2
        }
      ]
    },
    {
      id: 'dialogue',
      type: 'dialogue',
      title: '三、情景交际',
      score: 5,
      tip: '根据情景口头作答，请用完整句子，避免只回答 Yes / No。',
      items: [
        {
          id: 'D1',
          passage:
            'Your classmate says: "I failed the maths test yesterday. I feel really sad." What would you say to him or her?',
          keyPoints: ['表达安慰', '给出建议', '一句鼓励'],
          prepareSec: 15,
          suggestSec: 25
        }
      ]
    },
    {
      id: 'retell',
      type: 'retell',
      title: '四、信息转述',
      score: 10,
      tip: '听短文两遍，然后口头转述核心要点，尽量覆盖全部信息点。',
      items: [
        {
          id: 'T1',
          audioText:
            'Hi, I am Lisa. I want to tell you about our school reading club. We meet every Friday afternoon in the school library. Each student brings one favourite book and shares it with the group. Last month we read ten books together, and we also wrote short notes after reading. Our teacher says reading notes help us think more clearly.',
          keyPoints: ['社团名称与时间地点', '每人带一本喜欢的书分享', '上月共读十本书并写读书笔记', '老师认为笔记有助于清晰思考'],
          prepareSec: 30,
          suggestSec: 60,
          replayLimit: 2
        }
      ]
    }
  ]
}
