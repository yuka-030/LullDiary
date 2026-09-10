# LullDiary

その日の出来事を、寝る前に読み返せるやさしい物語にする日記アプリです。

声または文字で入力した内容から物語と読み上げ音声を生成し、写真と一緒に保存できます。保存した日記は本棚から開き、編集・削除・絞り込みができます。

## コンセプト

一日の終わりに、無理に前向きにならなくても使える日記を目指しています。

画面は温かみのある配色と本の表現で構成しています。物語の生成では、元の入力にない出来事や励ましを付け足さず、その日の出来事や気持ちを残すようにプロンプトを調整しています。

## 実装済みの機能

- 最大3分の録音と文字起こし
- 120字までのテキスト入力
- 入力文字数の表示とバリデーション
- Windowsでの入力開始時の日本語入力への切り替え
- 物語の生成と整形を分けた二段階の処理
- シーンと感情のタグ抽出
- 物語の読み上げと文字の順次表示
- 写真1枚の添付・変更・削除
- 日記の保存・閲覧・編集・削除
- 年月・シーン・感情による絞り込み
- キーボード操作、操作要素のラベル、モーダルのフォーカス制御

## 構成

| 担当                     | 使用技術                        |
| ------------------------ | ------------------------------- |
| デスクトップアプリ       | Tauri 2                         |
| 画面                     | React、TypeScript、Tailwind CSS |
| ローカルAPI              | Bun、Hono                       |
| 入力検証                 | Zod                             |
| データベース             | SQLite、bun:sqlite              |
| 音声前処理               | Rust、C                         |
| 文字起こし               | whisper.cpp                     |
| 物語生成・整形・タグ抽出 | Ollama                          |
| 読み上げ                 | VOICEVOX                        |
| 画像変換                 | sharp                           |

音声入力では、録音した音声をRustとCで前処理し、WAVにしてローカルAPIへ送信します。whisper.cppで文字起こしした後、Ollamaで物語を生成します。

テキスト入力では、文字起こしを経由せず物語を生成します。

日記の文章を処理するAIはローカルで動作します。ただし、依存パッケージやモデルの取得、Google Fontsの読み込みには外部通信があるため、完全なオフライン動作を保証する構成ではありません。

## ディレクトリ

```text
apps/
  desktop/
    src/
      components/     画面を構成する部品
      screens/        各画面
      lib/            状態管理、API通信、入力検証
    src-tauri/        Tauri設定、Rust処理、Cとの連携
  server/
    src/
      db/             日記の取得・保存とスキーマ
      media/          写真・音声の検証と保存
      story/          物語生成
      stt/            文字起こし
      tag/            タグ抽出
      tts/            読み上げ
      validation/     入力検証
    app_data/         実行時に生成するデータ
    vendor/           whisper.cpp
native/
  audio-preprocess/   Cの音声前処理
tests/
  e2e/                TauriアプリのE2Eテスト
docs/                 要件・設計・テストのドキュメント
```

## 開発環境

動作確認はWindowsで行っています。

事前に次の環境を用意します。

- Git
- Bun
- Node.js
- Rust
- Visual StudioのC++ビルドツールとWindows SDK
- WebView2
- CMake
- Ollama
- VOICEVOX

Tauriの開発環境については、[公式の事前準備](https://v2.tauri.app/start/prerequisites/)を参照してください。

以降のコマンドは、特記がない限りリポジトリのルートで実行します。

### 依存パッケージ

```powershell
bun install --frozen-lockfile
```

### 環境変数

初回のみ、次のファイルをコピーします。既存の `.env` がある場合は、その設定を引き継ぎます。

```powershell
Copy-Item apps/desktop/.env.example apps/desktop/.env
```

```powershell
Copy-Item apps/server/.env.example apps/server/.env
```

フロントエンドのAPI接続先は次の値を使用します。

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

サーバー側ではOllama・VOICEVOXの接続先とモデル名を設定します。設定項目は `apps/server/.env.example` を参照してください。

接続先を変更する場合は、CSPやサーバーの許可設定との整合も確認します。

### whisper.cpp

`apps/server/vendor/whisper.cpp` に配置します。

```powershell
git clone https://github.com/ggerganov/whisper.cpp.git apps/server/vendor/whisper.cpp
```

whisper.cppのディレクトリで、モデルを取得します。

```powershell
Push-Location apps/server/vendor/whisper.cpp
```

```powershell
.\models\download-ggml-model.cmd small
```

```powershell
Pop-Location
```

リポジトリのルートでビルドします。

```powershell
cmake -S apps/server/vendor/whisper.cpp -B apps/server/vendor/whisper.cpp/build
```

```powershell
cmake --build apps/server/vendor/whisper.cpp/build --config Release
```

Windowsでは、次のファイルを使用します。

- `apps/server/vendor/whisper.cpp/build/bin/Release/whisper-cli.exe`
- `apps/server/vendor/whisper.cpp/models/ggml-small.bin`

### Ollama

Ollamaを起動し、ベースモデルを取得します。

```powershell
ollama pull dsasai/llama3-elyza-jp-8b
```

用途別のモデルを作成します。

```powershell
bun run setup:ollama
```

物語生成・整形・タグ抽出で同じベースモデルを使用します。

### VOICEVOX

VOICEVOXをインストールし、セットアップ処理を実行します。

```powershell
bun run setup:voicevox
```

エンジンの場所を自動検出できない場合は、サーバー側の `.env` に `VOICEVOX_ENGINE_PATH` を設定します。

## 起動

```powershell
bun run dev
```

OllamaとVOICEVOXの準備後、ローカルAPIとTauriアプリを起動します。

## データの保存

日記のデータは `apps/server/app_data` に保存します。

- データベース：`db/lulldiary.db`
- 読み上げ音声：`narration/`
- 写真：`photos/`

元の録音音声は日記として保存しません。文字起こし時に一時ファイルを使用し、処理後に削除します。

写真は1枚までです。JPEG・PNG・WebPを受け付け、保存時に長辺を最大1000pxへ縮小し、JPEGへ変換します。

## テスト

単体・結合・ブラウザー操作・E2Eテストの実行方法は、[テスト設計](docs/design-test.md)を参照してください。

TauriアプリのE2Eテストは、外部プロセスを使用するため手元で実行します。

## セキュリティと制約

入力検証、SQLのパラメーター化、ファイル形式と容量の検証、保存先の検証、Host・Originの確認、CSP、配信時の `nosniff` ヘッダーを実装しています。

2026年9月10日時点では、E2E用の依存関係に含まれる `extract-zip` に2件の脆弱性が残っています。WebDriverを手動で用意する構成ですが、依存パッケージ自体の解消とは別のため、継続して確認します。

画面のコントラストは自動検査と目視で確認しています。テイストを保つために影や背景などで視認性を補っている箇所があり、すべての要素についてコントラスト基準への適合を確認したものではありません。

## ドキュメント

- [要件定義](docs/requirements.md)
- [UI設計](docs/design-ui.md)
- [AI処理設計](docs/design-ai.md)
- [データベース設計](docs/design-db.md)
- [テスト設計](docs/design-test.md)
- [デスクトップアプリ](apps/desktop/README.md)
