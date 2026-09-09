// apps/desktop/src/screens/RecordingScreen.text.pw.ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (pathname === '/api/generate-story') {
      await route.fulfill({ json: { story_text: '今日の物語です。' } })
      return
    }

    if (pathname === '/api/extract-tags') {
      await route.fulfill({ json: { tags: { シーン: '自然', 感情: ['穏やか'] } } })
      return
    }

    if (pathname === '/api/entries') {
      await route.fulfill({ json: { entries: [] } })
      return
    }

    await route.fulfill({ status: 503, json: { error: 'テスト用の音声未生成' } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: '物語をつくる', exact: true }).click()
  await page.getByRole('button', { name: '文字で書く', exact: true }).click()
})

test('案内文を入力後も表示し文字数を更新する', async ({ page }) => {
  const input = page.getByRole('textbox', { name: '今日は どんな１日だった？', exact: true })
  const guide = page.locator('#text-input-guide')
  const count = page.locator('#text-input-count')

  await expect(count).toHaveText('0 / 120字')
  await expect(guide).toHaveText('今日あったことを書いてみてね')

  await input.fill('あいう')

  await expect(guide).toBeVisible()
  await expect(count).toHaveText('3 / 120字')

  await input.press('End')
  await input.press('Backspace')

  await expect(count).toHaveText('2 / 120字')
})

test('120字をテキスト入力としてAPIへ送信する', async ({ page }) => {
  const text = 'あ'.repeat(120)

  await page.getByRole('textbox', { name: '今日は どんな１日だった？', exact: true }).fill(text)

  const submit = page.getByRole('button', { name: '書けたよ', exact: true })

  await expect(submit).toBeEnabled()

  const requestPromise = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/generate-story'
  )

  await submit.click()

  const request = await requestPromise

  expect(request.postDataJSON()).toEqual({ text, input_type: 'text' })
})

test('長文を切り捨てず表示し120字以内へ戻すと送信可能になる', async ({ page }) => {
  const input = page.getByRole('textbox', { name: '今日は どんな１日だった？', exact: true })
  const submit = page.getByRole('button', { name: '書けたよ', exact: true })
  const text = 'あ'.repeat(121)

  await input.fill(text)

  await expect(input).toHaveValue(text)
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#text-input-count')).toHaveText('121 / 120字')
  await expect(page.locator('#text-input-error')).toHaveText('120字以内で入力してください')
  await expect(submit).toBeDisabled()

  await input.press('End')
  await input.press('Backspace')

  await expect(page.locator('#text-input-count')).toHaveText('120 / 120字')
  await expect(page.locator('#text-input-error')).toBeEmpty()
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(submit).toBeEnabled()
})

test('日本語変換中は送信できず確定後も超過した内容を保持する', async ({ page }) => {
  const input = page.getByRole('textbox', { name: '今日は どんな１日だった？', exact: true })
  const submit = page.getByRole('button', { name: '書けたよ', exact: true })

  await input.fill('あ'.repeat(120))
  await input.dispatchEvent('compositionstart', { data: '' })

  await expect(submit).toBeDisabled()

  await input.fill('あ'.repeat(121))
  await input.dispatchEvent('compositionend', { data: 'あ' })

  await expect(input).toHaveValue('あ'.repeat(121))
  await expect(page.locator('#text-input-error')).toHaveText('120字以内で入力してください')
  await expect(submit).toBeDisabled()
})

test('空白だけの入力を送信できない', async ({ page }) => {
  await page.getByRole('textbox', { name: '今日は どんな１日だった？', exact: true }).fill('　 \n')

  await expect(page.getByRole('button', { name: '書けたよ', exact: true })).toBeDisabled()
  await expect(page.locator('#text-input-error')).toHaveText('文字を入力してください')
})
