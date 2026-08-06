// apps/desktop/src/lib/sttClient.ts

/**
 * ローカルAPIサーバー(Hono)のベースURL。
 * 将来のサーバー化・スマホ対応で変更しうるため、環境変数で管理する。
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

/**
 * WAV形式の音声データを /stt に送信し、テキスト化した結果を受け取る。
 */
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
