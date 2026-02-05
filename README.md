# TRENO (toreno-app)

TRENO は、日付ごとにトレーニング記録を残すための React + Vite アプリです。

- カレンダーから日付選択
- 部位・メモ（リッチテキスト）・画像を保存
- 記録はブラウザの `localStorage` に保存

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

## データ保存仕様

以下のキーで `localStorage` に保存します。

- `treno_records_v1`: 日付ごとの記録本体
- `treno_editBuffers_v1`: 入力途中データ（編集バッファ）

互換のため、旧キー（`records`, `editBuffers`）の読み込みも実装されています。

## 画像添付の注意

- 1記録あたり最大 `3` 枚
- 画像は保存前にリサイズ（最大幅 400px）
- 添付データが一定サイズを超える場合は追加不可（`MAX_IMAGE_DATA_LENGTH`）
- 保存形式は base64（Data URL）
