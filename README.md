# line-share-app

LINE公式アカウント（Messaging API）を **自分専用のAPI** として使い、家族へのお知らせを自動化するプロジェクト。

## やりたいこと

- [x] LINE側の仕組み（公式アカウント・Webhook・送信API）← いまここ
- [ ] 毎朝のニュース配信
- [ ] リマインド
- [ ] 夫婦グループでの家族間共有

## 構成

Cloudflare Workers（無料枠）上で動く小さなサーバー。

| エンドポイント | 説明 |
|---|---|
| `POST /webhook` | LINEからのイベント受信。友だち追加で「me」、グループ招待で「family」を自動登録 |
| `POST /api/push` | メッセージ送信。`{"to":"family","text":"..."}`（要 `Authorization: Bearer API_TOKEN`） |
| `GET /api/targets` | 登録済みの送信先一覧 |
| `GET /api/quota` | 今月の送信済み通数 |

botへのテキストコマンド（返信なので通数を消費しない）:

- `id` … そのトークの userId / groupId を表示
- `登録` … そのトークを送信先として登録し直す（グループ→family、1:1→me）

## セットアップ

👉 **[docs/line-setup.md](docs/line-setup.md)** を上から順に。

## 開発

```bash
npm install
cp .dev.vars.example .dev.vars   # 値を入れる
npm run dev                      # http://localhost:8787
npm run typecheck
npm run deploy
```
