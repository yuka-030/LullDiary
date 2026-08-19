// apps/desktop/src/main.tsx
import { Image } from '@tauri-apps/api/image'
import { resolveResource } from '@tauri-apps/api/path'
import { getCurrentWindow } from '@tauri-apps/api/window'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const appWindow = getCurrentWindow()

// リソースのシステム絶対パスを解決
const resourcePath = await resolveResource('../public/LullDiary_icon.png')

// パスからImageオブジェクトを生成
// ※ Cargo.tomlの "image-png" が有効でないとエラーになる
const icon = await Image.fromPath(resourcePath)

// アイコンを設定
await appWindow.setIcon(icon)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
