# App Store Release Checklist

TRENOをApp Storeに提出する前の確認リストです。

## 1. Apple Developer / App Store Connect

- [ ] Apple Developer Programの登録が有効になっている
- [ ] App Store Connectにログインできる
- [ ] App Store Connectで新規アプリを作成する
- [ ] Bundle IDを `app.treno.toreno` で登録する
- [ ] SKUを決める（例: `toreno-ios-001`）
- [ ] カテゴリを決める（候補: ヘルスケア/フィットネス、仕事効率化）

## 2. Xcode設定

- [ ] Xcode 26.3を選択している
- [ ] `TARGETS > App > Signing & Capabilities` で有料Developer ProgramのTeamを選ぶ
- [ ] Bundle Identifierが `app.treno.toreno` になっている
- [ ] Versionが `1.0` になっている
- [ ] Buildが `1` 以上になっている
- [ ] Automatically manage signingがONになっている

## 3. ビルド手順

Web側を変更したら、必ずiOSへ同期してからArchiveする。

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Xcodeで以下を実行する。

```txt
Product > Archive
```

Archive成功後、以下を順番に確認する。

- [ ] Validate App
- [ ] Distribute App
- [ ] App Store Connectにビルドが表示される

## 4. 実機・シミュレーター確認

現状、iPhone実機がiOS 26.5.1の場合、Xcode 26.3ではDeveloper Disk ImageのDevice Supportが不足する可能性がある。
そのため、提出前チェックは以下のどちらかで行う。

- [ ] iPhone Simulatorで主要画面を確認
- [ ] iOS 26.2以下の実機で確認
- [ ] もしくはiOS 26.5.1対応Xcode環境で実機確認

## 5. アプリ内の動作確認

- [ ] 初回起動できる
- [ ] カレンダーの日付選択ができる
- [ ] トレーニング記録を保存できる
- [ ] 保存後、アプリ再起動しても記録が残る
- [ ] 部位入力ができる
- [ ] メモ入力ができる
- [ ] 画像添付ができる
- [ ] 画像削除ができる
- [ ] バックアップを作成できる
- [ ] バックアップから復元できる
- [ ] キーボード表示時にボタンが隠れすぎない
- [ ] ホームバーやノッチとUIが被らない
- [ ] ダークモードで大きく崩れない

## 6. App Store素材

- [ ] App Store用アプリアイコンを正式版にする
- [ ] iOS用スプラッシュ画像を正式版にする
- [ ] iPhoneスクリーンショットを用意する
- [ ] アプリ説明文を用意する
- [ ] キーワードを用意する
- [ ] サポートURLを用意する
- [ ] プライバシーポリシーURLを用意する

## 7. プライバシー回答

現時点の想定では、TRENOはトレーニング記録を端末内に保存するローカル管理アプリ。
ただし、App Store Connectで回答する前に、以下を必ず確認する。

- [ ] 外部サーバーへデータ送信していない
- [ ] アナリティクスを入れていない
- [ ] 広告SDKを入れていない
- [ ] クラッシュ解析SDKを入れていない
- [ ] 画像・メモ・記録が端末外に送信されない

上記がすべて正しければ、App Privacyは「Data Not Collected」寄りで回答できる可能性が高い。

## 8. 審査前の最終確認

- [ ] App Store Connectのアプリ情報をすべて入力する
- [ ] 年齢制限を回答する
- [ ] 輸出コンプライアンスを回答する
- [ ] 暗号化の利用有無を回答する
- [ ] 価格を設定する（無料ならFree）
- [ ] TestFlightに上げる
- [ ] 問題なければApp Reviewへ提出する
