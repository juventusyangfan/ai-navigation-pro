// 体验卷（多年级版）：纯前端数据，按年级加载完整试卷。
//
// 全部口语题型（模仿朗读 / 情景交际 / 信息转述）统一调用腾讯云智聆口语评测
// （新版）Web SDK 评测发音层三维分；评测所需 ref_text 取：
//   item.refText（情景交际/信息转述的参考范文）|| item.passage（朗读/题干）|| item.audioText（听力源文）
//
// 听后选择为客观题，无语音可评，本地判对错（非"评测回退"，是该类题唯一可行评法）。
//
// 智聆只评发音，不评语义与内容。情景交际/信息转述的"要点覆盖"维度在 evaluator.js
// 中计 0（真实情况，不作假）；内容量规需业务侧另建 ASR + LLM。

export const GRADES = [
  { id: 'grade7', label: '七年级', desc: '基础语音与日常表达，短文 60–70 词，侧重敢开口、读得准。' },
  { id: 'grade8', label: '八年级', desc: '中等长度语篇与情景应答，短文 80 词左右，强化流利与完整。' },
  { id: 'grade9', label: '九年级', desc: '接近中考难度的口头表达与信息转述，短文 100 词左右，综合训练。' }
]

const grade7 = {
  id: 'demo-grade7-001',
  grade: 7,
  title: '英语听说能力测评 · 七年级体验卷',
  totalScore: 30,
  sections: [
    {
      id: 'listening',
      type: 'choice',
      title: '一、听后选择',
      score: 10,
      tip: '听录音，选出最佳答案。每段最多播放 2 次（含首次）。',
      items: [
        {
          id: 'L1',
          audioText:
            'Boy: Lucy, do you walk to school every day? Girl: No, I usually ride my bike. But when it rains, my dad drives me.',
          question: 'How does Lucy usually go to school?',
          options: ['On foot.', 'By bike.', 'By car.'],
          answer: 1,
          replayLimit: 2
        },
        {
          id: 'L2',
          audioText:
            'Man: Tom, what do you want to drink, juice or milk? Boy: Neither. I would like a glass of water, please.',
          question: 'What does Tom want to drink?',
          options: ['Juice.', 'Milk.', 'Water.'],
          answer: 2,
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
            'My name is Lin Tao. I am a student in Grade Seven. I like my school because the teachers are kind and the classmates are friendly. Every morning we read English together. After school, I often play basketball with my friends. I think school life is happy and meaningful.',
          audioText:
            'My name is Lin Tao. I am a student in Grade Seven. I like my school because the teachers are kind and the classmates are friendly. Every morning we read English together. After school, I often play basketball with my friends. I think school life is happy and meaningful.',
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
      tip: '根据情景口头表达，先听提示，再参考范文作答，注意发音与完整句子。',
      items: [
        {
          id: 'D1',
          passage:
            'Your friend says: "I have a bad cold and cannot go to the park with you today." What would you say to him or her?',
          refText:
            "I am sorry to hear that. You should drink more warm water and have a good rest. I can visit you after school. I hope you will feel better soon.",
          keyPoints: ['表达关心', '给出休息建议', '表达祝愿'],
          prepareSec: 15,
          suggestSec: 30
        }
      ]
    },
    {
      id: 'retell',
      type: 'retell',
      title: '四、信息转述',
      score: 10,
      tip: '听短文两遍，参考范文口头转述核心要点，尽量覆盖全部信息点。',
      items: [
        {
          id: 'T1',
          audioText:
            'Hello, I am Ben. I want to tell you about my school day. I get up at six thirty and have breakfast at seven. Then I go to school by bus. Classes start at eight. I have four lessons in the morning and two in the afternoon. After school, I play football with my friends. I go home at five.',
          refText:
            'Ben gets up at half past six and has breakfast at seven. He goes to school by bus. His classes start at eight. He has four classes in the morning and two in the afternoon. After school he plays football with his friends, and he goes home at five.',
          keyPoints: ['起床与早餐时间', '上学方式', '上午四节 / 下午两节课', '放学踢球 / 五点回家'],
          prepareSec: 30,
          suggestSec: 55,
          replayLimit: 2
        }
      ]
    }
  ]
}

const grade8 = {
  id: 'demo-grade8-001',
  grade: 8,
  title: '英语听说能力测评 · 八年级体验卷',
  totalScore: 36,
  sections: [
    {
      id: 'listening',
      type: 'choice',
      title: '一、听后选择',
      score: 12,
      tip: '听录音，选出最佳答案。每段最多播放 2 次（含首次）。',
      items: [
        {
          id: 'L1',
          audioText:
            'Girl: Hi, Mike. Did you watch the basketball game last night? Boy: Yes, it was exciting. Our school team won by two points.',
          question: 'What happened to the school team last night?',
          options: ['They lost the game.', 'They won the game.', 'They did not play.'],
          answer: 1,
          replayLimit: 2
        },
        {
          id: 'L2',
          audioText:
            'Woman: Excuse me, how can I get to the nearest hospital? Man: Go along this road and turn left at the second crossing. It is next to a supermarket.',
          question: 'Where should the woman turn left?',
          options: ['At the first crossing.', 'At the second crossing.', 'At the supermarket.'],
          answer: 1,
          replayLimit: 2
        },
        {
          id: 'L3',
          audioText:
            'Boy: Mum, may I use your mobile phone? I need to call my teacher about the trip. Woman: Sure, but remember to keep it short.',
          question: 'Why does the boy want the phone?',
          options: ['To play a game.', 'To call his teacher.', 'To watch a video.'],
          answer: 1,
          replayLimit: 2
        }
      ]
    },
    {
      id: 'reading',
      type: 'read_aloud',
      title: '二、模仿朗读',
      score: 6,
      tip: '先听示范朗读，再完整朗读全文，注意语流与停顿。',
      items: [
        {
          id: 'R1',
          passage:
            'Travel opens our eyes to the world. Last summer, my family visited a small village in the mountains. The air was fresh and the people were warm. We learned how to make tofu and picked tea leaves with the farmers. Although the trip was short, it taught me that happiness does not come from money, but from simple moments with the people we love.',
          audioText:
            'Travel opens our eyes to the world. Last summer, my family visited a small village in the mountains. The air was fresh and the people were warm. We learned how to make tofu and picked tea leaves with the farmers. Although the trip was short, it taught me that happiness does not come from money, but from simple moments with the people we love.',
          prepareSec: 20,
          suggestSec: 40,
          replayLimit: 2
        }
      ]
    },
    {
      id: 'dialogue',
      type: 'dialogue',
      title: '三、情景交际',
      score: 6,
      tip: '根据情景或话题口头表达，参考范文作答，注意发音、用词与完整度。',
      items: [
        {
          id: 'D1',
          passage:
            'Your teacher asks: "Why do you think reading English stories is helpful to your study?" Give your opinion.',
          refText:
            'I think reading English stories helps a lot. First, it builds my vocabulary. Second, it improves my sense of the language. Most importantly, it makes learning English fun, so I read a little every day.',
          keyPoints: ['扩大词汇', '培养语感', '提升兴趣'],
          prepareSec: 15,
          suggestSec: 35
        },
        {
          id: 'D2',
          passage:
            'A visitor says: "I am new here and I cannot find the school library. Can you help me?" What would you say?',
          refText:
            'Of course. Walk straight ahead and turn right at the flower shop. The library is on your left, between the classroom building and the dining hall. I can show you the way if you like.',
          keyPoints: ['表示愿意帮助', '说明路线', '主动带路（可选）'],
          prepareSec: 15,
          suggestSec: 35
        }
      ]
    },
    {
      id: 'retell',
      type: 'retell',
      title: '四、信息转述',
      score: 12,
      tip: '听短文两遍，参考范文口头转述核心要点，尽量覆盖全部信息点。',
      items: [
        {
          id: 'T1',
          audioText:
            'Good morning, everyone. I am Lisa, the monitor of Class Three. We are going to have a book sale next Friday afternoon in the school hall. All students can bring old books and sell them at low prices. The money we collect will go to the poor children in the village school. Please tell your friends and come to support us. Thank you.',
          refText:
            'Lisa, the monitor of Class Three, says they will have a book sale next Friday afternoon in the school hall. Students can bring old books and sell them cheaply. The money will help poor children in a village school. She asks everyone to tell friends and come to support.',
          keyPoints: ['时间地点（周五下午 / 礼堂）', '旧书低价售卖', '善款资助乡村儿童', '号召参与'],
          prepareSec: 30,
          suggestSec: 60,
          replayLimit: 2
        }
      ]
    }
  ]
}

const grade9 = {
  id: 'demo-grade9-001',
  grade: 9,
  title: '英语听说能力测评 · 九年级体验卷',
  totalScore: 40,
  sections: [
    {
      id: 'listening',
      type: 'choice',
      title: '一、听后选择',
      score: 12,
      tip: '听录音，选出最佳答案。每段最多播放 2 次（含首次）。',
      items: [
        {
          id: 'L1',
          audioText:
            'Woman: Have you decided which club to join this term? Boy: Not yet. I am torn between the science club and the volunteer club. Woman: Why not try both? You can manage your time.',
          question: 'What is the boy unsure about?',
          options: ['Which club to join.', 'Whether to join any club.', 'How to manage time.'],
          answer: 0,
          replayLimit: 2
        },
        {
          id: 'L2',
          audioText:
            'Man: The exam is coming. Are you nervous? Girl: A little. I have reviewed all the notes, but I still worry about the listening part. Man: Just relax. You have practised a lot.',
          question: 'What worries the girl most?',
          options: ['The whole exam.', 'The listening part.', 'The writing part.'],
          answer: 1,
          replayLimit: 2
        },
        {
          id: 'L3',
          audioText:
            'Boy: Dad, my friend invited me to a study trip to Beijing during the holiday. Girl: That sounds great, but have you checked the cost and the plan? Boy: Not yet. I will talk to my teacher first.',
          question: 'What will the boy do first?',
          options: ['Pay for the trip.', 'Talk to his teacher.', 'Pack his bags.'],
          answer: 1,
          replayLimit: 2
        }
      ]
    },
    {
      id: 'reading',
      type: 'read_aloud',
      title: '二、模仿朗读',
      score: 8,
      tip: '先听示范朗读，再完整朗读全文，注意连读、重音与语流。',
      items: [
        {
          id: 'R1',
          passage:
            'As we grow up, we begin to understand that success is not a sudden accident but the result of daily effort. A student who reads for twenty minutes every day will, over a year, know far more than one who waits for a miracle. Therefore, do not look for shortcuts. Set a small goal, keep it, and let time turn your persistence into achievement.',
          audioText:
            'As we grow up, we begin to understand that success is not a sudden accident but the result of daily effort. A student who reads for twenty minutes every day will, over a year, know far more than one who waits for a miracle. Therefore, do not look for shortcuts. Set a small goal, keep it, and let time turn your persistence into achievement.',
          prepareSec: 20,
          suggestSec: 45,
          replayLimit: 2
        }
      ]
    },
    {
      id: 'dialogue',
      type: 'dialogue',
      title: '三、口头表达',
      score: 8,
      tip: '根据话题作一分钟口头表达，参考范文组织语言，注意发音、逻辑与完整度。',
      items: [
        {
          id: 'D1',
          passage:
            'Your school is holding a speech contest on the topic "Technology and My Life". Please give a one-minute speech sharing your opinion.',
          refText:
            'Good morning. Technology has changed my life in many ways. I use apps to learn English and to keep in touch with my family. However, I believe we should use technology wisely, not let it control us. In my view, the best tool is the one that helps us grow.',
          keyPoints: ['点题（科技改变生活）', '举例说明', '辩证态度（善用而非被控）'],
          prepareSec: 20,
          suggestSec: 45
        },
        {
          id: 'D2',
          passage:
            'Your classmate says: "I spend two hours on my phone every night and my grades are dropping. What should I do?" Give him or her some advice.',
          refText:
            'I think you should set a clear limit, like thirty minutes a night. Put the phone away while studying, and use the saved time for reading or sleep. If you need willpower, ask your parents to help you check it.',
          keyPoints: ['设定使用时限', '学习时远离手机', '用省下时间学习 / 休息', '寻求家人监督'],
          prepareSec: 15,
          suggestSec: 40
        }
      ]
    },
    {
      id: 'retell',
      type: 'retell',
      title: '四、信息转述',
      score: 12,
      tip: '听短文两遍，参考范文口头转述核心要点，尽量覆盖全部信息点。',
      items: [
        {
          id: 'T1',
          audioText:
            'Ladies and gentlemen, welcome to our school radio. Today I will introduce a project called Green Corner. Started in 2021, it encourages students to plant vegetables on the roof. Every class takes turns to water and record the growth. By 2024, more than three hundred students had joined, and the fresh vegetables were sent to the school kitchen. The project teaches us that small actions can make a real difference.',
          refText:
            'The school radio introduces Green Corner, a project started in 2021. It asks students to grow vegetables on the roof. Each class waters the plants and records their growth in turn. By 2024, over three hundred students joined, and the vegetables went to the school kitchen. The project shows small actions can bring real change.',
          keyPoints: ['项目名与起始（2021）', '屋顶种菜 / 轮流照料', '2024 超 300 人参与 / 蔬菜进食堂', '主旨（小行动大改变）'],
          prepareSec: 30,
          suggestSec: 65,
          replayLimit: 2
        }
      ]
    }
  ]
}

// ── 题目音频 ───────────────────────────────────────────────────────────────────
// 不再落本地静态音频文件：改用服务端腾讯云语音合成（GET /api/tts/audio），
// 浏览器只做原生 <audio> 播放。题目写了 audioText 即自动获得音频，
// 无需任何「音频清单」——改题目即时生效，不存在清单与题目不同步的问题。
// 将来若要用真人录音：给条目加 audioUrl（相对路径）即可覆盖合成音频，代码零改动。
// 详见 README「八、题目音频：服务端腾讯云语音合成」。

export const papers = { grade7, grade8, grade9 }

export function getPaper(gradeId) {
  return papers[gradeId] || papers.grade7
}
