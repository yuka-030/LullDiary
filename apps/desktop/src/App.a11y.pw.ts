// apps/desktop/src/App.a11y.pw.ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import type { Entry } from './lib/bookshelf/entryTypes'

// テスト用の入力と物語
const INPUT_TEXT = '公園を歩きました。'
const STORY_TEXT = '今日は公園を歩きました。おやすみなさい。'
const TRANSCRIPT_TEXT = '公園を歩いて、花を見つけました。'

// 手動確認対象のコントラスト
const MANUAL_CONTRAST_TARGETS = [
  {
    selector: 'main p.text-txt2',
    reason: '補助文字の配色と本文との階層の維持',
  },
  {
    selector: 'main button.back-link',
    reason: '戻る操作の補助文字と文字の影の維持',
  },
  {
    selector: 'main .bookshelf-filter-label',
    reason: '絞り込み見出しの補助文字色の維持',
  },
  {
    selector: 'main .book-outer-heading',
    reason: '日付見出しの配色の維持',
  },
  {
    selector: 'main .story-actions-line > span.text-txt2',
    reason: 'ページ数の補助文字色の維持',
  },
  {
    selector: 'main .bookshelf-pagination > span.text-txt2',
    reason: '本棚のページ数の補助文字色の維持',
  },
  {
    selector: 'main .bookshelf-pagination button.border-txt2',
    reason: '本棚のページ操作の補助文字色と白20%の背景の維持',
  },
  {
    selector: 'main button.bg-glow',
    reason: 'オレンジの背景・白文字・文字の影の維持',
  },
  {
    selector: 'main .story-actions button.bg-main',
    reason: '保存ボタンのオレンジと白文字の維持',
  },
  {
    selector: 'main button.border-sub',
    reason: '紫の文字とホバー時の配色変化の維持',
  },
  {
    selector: 'main .story-actions button.border-txt2',
    reason: '補助操作の文字色とホバー時の配色変化の維持',
  },
  {
    selector: 'main .story-actions button.border-main',
    reason: '編集ボタンの暖色とホバー時の配色変化の維持',
  },
  {
    selector: 'main .story-actions button.border-rec',
    reason: '削除ボタンの暖色とホバー時の配色変化の維持',
  },
  {
    selector: '#bookshelf-filter-options button.option-menu-item-active',
    reason: '本棚の選択済み候補の紫と白文字の維持',
  },
  {
    selector: '#entry-tag-options button.option-menu-item-active',
    reason: '編集画面の選択済み候補の紫と白文字の維持',
  },
  {
    selector: '[role="dialog"][aria-label="話した内容の確認"] button.text-txt2',
    reason: '認識結果モーダルの取り消しボタンの補助文字色と白20%の背景の維持',
  },
  {
    selector: '[role="dialog"] button.bg-glow',
    reason: '認識結果モーダルのオレンジ・白文字・文字の影の維持',
  },
  {
    selector: '[role="dialog"] p.text-txt2',
    reason: '認識結果モーダルの補助文字色の維持',
  },
  {
    selector: '.confirm-modal button.confirm-modal-confirm',
    reason: '削除確認ボタンの暖色と明るい文字色の維持',
  },
  {
    selector: '.confirm-modal .confirm-modal-message',
    reason: '削除確認の説明文の補助文字色の維持',
  },
  {
    selector: '.confirm-modal button.confirm-modal-cancel',
    reason: '削除確認の取り消しボタンの補助文字色の維持',
  },
]

// テスト用の日記
const ENTRIES: Entry[] = [
  {
    id: 'a11y-2026',
    created_at: '2026-09-06T12:00:00+09:00',
    input_type: 'text',
    raw_input_text: INPUT_TEXT,
    story_text: STORY_TEXT,
    narration_path: null,
    tags: { シーン: '自然', 感情: ['穏やか'] },
    photo_paths: [],
  },
  {
    id: 'a11y-2025',
    created_at: '2025-09-06T12:00:00+09:00',
    input_type: 'text',
    raw_input_text: '家で休みました。',
    story_text: '今日は家で休みました。',
    narration_path: null,
    tags: { シーン: '家', 感情: ['安心'] },
    photo_paths: [],
  },
]

// 本棚2ページ分の日記
const PAGED_ENTRIES: Entry[] = [
  ...ENTRIES,
  ...[2024, 2023].map((year): Entry => ({
    id: `a11y-${year}`,
    created_at: `${year}-09-06T12:00:00+09:00`,
    input_type: 'text',
    raw_input_text: '家で本を読みました。',
    story_text: `${year}年の日記です。家で本を読みました。`,
    narration_path: null,
    tags: { シーン: '家', 感情: ['安心'] },
    photo_paths: [],
  })),
]

// テスト用の写真
const PHOTO = {
  name: 'test-photo.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
      '<rect width="100" height="100" fill="#7ca982"/></svg>'
  ),
}

// テスト用の無音WAV
function createSilentWav(): Buffer {
  const sampleRate = 16_000
  const dataSize = sampleRate * 2
  const wav = Buffer.alloc(44 + dataSize)

  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)

  return wav
}

// APIと音声前処理の差し替え
test.beforeEach(async ({ page }) => {
  let entries = structuredClone(ENTRIES)

  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke: async (command: string) => {
          if (command !== 'preprocess_audio') {
            throw new Error(`未定義のテスト用コマンド: ${command}`)
          }

          return [0, 0, 0, 0]
        },
      },
    })
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/api/entries' && method === 'GET') {
      const scene = url.searchParams.get('scene')
      const emotions = url.searchParams.getAll('emotion')
      const filtered = entries.filter(
        (entry) =>
          (!scene || entry.tags.シーン === scene) &&
          emotions.every((emotion) => entry.tags.感情.includes(emotion))
      )

      await route.fulfill({ json: { entries: filtered } })
      return
    }

    if (url.pathname === '/api/entries' && method === 'POST') {
      entries = [
        {
          ...structuredClone(ENTRIES[0]),
          id: 'a11y-created',
        },
        ...entries,
      ]

      await route.fulfill({ status: 201, json: { entry: entries[0] } })
      return
    }

    if (url.pathname.startsWith('/api/entries/') && method === 'DELETE') {
      const id = url.pathname.split('/').pop()
      entries = entries.filter((entry) => entry.id !== id)

      await route.fulfill({ status: 204 })
      return
    }

    if (url.pathname === '/api/generate-story') {
      await route.fulfill({ json: { story_text: STORY_TEXT } })
      return
    }

    if (url.pathname === '/api/extract-tags') {
      await route.fulfill({
        json: { tags: { シーン: '自然', 感情: ['穏やか'] } },
      })
      return
    }

    if (url.pathname === '/api/tts') {
      await route.fulfill({
        contentType: 'audio/wav',
        body: createSilentWav(),
      })
      return
    }

    if (url.pathname === '/api/tts-timings') {
      await route.fulfill({ json: { timings: [] } })
      return
    }

    if (url.pathname === '/api/stt') {
      await route.fulfill({ json: { text: TRANSCRIPT_TEXT } })
      return
    }

    await route.fulfill({
      status: 501,
      json: { error: `未定義のテスト用API: ${method} ${url.pathname}` },
    })
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: '物語をつくる', exact: true })).toBeVisible()
})

// Tabキーでの対象要素への移動
async function tabTo(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeVisible()

  for (let count = 0; count < 100; count += 1) {
    const focused = await target.evaluate((element) => element === document.activeElement)

    if (focused) {
      return
    }

    await page.keyboard.press('Tab')
  }

  await expect(target, 'Tabキーで対象の要素に移動できること').toBeFocused()
}

// キーボードでのボタン操作
async function activate(
  page: Page,
  target: Locator,
  key: 'Enter' | 'Space' = 'Enter'
): Promise<void> {
  await tabTo(page, target)
  await page.keyboard.press(key)
}

// 本棚の表示
async function openBookshelf(page: Page): Promise<void> {
  await activate(page, page.getByRole('button', { name: '本棚を見る', exact: true }))
  await expect(
    page.getByRole('button', { name: '2026年9月の日記を開く', exact: true })
  ).toBeVisible()
}

// 本棚2ページ分のAPI応答
async function openPagedBookshelf(page: Page): Promise<void> {
  await page.route('**/api/entries*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() !== 'GET' || url.pathname !== '/api/entries') {
      await route.fallback()
      return
    }

    const scene = url.searchParams.get('scene')
    const emotions = url.searchParams.getAll('emotion')
    const entries = PAGED_ENTRIES.filter(
      (entry) =>
        (!scene || entry.tags.シーン === scene) &&
        emotions.every((emotion) => entry.tags.感情.includes(emotion))
    )

    await route.fulfill({ json: { entries } })
  })

  await openBookshelf(page)
  await expect(page.locator('.bookshelf-pagination > span')).toHaveText('1 / 2')
}

// 本棚の切り替えボタン
function shelfControls(page: Page) {
  const frame = page.locator('.bookshelf-frame')
  const pagination = page.locator('.bookshelf-pagination')

  return {
    sidePrevious: frame.getByRole('button', { name: '前の本棚', exact: true }),
    sideNext: frame.getByRole('button', { name: '次の本棚', exact: true }),
    textPrevious: pagination.getByRole('button', { name: '前の本棚', exact: true }),
    textNext: pagination.getByRole('button', { name: '次の本棚', exact: true }),
    status: pagination.locator(':scope > span'),
  }
}

// 本棚の表示内容と操作可能な方向
async function expectShelfPage(page: Page, current: 1 | 2): Promise<void> {
  const controls = shelfControls(page)

  await expect(controls.status).toHaveText(`${current} / 2`)

  if (current === 1) {
    for (const year of [2026, 2025, 2024]) {
      await expect(
        page.getByRole('button', { name: `${year}年9月の日記を開く`, exact: true })
      ).toBeVisible()
    }

    await expect(
      page.getByRole('button', { name: '2023年9月の日記を開く', exact: true })
    ).toHaveCount(0)

    await expect(controls.sidePrevious).toBeDisabled()
    await expect(controls.textPrevious).toBeDisabled()
    await expect(controls.sideNext).toBeEnabled()
    await expect(controls.textNext).toBeEnabled()
  } else {
    await expect(
      page.getByRole('button', { name: '2023年9月の日記を開く', exact: true })
    ).toBeVisible()

    for (const year of [2026, 2025, 2024]) {
      await expect(
        page.getByRole('button', { name: `${year}年9月の日記を開く`, exact: true })
      ).toHaveCount(0)
    }

    await expect(controls.sidePrevious).toBeEnabled()
    await expect(controls.textPrevious).toBeEnabled()
    await expect(controls.sideNext).toBeDisabled()
    await expect(controls.textNext).toBeDisabled()
  }
}

// 日記詳細の表示
async function openDetail(page: Page): Promise<void> {
  await openBookshelf(page)
  await activate(page, page.getByRole('button', { name: '2026年9月の日記を開く', exact: true }))
  await activate(page, page.getByRole('button', { name: /^6日/ }))
  await expect(page.getByRole('button', { name: '編集する', exact: true })).toBeVisible()
}

// テキスト入力画面の表示
async function openTextInput(page: Page): Promise<void> {
  await activate(page, page.getByRole('button', { name: '物語をつくる', exact: true }))
  await activate(page, page.getByRole('button', { name: '文字で書く', exact: true }))
  await expect(
    page.getByRole('textbox', { name: '今日は どんな１日だった？', exact: true })
  ).toBeVisible()
}

// 物語生成結果の表示
async function generateStory(page: Page): Promise<void> {
  await openTextInput(page)

  const input = page.getByRole('textbox', {
    name: '今日は どんな１日だった？',
    exact: true,
  })

  await tabTo(page, input)
  await page.keyboard.insertText(INPUT_TEXT)
  await activate(page, page.getByRole('button', { name: '書けたよ', exact: true }))
  await expect(page.getByRole('button', { name: '保存する', exact: true })).toBeVisible()
}

// 認識結果モーダルの表示
async function openTranscript(page: Page): Promise<void> {
  await activate(page, page.getByRole('button', { name: '物語をつくる', exact: true }))
  await activate(page, page.getByRole('button', { name: '録音を開始する', exact: true }), 'Space')

  const stop = page.getByRole('button', { name: '録音を停止する', exact: true })
  await expect(stop).toBeEnabled()
  await activate(page, stop, 'Space')
  await activate(page, page.getByRole('button', { name: '作成する', exact: true }))

  await expect(page.getByRole('dialog', { name: '話した内容の確認', exact: true })).toBeVisible()
}

// ラベルとコントラストの検査
async function scanAccessibility(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  // 全要素のラベル・ARIA検査
  const labelResults = await new AxeBuilder({ page })
    .withRules([
      'button-name',
      'label',
      'image-alt',
      'aria-dialog-name',
      'aria-valid-attr',
      'aria-valid-attr-value',
      'aria-allowed-attr',
      'aria-required-attr',
      'aria-hidden-focus',
    ])
    .analyze()

  // 手動確認対象を除くコントラスト検査
  const contrastBuilder = new AxeBuilder({ page }).withRules(['color-contrast'])

  for (const target of MANUAL_CONTRAST_TARGETS) {
    contrastBuilder.exclude(target.selector)
  }

  const contrastResults = await contrastBuilder.analyze()

  // 表示中の手動確認対象
  const manualTargets = await page.evaluate((targets) => {
    return targets
      .map((target) => {
        const elements = Array.from(document.querySelectorAll(target.selector))
          .filter((element) => {
            const style = getComputedStyle(element)

            return (
              element.getClientRects().length > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.visibility !== 'collapse' &&
              !element.closest('[inert]')
            )
          })
          .map((element) => {
            const style = getComputedStyle(element)

            return {
              text: element.textContent?.trim() ?? '',
              color: style.color,
              backgroundColor: style.backgroundColor,
              textShadow: style.textShadow,
              fontSize: style.fontSize,
            }
          })

        return {
          ...target,
          elements,
        }
      })
      .filter((target) => target.elements.length > 0)
  }, MANUAL_CONTRAST_TARGETS)

  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(
      {
        labels: labelResults,
        contrast: contrastResults,
        manualContrast: manualTargets,
      },
      null,
      2
    ),
    contentType: 'application/json',
  })

  if (manualTargets.length > 0) {
    testInfo.annotations.push({
      type: 'コントラスト個別除外',
      description: `${name}: 対象と理由は添付JSONのmanualContrastに記録`,
    })
  }

  const incomplete = [...labelResults.incomplete, ...contrastResults.incomplete]

  if (incomplete.length > 0) {
    testInfo.annotations.push({
      type: '要目視確認',
      description: `${name}: ${[...new Set(incomplete.map((result) => result.id))].join(', ')}`,
    })
  }

  const violations = [...labelResults.violations, ...contrastResults.violations].map((result) => ({
    rule: result.id,
    help: result.help,
    elements: result.nodes.map((node) => ({
      target: node.target,
      reason: node.failureSummary,
    })),
  }))

  expect.soft(violations, `${name}の自動検査対象のアクセシビリティ違反`).toEqual([])
}

test('キーボードでテキスト入力から物語の保存まで操作できる', async ({ page }) => {
  await generateStory(page)

  await expect(page.getByText(STORY_TEXT, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '写真を追加', exact: true })).toBeVisible()
  await activate(page, page.getByRole('button', { name: '保存する', exact: true }))

  await expect(
    page.getByRole('button', { name: '2026年9月の日記を開く', exact: true })
  ).toBeVisible()
})

test('本棚の同じ月を年で区別して日記を開ける', async ({ page }) => {
  await openBookshelf(page)

  await expect(
    page.getByRole('button', { name: '2025年9月の日記を開く', exact: true })
  ).toBeVisible()

  await activate(
    page,
    page.getByRole('button', { name: '2026年9月の日記を開く', exact: true }),
    'Space'
  )
  await activate(page, page.getByRole('button', { name: /^6日/ }))

  await expect(page.getByRole('button', { name: '編集する', exact: true })).toBeVisible()
})

test('本棚が1ページなら切り替え操作を表示せずホームへ戻れる', async ({ page }) => {
  await openBookshelf(page)

  await expect(page.locator('.bookshelf-side-button')).toHaveCount(0)
  await expect(page.locator('.bookshelf-pagination')).toHaveCount(0)

  await activate(page, page.getByRole('button', { name: '← ホームにもどる', exact: true }))
  await expect(page.getByRole('button', { name: '物語をつくる', exact: true })).toBeVisible()
})

for (const kind of ['丸い矢印', '文字ボタン'] as const) {
  for (const key of ['Enter', 'Space'] as const) {
    test(`本棚の${kind}を${key}で操作し、ページと無効状態が切り替わる`, async ({ page }) => {
      await openPagedBookshelf(page)
      await expectShelfPage(page, 1)

      const controls = shelfControls(page)
      const next = kind === '丸い矢印' ? controls.sideNext : controls.textNext
      const previous = kind === '丸い矢印' ? controls.sidePrevious : controls.textPrevious

      await activate(page, next, key)
      await expectShelfPage(page, 2)

      await activate(page, previous, key)
      await expectShelfPage(page, 1)
    })
  }
}

test('本棚の2ページ目から絞り込むと先頭へ戻り切り替え操作が消える', async ({ page }) => {
  await openPagedBookshelf(page)
  await activate(page, shelfControls(page).textNext)
  await expectShelfPage(page, 2)

  const filter = page.locator('.bookshelf-filter')
  await activate(page, filter.getByRole('button', { name: 'すべての年', exact: true }))
  await activate(
    page,
    page.locator('#bookshelf-filter-options').getByRole('button', {
      name: '2026年',
      exact: true,
    })
  )

  await expect(
    page.getByRole('button', { name: '2026年9月の日記を開く', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '2023年9月の日記を開く', exact: true })
  ).toHaveCount(0)
  await expect(page.locator('.bookshelf-side-button')).toHaveCount(0)
  await expect(page.locator('.bookshelf-pagination')).toHaveCount(0)

  await activate(page, filter.getByRole('button', { name: '条件をはずす', exact: true }))
  await expectShelfPage(page, 1)
})

test('絞り込みの開閉・選択状態と解除をキーボードで操作できる', async ({ page }) => {
  await openBookshelf(page)

  const filter = page.locator('.bookshelf-filter')
  const year = filter.getByRole('button', { name: 'すべての年', exact: true })
  await expect(year).toHaveAttribute('aria-expanded', 'false')
  await activate(page, year)
  await expect(year).toHaveAttribute('aria-expanded', 'true')

  const options = page.locator('#bookshelf-filter-options')
  await expect(options).toBeVisible()
  await expect(options.getByRole('button', { name: 'すべて', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  await activate(page, options.getByRole('button', { name: '2026年', exact: true }))
  await expect(options).toHaveCount(0)

  const selectedYear = filter.getByRole('button', { name: '2026年', exact: true })
  await expect(selectedYear).toHaveAttribute('aria-expanded', 'false')
  await activate(page, selectedYear)
  await expect(options.getByRole('button', { name: '2026年', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await activate(page, selectedYear)

  await activate(page, filter.getByRole('button', { name: 'すべての月', exact: true }))
  await activate(page, options.getByRole('button', { name: '9月', exact: true }))
  await expect(filter.getByRole('button', { name: '9月', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false'
  )

  await activate(page, filter.getByRole('button', { name: 'どこで：すべて', exact: true }))
  await activate(page, options.getByRole('button', { name: '自然', exact: true }))
  await expect(filter.getByRole('button', { name: 'どこで：自然', exact: true })).toBeVisible()

  await activate(page, filter.getByRole('button', { name: 'きもち：えらぶ', exact: true }))
  const emotion = options.getByRole('checkbox', { name: '穏やか', exact: true })
  await tabTo(page, emotion)
  await page.keyboard.press('Space')
  await expect(emotion).toBeChecked()

  await activate(page, filter.getByRole('button', { name: 'きもち：1つ えらんだ', exact: true }))
  await activate(page, filter.getByRole('button', { name: '穏やかの絞り込みを解除', exact: true }))
  await expect(
    filter.getByRole('button', { name: '穏やかの絞り込みを解除', exact: true })
  ).toHaveCount(0)

  await activate(page, filter.getByRole('button', { name: '条件をはずす', exact: true }))
  await expect(filter.getByRole('button', { name: 'すべての年', exact: true })).toBeVisible()
  await expect(filter.getByRole('button', { name: 'すべての月', exact: true })).toBeVisible()
  await expect(filter.getByRole('button', { name: 'どこで：すべて', exact: true })).toBeVisible()
})

for (const key of ['Enter', 'Space'] as const) {
  test(`認識結果を${key}で全文表示し、編集欄から確認ボタンへ移動できる`, async ({ page }) => {
    await openTranscript(page)
    await page.keyboard.press(key)

    const dialog = page.getByRole('dialog', { name: '話した内容の確認', exact: true })
    const input = dialog.getByRole('textbox', { name: '認識結果', exact: true })
    const confirm = dialog.getByRole('button', { name: '物語にする', exact: true })

    await expect(input).toBeFocused()
    await expect(input).toHaveValue(TRANSCRIPT_TEXT)

    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.insertText(INPUT_TEXT)
    await expect(input).toHaveValue(INPUT_TEXT)

    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'やめる', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(input).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
}

test('認識結果が空でもShift+Tabで操作可能なボタンへ戻れる', async ({ page }) => {
  await openTranscript(page)
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: '話した内容の確認', exact: true })
  const input = dialog.getByRole('textbox', { name: '認識結果', exact: true })

  await expect(input).toBeFocused()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await expect(dialog.getByRole('button', { name: '物語にする', exact: true })).toBeDisabled()

  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'やめる', exact: true })).toBeFocused()
})

test('詳細画面の編集欄と写真操作を名前で識別できる', async ({ page }) => {
  await openDetail(page)
  await activate(page, page.getByRole('button', { name: '編集する', exact: true }))

  await expect(page.getByRole('textbox', { name: '物語文', exact: true })).toHaveValue(STORY_TEXT)
  await expect(page.getByRole('button', { name: '写真を追加', exact: true })).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles(PHOTO)

  await expect(page.getByRole('button', { name: '写真を変更', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '写真を削除', exact: true })).toBeVisible()

  await activate(page, page.getByRole('button', { name: 'どこで', exact: true }))
  const options = page.locator('#entry-tag-options')
  await expect(options.getByRole('button', { name: '自然', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await activate(page, options.getByRole('button', { name: '家', exact: true }))
  await activate(page, page.getByRole('button', { name: 'どこで', exact: true }))
  await expect(options.getByRole('button', { name: '家', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await activate(page, page.getByRole('button', { name: 'どこで', exact: true }))

  await activate(page, page.getByRole('button', { name: '写真を削除', exact: true }))
  await expect(page.getByRole('button', { name: '写真を追加', exact: true })).toBeVisible()
})

test('削除確認モーダルに名前と説明がある', async ({ page }) => {
  await openDetail(page)
  await activate(page, page.getByRole('button', { name: '削除する', exact: true }))

  const dialog = page.getByRole('dialog', { name: 'この日記を削除する?', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleDescription('削除すると、物語も音声も写真も戻せません。')
})

test('削除確認を開くとモーダル内にフォーカスが移る', async ({ page }) => {
  await openDetail(page)
  await activate(page, page.getByRole('button', { name: '削除する', exact: true }))

  const dialog = page.getByRole('dialog', { name: 'この日記を削除する?', exact: true })

  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true)
})

test('削除確認モーダル内でTabとShift+Tabが循環する', async ({ page }) => {
  await openDetail(page)
  await activate(page, page.getByRole('button', { name: '削除する', exact: true }))

  const dialog = page.getByRole('dialog', { name: 'この日記を削除する?', exact: true })
  const cancel = dialog.getByRole('button', { name: 'やめる', exact: true })
  const confirm = dialog.getByRole('button', { name: '削除する', exact: true })

  await tabTo(page, cancel)
  await page.keyboard.press('Shift+Tab')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(cancel).toBeFocused()
})

test('Escapeで削除確認を閉じ、元のボタンへ戻れる', async ({ page }) => {
  await openDetail(page)
  await activate(page, page.getByRole('button', { name: '削除する', exact: true }))

  await expect(page.getByRole('dialog', { name: 'この日記を削除する?', exact: true })).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '削除する', exact: true })).toBeFocused()
})

test('削除確認を取り消すと元のボタンへ戻れる', async ({ page }) => {
  await openDetail(page)
  await activate(page, page.getByRole('button', { name: '削除する', exact: true }))

  const dialog = page.getByRole('dialog', { name: 'この日記を削除する?', exact: true })
  await activate(page, dialog.getByRole('button', { name: 'やめる', exact: true }))

  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '削除する', exact: true })).toBeFocused()
})

test('ホームと記録画面のラベル・コントラスト', async ({ page }, testInfo) => {
  await scanAccessibility(page, testInfo, 'ホーム')

  await activate(page, page.getByRole('button', { name: '物語をつくる', exact: true }))
  await scanAccessibility(page, testInfo, '音声入力')

  await activate(page, page.getByRole('button', { name: '文字で書く', exact: true }))
  await scanAccessibility(page, testInfo, 'テキスト入力・未入力')

  const input = page.getByRole('textbox', {
    name: '今日は どんな１日だった？',
    exact: true,
  })
  await input.fill(INPUT_TEXT)
  await scanAccessibility(page, testInfo, 'テキスト入力・入力済み')

  const submit = page.getByRole('button', { name: '書けたよ', exact: true })
  await submit.hover()
  await scanAccessibility(page, testInfo, 'テキスト送信ボタン・ホバー')
})

test('本棚と絞り込み候補のラベル・コントラスト', async ({ page }, testInfo) => {
  await openBookshelf(page)
  await scanAccessibility(page, testInfo, '本棚')

  for (const name of ['すべての年', 'すべての月', 'どこで：すべて', 'きもち：えらぶ']) {
    const button = page.locator('.bookshelf-filter').getByRole('button', { name, exact: true })

    await button.click()
    await expect(page.locator('#bookshelf-filter-options')).toBeVisible()
    await scanAccessibility(page, testInfo, `本棚候補・${name}`)
    await button.click()
  }

  await activate(page, page.getByRole('button', { name: '2026年9月の日記を開く', exact: true }))
  await scanAccessibility(page, testInfo, '日付一覧')
})

test('本棚の両ページの切り替え操作のラベル・コントラスト', async ({ page }, testInfo) => {
  await openPagedBookshelf(page)
  await expectShelfPage(page, 1)

  const controls = shelfControls(page)

  await expect(controls.status).toHaveAttribute('aria-live', 'polite')
  await expect(controls.status).toHaveAttribute('aria-atomic', 'true')
  await expect(controls.sidePrevious).toHaveAccessibleName('前の本棚')
  await expect(controls.sideNext).toHaveAccessibleName('次の本棚')

  await scanAccessibility(page, testInfo, '本棚・1ページ目')

  await controls.sideNext.hover()
  await scanAccessibility(page, testInfo, '本棚・次の矢印ホバー')

  await controls.textNext.hover()
  await scanAccessibility(page, testInfo, '本棚・次の文字ボタンホバー')

  await controls.sideNext.click()
  await expectShelfPage(page, 2)

  await page.locator('.bookshelf-filter-label').first().hover()
  await scanAccessibility(page, testInfo, '本棚・2ページ目')

  await controls.sidePrevious.hover()
  await scanAccessibility(page, testInfo, '本棚・前の矢印ホバー')

  await controls.textPrevious.hover()
  await scanAccessibility(page, testInfo, '本棚・前の文字ボタンホバー')
})

test('認識結果モーダルのラベル・コントラスト', async ({ page }, testInfo) => {
  await openTranscript(page)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: '認識結果', exact: true })).toBeVisible()
  await scanAccessibility(page, testInfo, '認識結果・編集')
})

test('物語生成結果と写真操作のラベル・コントラスト', async ({ page }, testInfo) => {
  await generateStory(page)
  await scanAccessibility(page, testInfo, '物語生成結果')

  await page.locator('input[type="file"]').setInputFiles(PHOTO)
  await expect(page.getByRole('button', { name: '写真を変更', exact: true })).toBeVisible()
  await scanAccessibility(page, testInfo, '物語生成結果・写真あり')
})

test('詳細・編集・削除確認のラベル・コントラスト', async ({ page }, testInfo) => {
  await openDetail(page)
  await expect(page.getByText(STORY_TEXT, { exact: true })).toBeVisible()
  await scanAccessibility(page, testInfo, '日記詳細')

  await activate(page, page.getByRole('button', { name: '編集する', exact: true }))
  await scanAccessibility(page, testInfo, '日記編集')

  for (const name of ['どこで', 'きもち']) {
    const button = page.getByRole('button', { name, exact: true })

    await button.click()
    await expect(page.locator('#entry-tag-options')).toBeVisible()
    await scanAccessibility(page, testInfo, `日記編集候補・${name}`)
    await button.click()
  }

  await page.locator('input[type="file"]').setInputFiles(PHOTO)
  await expect(page.getByRole('button', { name: '写真を削除', exact: true })).toBeVisible()
  await scanAccessibility(page, testInfo, '日記編集・写真あり')

  await activate(page, page.getByRole('button', { name: 'やめる', exact: true }))
  await activate(page, page.getByRole('button', { name: '削除する', exact: true }))
  await expect(page.getByRole('dialog')).toBeVisible()
  await scanAccessibility(page, testInfo, '削除確認')
})
