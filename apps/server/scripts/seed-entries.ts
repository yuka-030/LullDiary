// apps/server/scripts/seed-entries.ts
import { db } from '../src/db/client'
import { migrate } from '../src/db/migrate'
import type { InputType, Tags } from '../src/db/schema'

// 投入する日記のもと
type SeedEntry = {
  createdAt: string
  inputType: InputType
  rawInputText: string
  storyText: string
  tags: Tags
}

const SEED_ENTRIES: SeedEntry[] = [
  {
    createdAt: '2025-03-05T21:10:00.000Z',
    inputType: 'text',
    rawInputText:
      '今日は特に予定もなかったから、午後はずっと家にいた。本棚にあった本をなんとなく読み始めたら、気づいたら外が暗くなってた。',
    storyText:
      '午後の光が少しずつ部屋を移動していくころ、本棚から選ばれた一冊の本が開かれました。なんとなく読み始めたはずなのに、ページをめくるたびに時間は静かに過ぎていきます。最後に顔を上げると、窓の外はもう夜の色になっていました。',
    tags: { シーン: '家', 感情: ['穏やか'] },
  },
  {
    createdAt: '2025-03-18T20:40:00.000Z',
    inputType: 'voice',
    rawInputText:
      '今日、職場で新しい仕事を任された。まだやったことのない内容だから少し不安だけど、任せてもらえたのは嬉しい。まずはできるところからやってみようと思う。',
    storyText:
      '今日、新しい仕事がそっと手渡されました。見慣れない内容に胸は少しだけ落ち着かなくなったけれど、「任せてもらえたんだ」と思うと、不安の奥に小さな嬉しさが見えてきます。まずは目の前のできることから。そんなふうに、一歩目を決めた一日でした。',
    tags: { シーン: '職場', 感情: ['不安', '嬉しい'] },
  },
  {
    createdAt: '2025-06-12T19:30:00.000Z',
    inputType: 'text',
    rawInputText:
      '天気がよかったから、久しぶりに海まで歩いて行った。風が気持ちよくて、波を見ていたらなんだかぼーっとしてしまった。',
    storyText:
      '気持ちのいい風に誘われて、足は久しぶりに海のほうへ向かいました。波は何度も同じように岸へ寄せては帰っていきます。その繰り返しを眺めているうちに、頭の中にあったいろいろなことも、少しずつ遠くへ流れていきました。',
    tags: { シーン: '自然', 感情: ['楽しい', '穏やか'] },
  },
  {
    createdAt: '2025-06-27T21:00:00.000Z',
    inputType: 'voice',
    rawInputText:
      '今日は病院で検査を受けた。予約していたけど結構待って、待っている時間が長く感じた。終わったときにはちょっと疲れてしまった。',
    storyText:
      '待合室の椅子に座り、何度も時計を見ました。針はちゃんと進んでいるのに、待っている時間だけは少しゆっくりに感じます。ようやく名前を呼ばれ、検査を終えて外へ出たころには、ひとつ用事を終えた安心と少しの疲れが肩に残っていました。',
    tags: { シーン: '病院', 感情: ['不安', '疲れた'] },
  },
  {
    createdAt: '2025-09-08T20:20:00.000Z',
    inputType: 'text',
    rawInputText:
      '久しぶりに友だちとカフェに行った。最初は少し話すだけのつもりだったのに、気づいたらかなり長い時間しゃべっていた。',
    storyText:
      '「少しだけ話そう」と座ったはずの席でした。近況を話して、昔のことを思い出して、どうでもいいことで笑っているうちに、飲みものはすっかり空になっていました。時計を見て驚いたあとも、なんだかもう少し話していたくなる、そんな時間でした。',
    tags: { シーン: 'お店', 感情: ['楽しい', '嬉しい'] },
  },
  {
    createdAt: '2025-11-20T21:45:00.000Z',
    inputType: 'voice',
    rawInputText:
      '帰りの電車が遅れていて、ホームでずっと待っていた。早く帰りたかったからだんだんイライラしてきて、ため息ばかり出てしまった。',
    storyText:
      '帰りたい気持ちだけが先に家へ向かっているのに、体はホームに取り残されたままでした。表示板を見てはため息をつき、時計を見てはまたため息。それでもしばらくすると、遠くから電車の音が聞こえてきました。扉が開いたとき、ようやく今日が少しだけ前に進み始めました。',
    tags: { シーン: '移動中', 感情: ['もやもや'] },
  },
  {
    createdAt: '2025-12-24T22:00:00.000Z',
    inputType: 'text',
    rawInputText:
      '今日は家族と一緒にごちそうを食べた。みんなで食卓を囲んで、いろいろ話しながらゆっくり食べられて楽しかった。',
    storyText:
      '食卓にはいつもより少し特別な料理が並びました。誰かが話し始めると、別の誰かが笑って、また違う話が始まります。料理を食べる手を止めながら交わした何気ない会話まで、あたたかい時間の一部になっていました。',
    tags: { シーン: '家', 感情: ['嬉しい', '安心'] },
  },
  {
    createdAt: '2026-01-15T20:10:00.000Z',
    inputType: 'voice',
    rawInputText:
      '今日は学校で発表をしたけど、思っていたよりうまく話せなかった。途中で何を言うか少し飛んでしまって悔しい。',
    storyText:
      'みんなの前に立ったとき、用意していた言葉の一部がどこかへ隠れてしまいました。思うように話せなかったことがずっと心に残ったけれど、それでも最後までその場所に立って、発表を終えることはできました。帰り道では悔しさと一緒に、「次はもう少しうまくやりたい」という気持ちも生まれていました。',
    tags: { シーン: '学校', 感情: ['悔しい'] },
  },
  {
    createdAt: '2026-02-03T21:30:00.000Z',
    inputType: 'text',
    rawInputText:
      '今日、外を見たら雪が降っていてびっくりした。あまり降らないから、思わず窓の近くまで行ってしばらく見ていた。',
    storyText:
      'ふと窓の外を見ると、いつもの景色に白いものが静かに降っていました。あまり見慣れない光景に、思わず窓のそばまで近づきます。ひとつ、またひとつと落ちてくる雪を眺めているだけで、いつもの一日が少し違って見えました。',
    tags: { シーン: '家', 感情: ['驚き', '楽しい'] },
  },
  {
    createdAt: '2026-04-09T20:50:00.000Z',
    inputType: 'voice',
    rawInputText:
      '今日は公園を歩いていたら花がきれいに咲いていた。少し立ち止まって見ていたら、春になったんだなと思った。',
    storyText:
      'いつものように歩いていた公園で、ふと足が止まりました。目の前には、季節が来たことを知らせるようにたくさんの花が咲いています。風が吹くたびに枝が揺れて、その下を歩いていると、気づかないうちに春の中へ入り込んでいたような気がしました。',
    tags: { シーン: '自然', 感情: ['穏やか', '嬉しい'] },
  },
  {
    createdAt: '2026-04-22T21:15:00.000Z',
    inputType: 'text',
    rawInputText:
      '仕事でミスをしてしまって、今日はずっと落ちこんでいた。帰り道も何度も思い出してしまって、なかなか気持ちを切り替えられなかった。',
    storyText:
      'ひとつの失敗が、今日はいつもより大きく見えました。帰り道でも何度もその場面を思い出してしまい、足取りは少し重くなります。それでも街の明かりを見ながら歩いているうちに、今日のことは今日のうちに全部解決しなくてもいいのかもしれないと思いました。',
    tags: { シーン: '職場', 感情: ['悲しい', '疲れた'] },
  },
  {
    createdAt: '2026-07-11T22:20:00.000Z',
    inputType: 'voice',
    rawInputText:
      '今日は夏祭りに行ってきた。人が多くて暑かったけど、屋台を見たりお祭りの音を聞いたりして楽しかった。',
    storyText:
      '日が暮れるころ、通りには提灯の明かりが灯り始めました。人の間を歩きながら屋台をのぞき、遠くから聞こえてくる太鼓の音に耳をすませます。少し暑くて、人も多かったけれど、そのにぎやかさまで含めて夏らしい夜になりました。',
    tags: { シーン: 'その他', 感情: ['楽しい'] },
  },
]

// 日記エントリの追加
function insertEntries() {
  const exists = db.prepare(
    `SELECT id
    FROM entries
    WHERE created_at = ?
      AND input_type = ?
      AND raw_input_text = ?
      AND story_text = ?
    LIMIT 1`
  )

  const insert = db.prepare(
    `INSERT INTO entries (
      id, created_at, input_type, raw_input_text, story_text,
      narration_path, tags, photo_paths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
  )

  let insertedCount = 0
  let skippedCount = 0

  const insertAll = db.transaction(() => {
    for (const entry of SEED_ENTRIES) {
      const existingEntry = exists.get(
        entry.createdAt,
        entry.inputType,
        entry.rawInputText,
        entry.storyText
      )

      if (existingEntry) {
        skippedCount++
        continue
      }

      insert.run(
        crypto.randomUUID(),
        entry.createdAt,
        entry.inputType,
        entry.rawInputText,
        entry.storyText,
        null,
        JSON.stringify(entry.tags),
        JSON.stringify([])
      )

      insertedCount++
    }
  })

  insertAll()

  console.log(`${insertedCount}件の日記を追加しました`)
  console.log(`${skippedCount}件は既に存在するため追加しませんでした`)
}

migrate()
insertEntries()
