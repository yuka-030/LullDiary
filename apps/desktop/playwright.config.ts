// apps/desktop/playwright.config.ts
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.pw.ts',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 4174 --strictPort',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:4174/api',
    },
  },
})
