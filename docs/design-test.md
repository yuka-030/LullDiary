# テスト設計

## 方針

処理単位の確認、APIと保存処理の連携、ブラウザー上の操作、実際のTauriアプリの操作を分けて確認する。

AIの文章品質や画面の印象は、自動テストだけで合否を決めず手動でも確認する。

コマンドはリポジトリのルートで実行する。

## 単体テスト

### サーバー

主な対象は次のとおり。

- 日記の作成・取得・更新・削除・絞り込み
- 保存する日記のスキーマ
- 物語生成と整形
- タグ抽出
- テキスト入力の検証
- 写真・音声の形式と容量
- 保存先のパス
- 写真の縮小と変換

外部のAI処理は差し替え、受け渡す値、戻り値、失敗時の処理を確認する。

```powershell
bun test --cwd apps/server
```

このコマンドでは、サーバーの結合テストとセキュリティテストも実行する。

### フロントエンド

対象は次のファイルとする。

- `apps/desktop/src/lib/story/useStory.test.ts`
- `apps/desktop/src/lib/recording/useRecordingFlow.test.ts`
- `apps/desktop/src/lib/recording/useRecordingFlow.text.test.ts`
- `apps/desktop/src/lib/recording/textInput.test.ts`

物語生成の状態、音声生成に失敗した場合の扱い、録音の停止、入力方法の切り替え、120字制限などを確認する。

```powershell
bun test --cwd apps/desktop
```

### Rust

音声前処理の戻り値、無音時の扱い、配列の範囲などを確認する。

```powershell
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

### C

音声前処理の処理単位を確認する。

WindowsではMinGWのビルド環境を用意して実行する。

```powershell
mingw32-make -C native/audio-preprocess test
```

LinuxのCIでは次のコマンドを使用する。

```text
make -C native/audio-preprocess test
```

## 結合テスト

`apps/server/src/index.integration.test.ts` で、APIとデータベース・ファイル保存の連携を確認する。

- `POST /stt`
- `POST /generate-story`
- `POST /entries`
- `GET /entries`
- `GET /entries/:id`
- `PATCH /entries/:id`
- `DELETE /entries/:id`

テスト専用のデータベースと保存先を用意し、通常の日記データを使用しない。

whisper.cpp・Ollama・VOICEVOXは差し替え、呼び出しの成否と結果の扱いを確認する。

主な確認事項は次のとおり。

- 日記と添付ファイルが保存される。
- 絞り込み条件が反映される。
- 更新内容が取得結果へ反映される。
- 削除した日記のファイルも削除される。
- 不正な入力や外部処理の失敗を適切に扱う。

## セキュリティテスト

`apps/server/src/security.test.ts` などで次を確認する。

- Hostと送信元の制限
- リクエスト容量の制限
- 保存前の入力検証
- 写真・音声の形式検証
- 保存先の範囲
- 配信時の `nosniff` ヘッダー
- 不正な更新によって既存の内容が変更されないこと

依存パッケージの確認は別途実行する。

```powershell
bun audit
```

2026年9月10日時点では、E2E用の依存関係に含まれる `extract-zip` に2件の脆弱性が残っている。テストの成功と依存パッケージの脆弱性解消は、別の確認として扱う。

## ブラウザー操作テスト

Playwrightで次のファイルを実行する。

- `apps/desktop/src/App.a11y.pw.ts`
- `apps/desktop/src/screens/RecordingScreen.text.pw.ts`

API、録音、Tauriの処理を差し替え、画面操作を確認する。

- キーボードによる入力と保存
- 本棚のページ切り替えと無効状態
- 絞り込みの操作
- 操作要素の読み上げ用の名前
- モーダルのフォーカス移動・循環・復帰
- 120字の入力と121字以上の送信防止
- 上限以内へ戻した場合の送信
- 日本語変換中の送信防止
- 空白だけの入力の送信防止
- 案内文と文字数の表示
- 自動検査の対象とした箇所のコントラスト

自動検査から除外したコントラストは、このテストの成功で基準適合と判断しない。影や背景などによる視認性の工夫は、目視確認として記録する。

### 初回の準備

```powershell
node apps/desktop/node_modules/@playwright/test/cli.js install chromium
```

### 実行

```powershell
node apps/desktop/node_modules/@playwright/test/cli.js test --config apps/desktop/playwright.config.ts
```

設定した開発サーバーはPlaywrightから起動する。

HTMLレポートは必要な場合だけ確認する。成功時に毎回開く必要はない。

## TauriアプリのE2Eテスト

WebDriverIOとtauri-driverで実際のアプリを操作する。

設定とシナリオは `tests/e2e/` に置く。

| シナリオ | 確認内容                                         |
| -------- | ------------------------------------------------ |
| S1       | テキスト入力から物語を生成して保存する           |
| S2       | 録音を停止して録り直し、後の録音を文字起こしする |
| S3       | 本棚から月と日付を選んで日記を開く               |
| S4       | 物語文とタグを編集し、開き直して確認する         |
| S5       | 確認後に日記を削除し、取得できないことを確認する |
| S6       | シーンと感情で絞り込み、条件を解除する           |

### 接続する処理

Ollama・VOICEVOX・whisper.cppは実際の処理を使用する。

録音にはテスト用の仮想マイクを使用し、実際のマイクへの発話は不要とする。録り直し前後で内容を変え、後の音声が文字起こしされたことを確認する。

読み上げの出力はミュートする。実際のマイクの収音品質やスピーカーの音質は、このテストの確認範囲に含めない。

### データの分離

通常のアプリとは別のデータベース、ファイル保存先、WebViewプロファイルを使用する。

シナリオごとに初期データを用意する。終了時は起動したプロセスを終了し、一時データを削除する。

Windowsでファイルが使用中の場合は後片付けに失敗することがあるため、終了ログも確認する。

### 事前準備

- 通常のアプリとローカルAPIを終了する。
- ポート3000・4444・4445を使用できる状態にする。
- OllamaとVOICEVOXを利用できる状態にする。
- 必要なモデルとwhisper.cppを用意する。
- WebView2に対応するMicrosoft Edge WebDriverを用意し、PATHへ登録する。
- Rustのビルドに必要な空き容量を確保する。

tauri-driverは初回にインストールする。

```powershell
cargo install tauri-driver --locked
```

必要に応じて外部処理の準備を行う。

```powershell
bun run setup:ollama
```

```powershell
bun run setup:voicevox
```

### 実行

```powershell
bun run test:e2e
```

実行スクリプトがE2E用のアプリをビルドし、テスト用APIとドライバーを起動する。

6つのシナリオがすべて成功したことと、終了時のエラーがないことを確認する。

## CI

GitHub Actionsで次を実行する。

- フォーマット確認
- Lint
- TypeScriptの型チェック
- サーバーのテスト
- フロントエンドの単体テスト
- Cのテスト
- Rustのテスト
- Playwrightのブラウザー操作テスト

TauriアプリのE2Eテストは外部プロセスを使用するため、CIでは実行せず手元で実行する。

現在のCIには `bun audit` の実行を含めていない。

## 手動確認

- 物語の内容が入力から大きく外れていないこと
- 語り口が不自然でないこと
- 読み上げの速度、間、聞き取りやすさ
- 実際のマイクでの録音
- 余白、文字サイズ、写真の表示
- ホバーとキーボードフォーカスの見やすさ
- 自動検査の対象外とした配色
- Windowsでの日本語入力への切り替え

手動確認できなかった項目は、未確認として残す。
