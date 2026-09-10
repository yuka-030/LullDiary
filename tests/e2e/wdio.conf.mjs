// tests/e2e/wdio.conf.mjs
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

if (!process.env.E2E_ROOT || !process.env.E2E_TOKEN) {
  throw new Error('bun run test:e2e から実行してください')
}

export const config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',
  specs: [path.join(projectRoot, 'tests/e2e/scenarios.e2e.mjs').replaceAll('\\', '/')],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: path.join(projectRoot, 'apps/desktop/src-tauri/target/debug/desktop.exe'),
      },
    },
  ],
  logLevel: 'error',
  reporters: ['spec'],
  framework: 'mocha',
  waitforTimeout: 30000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 0,
  specFileRetries: 0,
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000,
    retries: 0,
  },
}
