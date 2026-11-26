# line-share-app

LINE公式アカウント（Messaging API）を **自分専用のAPI** として使い、家族へのお知らせを自動化するプロジェクト。

## やりたいこと

- [x] LINE側の仕組み（公式アカウント・Webhook・送信API）
- [x] 1つのアカウントで機能を分ける仕組み（[docs/features.md](docs/features.md)）
- [ ] 📰 ニュース：毎朝のニュース配信
- [ ] ⏰ リマインド：ゴミの日・予定など
- [ ] 🍳 献立：献立・レシピの提案

## 構成

Cloudflare Workers（無料枠）上で動く小さなサーバー。

| エンドポイント | 説明 |
|---|---|
| `POST /webhook` | LINEからのイベント受信。友だち追加で「me」、グループ招待で「family」を自動登録 |
| `POST /api/push` | メッセージ送信。`{"feature":"reminder","text":"..."}` または `{"to":"family","text":"..."}`（要 `Authorization: Bearer API_TOKEN`） |
| `GET /api/targets` | 登録済みの送信先と、機能ごとの届け先 |
| `GET /api/quota` | 今月の送信済み通数 |

botへのテキストコマンド（返信なので通数を消費しない）:

- `メニュー` … 機能一覧とボタンを表示
- `ニュース` / `リマインド` / `献立` … 各機能を呼び出す（送信者名が機能ごとに変わる）
- `登録` … そのトークを送信先として登録し直す（グループ→family、1:1→me）
- `登録 ニュース` / `解除 ニュース` … その機能だけ届け先をこのトークに変える／戻す
- `id` … そのトークの userId / groupId を表示

1:1トークではリッチメニュー（画面下のボタン）からも呼び出せる。

機能の分け方・追加方法 👉 **[docs/features.md](docs/features.md)**

## セットアップ

👉 **[docs/line-setup.md](docs/line-setup.md)** を上から順に。

## 開発

```bash
npm install
cp .dev.vars.example .dev.vars   # 値を入れる
npm run dev                      # http://localhost:8787
npm run typecheck
npm test                         # 振り分けのテスト
npm run deploy
```
