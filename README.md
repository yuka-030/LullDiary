# LullDiary

> 話すだけで、今日という日が優しい物語になる。ローカル完結の音声日記アプリ。

音声(またはテキスト)で「今日あった出来事」を入力すると、ローカルLLMが寝る前の読み聞かせのような優しい物語に変換します。文章として読めるほか、TTSによる読み上げにも対応。処理はすべてローカルで完結し、外部にデータを送信しません。

## Concept

- **話すだけで日記になる**:音声入力で、書くハードルをなくす
- **物語として残る**:単なる記録ではなく、後で読み返したくなる短い物語に変換する
- **嫌なことがあった日も、ほっとする**:出来事をまず受け止めてから、優しい着地に導くプロンプト設計
- **プライバシー重視**:個人の記録を扱うため、STT・LLM・TTSすべてローカル処理

## Features (MVP)

- [ ] 音声入力 / テキスト入力
- [ ] ローカルLLMによる物語生成(読み聞かせ調)
- [ ] 入力内容からのタグ抽出(対象者・シーン・感情・登場人物)
- [ ] 生成物語の音声読み上げ(TTS)
- [ ] 写真添付(任意・思い出を残したい日だけ)
- [ ] 日記の一覧・閲覧

## Architecture

```mermaid
flowchart TB
    subgraph UI["Tauri (Rust + React/TS)"]
        A[録音・記録画面]
        B[閲覧・再生画面]
    end

    subgraph API["Hono ローカルAPIサーバー (Bun)"]
        C["/stt /generate-story /extract-tags /tts /entries"]
    end

    subgraph AI["AI実行系 (ローカルHTTPサーバー/バイナリ)"]
        D[自作Cライブラリ<br/>音声前処理]
        E[whisper.cpp<br/>STT]
        F[Ollama<br/>物語生成・タグ抽出]
        G[VOICEVOX<br/>TTS]
    end

    H[(SQLite)]

    A --> C
    B --> C
    C --> D --> E
    C --> F
    C --> G
    C --> H
```

## Tech Stack

| レイヤー       | 技術                            | 選定理由                                                                                                                                                    |
| -------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UIシェル       | Tauri (Rust + React/TypeScript) | Electronより軽量・省メモリ。Rustコアでファイル/マイクアクセスを安全に扱える。Tauri 2.0のモバイル対応で将来のスマホ展開も見据えられる                        |
| ローカルAPI    | Hono (Bun)                      | 軽量・高速起動。将来PCサーバー化する場合もそのままネットワーク公開できる                                                                                    |
| バリデーション | Zod                             | LLM出力(JSON)のスキーマ検証で堅牢性を担保                                                                                                                   |
| 音声前処理     | 自作Cライブラリ                 | 無音トリミング・簡易VAD・音量正規化を実装。バッファ操作やメモリ効率が求められる領域で、Cを選ぶ妥当性が説明しやすい。RustからFFI(`extern "C"`)経由で呼び出す |
| STT            | whisper.cpp                     | ローカルCPUでも実用的な速度・精度の日本語音声認識                                                                                                           |
| LLM            | Ollama (Llama-3-ELYZA-JP-8B)    | ローカル完結。日本語特化チューニングにより、読み聞かせ調の自然な文章を生成できる                                                                            |
| TTS            | VOICEVOX                        | 無料・ローカルで動作する、感情豊かな日本語音声合成                                                                                                          |
| DB             | SQLite (`bun:sqlite`)           | 追加依存なしでBunから直接利用可能                                                                                                                           |

## Why C?

音声の前処理(無音区間トリミング・簡易VAD・音量正規化)を自作のC言語ライブラリとして実装しています。音声・信号処理は伝統的にバッファ操作やメモリ効率が求められる領域であり、既存スタック(whisper.cppもC/C++実装)とも地続きで技術選定の妥当性が説明できるため、この部分にCを採用しました。RustのFFI(`extern "C"`)を介してTauriバックエンドから呼び出す構成です。

## Getting Started

> 詳細な手順は今後整備予定です。以下は想定するセットアップの概要です。

### Prerequisites

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/) / [Tauri CLI](https://tauri.app/)
- [CMake](https://cmake.org/)(whisper.cppのビルド用)
- [Ollama](https://ollama.com/)(ローカルLLM実行)
- [VOICEVOX](https://voicevox.hiroshiba.jp/)(ローカルTTSエンジン)
- Cコンパイラ・make(前処理ライブラリのビルド用)
  - macOS / Linux: gcc または clang、make
  - Windows: [MSYS2](https://www.msys2.org/) 経由で導入

Windows で MSYS2 から導入する場合:

```powershell
winget install -e --id MSYS2.MSYS2
C:\msys64\usr\bin\bash.exe -lc "pacman -S --noconfirm mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-make"
```

導入後、`C:\msys64\ucrt64\bin` を PATH に追加してください。

### Setup

```bash
# 依存パッケージのインストール
bun install
```

#### whisper.cpp のセットアップ

STTエンジンとして whisper.cpp を使用します。ソース・モデルファイルはリポジトリに含めていないため、初回のみ以下の手順でセットアップしてください。

```bash
# ソースの取得
cd apps/server/vendor
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# 日本語モデル(small)のダウンロード
# Windows
.\models\download-ggml-model.cmd small
# macOS / Linux
bash ./models/download-ggml-model.sh small

# ビルド
cmake -B build
cmake --build build --config Release
```

動作確認:

```bash
# Windows
.\build\bin\Release\whisper-cli.exe -m ggml-small.bin -f samples\jfk.wav -l ja
# macOS / Linux
./build/bin/whisper-cli -m ggml-small.bin -f samples/jfk.wav -l ja
```

#### Cライブラリのビルド

音声前処理用の共有ライブラリをビルドします。

```bash
cd native/audio-preprocess
make            # Windows: mingw32-make
make test       # テスト実行(Windows: mingw32-make test)
cd ../..
```

#### Ollama のセットアップ

物語生成に使用するローカルLLMです。[Ollama](https://ollama.com/) をインストールした後、ベースモデルを取得してください。

```bash
ollama pull dsasai/llama3-elyza-jp-8b
```

語り手の設定と生成パラメータは `apps/server/ollama/Modelfile` と `apps/server/ollama/Modelfile.tag` で管理しています。`bun run dev` を実行するたびに、最新の Modelfile からカスタムモデルが自動的に作成されます。

動作確認:

```bash
ollama run lulldiary-story "今日は開発をした。新しい技術ばかりで環境構築が難しかった。"
```

読み聞かせのような語り口で応答が返れば正常です。初回はモデルの読み込みに時間がかかります。

#### VOICEVOX のセットアップ

読み上げに使用するTTSエンジンです。[VOICEVOX](https://voicevox.hiroshiba.jp/) からダウンロードし、別プロセスとして起動しておいてください。

#### 環境変数の設定

`apps/desktop` と `apps/server` に、それぞれ `.env.example` をコピーして `.env` を作成してください。

```bash
cp apps/desktop/.env.example apps/desktop/.env
cp apps/server/.env.example apps/server/.env
```

#### 開発サーバーの起動

```bash
bun run dev
```

Honoサーバー(localhost:3000)とTauriアプリが同時に起動します。

## Project Structure

```
lulldiary/
├── apps/
│   ├── desktop/                    # Tauri アプリ (Rust + React/TS)
│   │   ├── src/
│   │   │   ├── components/         # 共通コンポーネント
│   │   │   ├── lib/                # 音声録音・WAVエンコード等のロジック
│   │   │   ├── screens/            # 画面コンポーネント
│   │   │   ├── App.tsx
│   │   │   ├── index.css           # Tailwind テーマ定義
│   │   │   └── main.tsx
│   │   └── src-tauri/              # Tauri (Rust) バックエンド
│   └── server/                     # Hono (Bun) ローカルAPIサーバー
│       ├── src/
│       │   ├── db/                 # SQLite 接続モジュール
│       │   ├── stt/                # whisper.cpp 呼び出し
│       │   ├── story/              # Ollama 呼び出し・プロンプト
│       │   └── index.ts
│       ├── ollama/                 # Modelfile (語り手の設定)
│       ├── data/                   # SQLite DBファイル (git管理外)
│       └── vendor/                 # whisper.cpp 等の外部ツール (git管理外)
├── docs/
│   ├── requirements.md
│   ├── design-ui.md
│   ├── design-ai.md
│   └── design-db.md
├── native/
│   └── audio-preprocess/           # 音声前処理の自作Cライブラリ
│       ├── include/                # 公開する関数の宣言
│       ├── src/                    # 実装とテスト
│       ├── build/                  # 中間ファイル (git管理外)
│       ├── dist/                   # 共有ライブラリ (git管理外)
│       └── Makefile
├── .github/workflows/              # CI (Lint / Format / 型チェック)
└── README.md
```

## Roadmap

| フェーズ      | 内容                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| Phase 1 (MVP) | 音声/テキスト入力 → 物語生成+タグ抽出 → 文章表示+TTS再生、写真の任意添付 |
| Phase 2       | 蓄積された物語・タグデータをもとに、固定イラストの自動マッチング(挿絵化) |
| Phase 3       | スマホ単体でのオンデバイス動作(軽量モデルでの動作検証)                   |

詳細な要件・設計は [`docs/`](./docs) 以下の各ドキュメントを参照してください。

## License

TBD
