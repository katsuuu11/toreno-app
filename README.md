# TRENO (toreno-app)

TRENO は、日付ごとにトレーニング記録を残すための React + Vite アプリです。

- カレンダーから日付選択
- 部位・メモ（リッチテキスト）・画像を保存
- 記録はブラウザのローカルDB（IndexedDB）に保存（初回起動時に `localStorage` から移行）
- PWA対応により、スマホのホーム画面からアプリのように起動可能

## スマホで使う

### iPhone

1. Safariで公開URLを開く。
2. 共有ボタンから「ホーム画面に追加」を選択する。
3. ホーム画面に追加された「TRENO」アイコンから起動する。

### Android

1. Chromeで公開URLを開く。
2. 「アプリをインストール」または「ホーム画面に追加」を選択する。
3. ホーム画面に追加された「TRENO」アイコンから起動する。

## PWA対応

- `manifest.webmanifest` でアプリ名・テーマカラー・ホーム画面用PNGアイコンを定義
- iPhone向けの `apple-touch-icon` とホーム画面起動用メタタグを設定
- Service Workerでアプリ本体をキャッシュし、再訪問時や一部オフライン時にも起動しやすくする
- iOSネイティブ実行時（Capacitor）は、PWA向けのService Worker登録をスキップする

> 記録データは端末のブラウザ内（IndexedDB）に保存されます。機種変更・ブラウザデータ削除・ブラウザ変更時にはデータが引き継がれない場合があります。

## リポジトリ構成

PWA版とiOS版は同じGitHubリポジトリ内で管理し、React本体は `src/` を共通実装として使います。

- `src/`: PWA版・iOS版で共通のReactアプリ本体
- `public/`: PWA用の `manifest.webmanifest`、`sw.js`、ホーム画面用アイコン
- `ios/`: Capacitorで追加するiOS/Xcodeプロジェクト
- `capacitor.config.js`: Capacitor用のアプリID・アプリ名・Webビルド出力先

PWA用アイコンは `public/icons/` で管理し、App Store提出用のiOSアイコンやスプラッシュ画像は `ios/App/App/Assets.xcassets` 側で別管理します。

## セットアップ

```bash
npm install
```

## 開発サーバー起動

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## iOS版の開発準備

このリポジトリには、Capacitor導入前の設定雛形として `capacitor.config.js` を用意しています。

Capacitorパッケージを取得できる環境で、以下を実行してください。

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

以降、Web/PWA側を変更した後にiOSへ反映する場合は、以下を実行します。

```bash
npm run build
npx cap sync ios
```

`ios/App/Pods/` や `ios/App/build/` などの生成物はGit管理しません。必要なXcodeプロジェクトファイルのみをコミットしてください。

## 手動テスト（サジェスト辞書）

1. 既存の記録ノートに「ベンチプレス」など短い行を含めて保存する。
2. 新規入力でノートに「ベン」と入力し、候補が表示されることを確認する。
3. 候補をタップして挿入 → 保存 → 再度同じ候補を適用しても `count` が二重に増えないことを確認する。
4. 画像貼り付けや `data:image/` を含む長文を保存しても、候補辞書に混入しないことを確認する。
5. 大量の候補を保存しても辞書が上限（1000件）を超えないことを確認する。

## データ保存仕様

以下のキーでデータを保持します（IndexedDB 内のアプリ状態）。

- `treno_records_v1`: 日付ごとの記録本体
- `treno_editBuffers_v1`: 入力途中データ（編集バッファ）

互換のため、旧キー（`records`, `editBuffers`）の読み込みも実装されています。

## 画像添付の注意

- 1記録あたり最大 `3` 枚
- 画像は保存前にリサイズ（最大幅 400px）
- 添付データが一定サイズを超える場合は追加不可（`MAX_IMAGE_DATA_LENGTH`）
- 保存形式は base64（Data URL）
