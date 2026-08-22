// apps/server/scripts/verify-entry-upload.ts
const filePath = process.argv[2]

if (!filePath) {
  console.error('使い方: bun run scripts/verify-entry-upload.ts <wavファイルのパス>')
  process.exit(1)
}

const file = Bun.file(filePath)
const form = new FormData()

form.append('input_type', 'text')
form.append('raw_input_text', 'テスト')
form.append('story_text', '物語')
form.append('tags', JSON.stringify({ シーン: '家', 感情: ['嬉しい'] }))
form.append('narration', file, 'test.wav')

const response = await fetch('http://localhost:3000/entries', {
  method: 'POST',
  body: form,
})

console.log(response.status)
console.log(await response.json())
