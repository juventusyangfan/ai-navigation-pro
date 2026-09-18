// 模仿朗读素材：段落模式（eval_mode=2）上限 120 词 —— 超出会报 4104
export const passages = [
  {
    id: 'ra-1',
    title: '短文一 · 每天练一点',
    text:
      'Many students think that learning English is difficult. In fact, the secret is to practise every day. ' +
      'You can listen to short stories on your way to school, and read aloud for ten minutes after dinner. ' +
      'Do not worry about making mistakes, because mistakes show that you are trying. ' +
      'Keep a small notebook to write down new words, and review them at weekends. ' +
      'If you keep doing these things, your English will improve quickly.',
    suggestSec: 45
  },
  {
    id: 'ra-2',
    title: '短文二 · 校园图书市集',
    text:
      'Our school will hold a book fair next Friday. Students can bring their favourite books and exchange them with others. ' +
      'There will also be a reading corner where you can sit quietly and enjoy a story. ' +
      'If you want to join, please tell your class teacher before Wednesday. ' +
      'Remember to write your name on the cover of each book.',
    suggestSec: 35
  }
]

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}
