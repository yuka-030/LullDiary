# LullDiary デスクトップアプリ

Tauri 2、React、TypeScriptで構成するデスクトップアプリです。

環境構築とアプリ全体の起動方法は、[ルートのREADME](../../README.md)を参照してください。

## ディレクトリ

```text
src/
  components/
    bookshelf/    本棚と絞り込み
    recording/    録音と認識結果の確認
    shared/       共通部品
    story/        物語、写真、確認モーダル
  screens/        画面の構成
  lib/
    bookshelf/    本棚の状態管理と通信
    recording/    録音、入力検証、日本語入力
    shared/       共通の通信処理
    story/        物語生成、再生、保存、編集
  App.tsx         画面の切り替え
  index.css       配色とスタイル
src-tauri/
  capabilities/   Tauriの権限
  src/            Rustの処理
  build.rs        Cの音声前処理とのビルド連携
  tauri.conf.json アプリとCSPの設定
```

画面の構成は `screens`、状態管理と操作は `lib`、再利用する表示部品は `components` に分けています。

## 入力

声と文字の入力を切り替えられます。

録音は最大3分です。録音停止後に、録り直しまたは文字起こしを選択します。入力方法の切り替えや画面を離れる際には、録音を終了します。

テキスト入力は120字までです。空白と改行も文字数に含め、絵文字や結合文字は見た目の1文字として数えます。

120字を超えた文章は切り捨てずに表示し、送信できない状態にします。日本語変換中も送信を防ぎます。

Windowsでは、入力欄にフォーカスした際に日本語入力への切り替えを試みます。日本語入力を固定する機能ではなく、環境によって切り替わらない場合があります。

## ローカルAPI

`VITE_API_BASE_URL` で接続先を設定します。

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

接続先を変える場合は、TauriのCSPとサーバー側の許可設定も確認します。

## 開発用の起動

以下はリポジトリのルートで実行します。APIと外部プロセスを含む通常の開発では、`bun run dev` を使用します。

```powershell
bun run dev
```

デスクトップ側のみ起動する場合は、APIと外部プロセスを別途起動しておきます。

```powershell
bun run dev:desktop
```

## テスト

単体テストは次のコマンドで実行します。

```powershell
bun test --cwd apps/desktop
```

ブラウザー操作テストとTauriアプリのE2Eテストは、[テスト設計](../../docs/design-test.md)を参照してください。

ブラウザー操作テストではAPIやTauriの処理を差し替えます。実際のTauriアプリと外部プロセスをつなぐ確認は、手元のE2Eテストで行います。

## UIとアクセシビリティ

温かみのある配色を使用し、操作要素のラベル、キーボード操作、フォーカスの表示、モーダル内のフォーカス制御を実装しています。

配色や画面ごとの振る舞いは、[UI設計](../../docs/design-ui.md)を参照してください。
