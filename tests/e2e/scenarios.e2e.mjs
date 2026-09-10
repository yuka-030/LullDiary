// tests/e2e/scenarios.e2e.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, $, $$ } from '@wdio/globals'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const testRoot = process.env.E2E_ROOT
const apiUrl = 'http://127.0.0.1:3000'

let fixtures

// 表示文字または読み上げ名によるボタンの操作
async function clickButton(text) {
  const button = await $(`//button[@aria-label="${text}" or normalize-space(.)="${text}"]`)

  await button.waitForDisplayed()
  await button.waitForEnabled()
  await button.click()
}

// テスト用サーバーからの取得
async function getResponse(endpoint) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    signal: AbortSignal.timeout(10000),
  })

  assert.equal(
    response.headers.get('X-LullDiary-E2E'),
    process.env.E2E_TOKEN,
    'テスト用サーバー以外には接続しません'
  )

  return response
}

async function getEntries() {
  const response = await getResponse('/entries')
  assert.equal(response.status, 200)
  return (await response.json()).entries
}

async function getEntry(id) {
  const response = await getResponse(`/entries/${id}`)
  assert.equal(response.status, 200)
  return (await response.json()).entry
}

// 本棚に並ぶ月の確認
async function expectBooks(labels) {
  const expected = [...labels].sort()

  await browser.waitUntil(
    async () => {
      const actual = await browser.execute(() =>
        Array.from(document.querySelectorAll('button.book-spine'), (button) =>
          button.getAttribute('aria-label')
        )
      )

      return JSON.stringify(actual.sort()) === JSON.stringify(expected)
    },
    {
      timeoutMsg: `本棚の表示が一致しません: ${labels.join('、')}`,
    }
  )
}

// 本棚から指定した日記を開く操作
async function openEntry(entry) {
  const date = new Date(entry.created_at)
  const label = `${date.getFullYear()}年${date.getMonth() + 1}月の日記を開く`
  const book = await $(`button[aria-label="${label}"]`)

  await book.waitForDisplayed()
  await book.click()

  const excerpt = entry.story_text.slice(0, 18)

  await browser.waitUntil(
    async () => {
      for (const row of await $$('.bookshelf-date-item')) {
        if ((await row.getText()).includes(excerpt)) {
          return true
        }
      }

      return false
    },
    { timeoutMsg: '日付リストに対象の日記が表示されません' }
  )

  for (const row of await $$('.bookshelf-date-item')) {
    if ((await row.getText()).includes(excerpt)) {
      await row.click()
      break
    }
  }

  await $('//button[normalize-space(.)="編集する"]').waitForDisplayed()
}

// 物語文の表示完了の確認
async function expectStory(text) {
  await browser.waitUntil(async () => (await $('.story-text').getText()) === text, {
    timeout: 120000,
    timeoutMsg: '物語文の表示が一致しません',
  })
}

// 音を出さずに読み上げ処理を進める設定
async function muteNarration() {
  await browser.execute(() => {
    const originalPlay = HTMLMediaElement.prototype.play

    HTMLMediaElement.prototype.play = function () {
      this.muted = true
      return originalPlay.call(this)
    }

    for (const element of document.querySelectorAll('audio, video')) {
      element.muted = true
    }
  })
}

// 合成音声をマイク入力へ渡す設定
async function installMicrophone() {
  const audioFiles = ['first.wav', 'second.wav'].map((filename) =>
    readFileSync(path.join(testRoot, filename)).toString('base64')
  )

  return browser.executeAsync((files, done) => {
    async function prepare() {
      const context = new AudioContext()
      const buffers = []

      for (const encoded of files) {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))

        buffers.push(await context.decodeAudioData(bytes.buffer))
      }

      const state = {
        streams: [],
        sources: [],
      }

      window.__e2eMicrophone = state

      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => {
          const index = state.streams.length

          if (index >= buffers.length) {
            throw new Error('予定外の録音開始です')
          }

          await context.resume()

          const source = context.createBufferSource()
          const destination = context.createMediaStreamDestination()

          source.buffer = buffers[index]
          source.connect(destination)

          state.streams.push(destination.stream)
          state.sources.push(source)

          // 録音側の接続が完了してからの音声開始
          source.start(context.currentTime + 0.4)

          return destination.stream
        },
      })

      return buffers.map((buffer) => buffer.duration)
    }

    prepare().then(
      (durations) => done({ durations }),
      (error) => done({ error: error.message })
    )
  }, audioFiles)
}

describe('LullDiaryのE2E', () => {
  beforeEach(async function () {
    try {
      if (this.currentTest !== this.test.parent.tests[0]) {
        await browser.refresh()
      }

      await $('button[aria-label="物語をつくる"]').waitForDisplayed({
        timeout: 30000,
      })
    } catch (error) {
      try {
        const state = await browser.execute(() => ({
          url: location.href,
          readyState: document.readyState,
          title: document.title,
          rootHtml: document.querySelector('#root')?.innerHTML.slice(0, 2000),
          bodyText: document.body?.innerText.slice(0, 2000),
        }))

        console.error('ホーム画面の確認失敗:', JSON.stringify(state, null, 2))
      } catch (diagnosticError) {
        console.error('画面の状態を取得できませんでした:', diagnosticError.message)
      }

      throw error
    }

    const result = spawnSync(process.env.E2E_BUN, [path.join(projectRoot, 'tests/e2e/seed.mjs')], {
      cwd: projectRoot,
      env: process.env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    })

    assert.equal(
      result.status,
      0,
      result.error?.message ?? result.stderr ?? 'テストデータの初期化に失敗しました'
    )

    fixtures = JSON.parse(result.stdout)

    await browser.setTimeout({ script: 30000 })
    await muteNarration()
  })

  it('S1: テキスト入力から物語を生成して保存できる', async () => {
    const inputText = '今日は家でお茶を飲みました。ゆっくり過ごせて嬉しかったです。'

    await clickButton('物語をつくる')
    await clickButton('文字で書く')

    const textarea = await $('textarea.recording-textarea')
    await textarea.waitForDisplayed()
    await textarea.setValue(inputText)
    assert.equal(await textarea.getValue(), inputText)

    await clickButton('書けたよ')

    const saveButton = await $('//button[normalize-space(.)="保存する"]')
    await saveButton.waitForDisplayed({ timeout: 240000 })
    await saveButton.waitForEnabled({ timeout: 60000 })

    const storyText = await $('.story-text').getText()
    assert.ok(storyText.trim().length > 0)

    // 音声生成の成功と読み上げ完了
    await browser.waitUntil(
      () =>
        browser.execute(() => {
          const audio = document.querySelector('audio')
          return Boolean(audio?.getAttribute('src')) && audio.readyState >= 2
        }),
      { timeout: 120000, timeoutMsg: '読み上げ音声を確認できません' }
    )

    await saveButton.click()
    await $('.bookshelf-frame').waitForDisplayed()

    let saved

    await browser.waitUntil(
      async () => {
        saved = (await getEntries()).find((entry) => entry.raw_input_text === inputText)
        return Boolean(saved)
      },
      { timeoutMsg: '入力した日記が保存されていません' }
    )

    assert.equal(saved.input_type, 'text')
    assert.equal(saved.story_text, storyText)
    assert.ok(saved.tags.感情.length > 0)
    assert.ok(saved.narration_path)

    const narrationRoot = path.join(testRoot, 'app_data/narration')
    const relative = path.relative(narrationRoot, saved.narration_path)

    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative))
    assert.ok(statSync(saved.narration_path).size > 44)

    await openEntry(saved)
    await expectStory(storyText)
  })

  it('S2: 録音を停止して録り直し、後の録音をテキスト化できる', async () => {
    await clickButton('物語をつくる')

    const microphone = await installMicrophone()
    assert.equal(microphone.error, undefined)

    await $('button[aria-label="録音を開始する"]').click()
    await $('button[aria-label="録音を停止する"]').waitForDisplayed()

    // 合成音声を最後まで録音するための待機
    await browser.pause(Math.ceil((microphone.durations[0] + 0.8) * 1000))
    await $('button[aria-label="録音を停止する"]').click()

    await $('//button[normalize-space(.)="録り直す"]').waitForDisplayed()

    assert.equal(
      await browser.execute(() =>
        window.__e2eMicrophone.streams[0].getTracks().every((track) => track.readyState === 'ended')
      ),
      true
    )

    await clickButton('録り直す')
    await $('button[aria-label="録音を停止する"]').waitForDisplayed()

    assert.equal(await browser.execute(() => window.__e2eMicrophone.streams.length), 2)

    await browser.pause(Math.ceil((microphone.durations[1] + 0.8) * 1000))
    await $('button[aria-label="録音を停止する"]').click()
    await clickButton('作成する')

    const dialog = await $('[role="dialog"][aria-label="話した内容の確認"]')
    await dialog.waitForDisplayed({ timeout: 180000 })

    const transcript = await $('textarea[aria-label="認識結果"]')
    await transcript.waitForDisplayed({ timeout: 30000 })

    const text = await transcript.getValue()
    assert.ok(text.includes('公園'), `録り直した音声と一致しません: ${text}`)
    assert.ok(!text.includes('雨'), `最初の録音が残っています: ${text}`)
  })

  it('S3: 本棚から月と日付を選び、日記を開ける', async () => {
    await clickButton('本棚を見る')

    await expectBooks(['2024年1月の日記を開く', '2024年2月の日記を開く', '2024年3月の日記を開く'])

    await openEntry(fixtures[0])
    await expectStory(fixtures[0].story_text)

    const tags = await $('.entry-detail-tag-marks').getText()
    assert.ok(tags.includes('家'))
    assert.ok(tags.includes('嬉しい'))
  })

  it('S4: 日記の物語文とタグを編集し、開き直して確認できる', async () => {
    const updatedStory = '庭の花を眺めて、穏やかな気持ちになりました。'

    await clickButton('本棚を見る')
    await openEntry(fixtures[0])
    await clickButton('編集する')

    const textarea = await $('textarea[aria-label="物語文"]')
    await textarea.setValue(updatedStory)
    assert.equal(await textarea.getValue(), updatedStory)

    await clickButton('どこで')
    await $('#entry-tag-options').waitForDisplayed()
    await clickButton('自然')
    await clickButton('保存する')

    await $('//button[normalize-space(.)="編集する"]').waitForDisplayed({
      timeout: 120000,
    })

    const saved = await getEntry(fixtures[0].id)
    assert.equal(saved.story_text, updatedStory)
    assert.equal(saved.tags.シーン, '自然')

    await clickButton('← 本棚にもどる')
    await openEntry(saved)
    await expectStory(updatedStory)

    assert.ok((await $('.entry-detail-tag-marks').getText()).includes('自然'))
  })

  it('S5: 削除を確認すると日記が本棚とDBから消える', async () => {
    await clickButton('本棚を見る')
    await openEntry(fixtures[0])
    await clickButton('削除する')

    const dialog = await $('[role="dialog"]')
    await dialog.waitForDisplayed()

    assert.ok((await dialog.getText()).includes('この日記を削除する?'))

    const confirmButton = await $('[role="dialog"] button.confirm-modal-confirm')
    await confirmButton.click()

    await dialog.waitForExist({ reverse: true })

    await expectBooks(['2024年2月の日記を開く', '2024年3月の日記を開く'])

    const response = await getResponse(`/entries/${fixtures[0].id}`)
    assert.equal(response.status, 404)
    assert.equal((await getEntries()).length, 2)
  })

  it('S6: シーンと感情の両方で絞り込み、条件を解除できる', async () => {
    await clickButton('本棚を見る')

    await expectBooks(['2024年1月の日記を開く', '2024年2月の日記を開く', '2024年3月の日記を開く'])

    await $('button[aria-label="どこで：すべて"]').click()
    await $('#bookshelf-filter-options').waitForDisplayed()
    await clickButton('家')

    await expectBooks(['2024年1月の日記を開く', '2024年2月の日記を開く'])

    const emotionButton = await $('button[aria-label^="きもち："]')
    await emotionButton.click()

    const happy = await $(
      '//*[@id="bookshelf-filter-options"]//label[normalize-space(.)="嬉しい"]/input'
    )
    await happy.waitForDisplayed()
    await happy.click()

    if ((await emotionButton.getAttribute('aria-expanded')) === 'true') {
      await emotionButton.click()
    }

    await expectBooks(['2024年1月の日記を開く'])

    await clickButton('条件をはずす')

    await expectBooks(['2024年1月の日記を開く', '2024年2月の日記を開く', '2024年3月の日記を開く'])
  })
})
