// apps/desktop/src/lib/sttClient.ts

// ローカルAPIサーバー(Hono)のベースURL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL が設定されていません')
}

// WAV形式の音声データを /stt に送信し、テキスト化した結果を受け取る
export async function requestTranscription(wav: ArrayBuffer): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/stt`, {
    method: 'POST',
    body: wav,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      body && typeof body.error === 'string' ? body.error : '音声のテキスト化に失敗しました'
    throw new Error(message)
  }

  const body = await response.json()
  return typeof body.text === 'string' ? body.text : ''
}
