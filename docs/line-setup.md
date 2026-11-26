# LINE 側のセットアップ手順

LINE公式アカウント（Messaging API）を「自分専用のAPI」として使うための初期設定。
所要時間は30分ほど。

> **補足:** LINE Notify は 2025年3月にサービスを終了しました。今は Messaging API を使うのが唯一の方法です。

---

## 全体像

```
 [cron / ショートカット / スクリプト]
             │  POST /api/push  (Bearer API_TOKEN)
             ▼
   Cloudflare Workers (このリポジトリ)
             │  Messaging API (チャネルアクセストークン)
             ▼
       LINE公式アカウント（bot）
         │                 │
     自分との1:1トーク    夫婦グループ（自分・妻・bot）
        ("me")             ("family")
```

- **送信（push）**：Workers → LINE。ニュース、リマインドなど。
- **受信（webhook）**：LINE → Workers。友だち追加・グループ招待・メッセージを受け取り、送信先IDを自動で保存する。

---

## 1. LINE公式アカウントを作る

1. <https://www.linebiz.com/jp/entry/> から「LINE公式アカウントをはじめる」→ **未認証アカウント**（無料）を作成
   - 個人のLINEアカウントでログインしてOK
   - 業種は「個人」系の適当なものを選択
2. [LINE Official Account Manager](https://manager.line.biz/) にログインできることを確認

> 現在は LINE Developers コンソールから直接 Messaging API チャネルを作ることはできず、先に公式アカウントを作る必要があります。

## 2. Messaging API を有効化する

> **PCのブラウザで行うこと。** スマホの「LINE公式アカウント」アプリには、この設定がない（WEB版管理画面からのみ設定できる）。
> スマホしかない場合は、ブラウザで <https://manager.line.biz/> を開き、「PC版サイトを表示」に切り替える。

1. <https://manager.line.biz/> にログイン → アカウント一覧から作ったアカウントを選ぶ
2. 画面右上の **設定**（歯車アイコン）→ 左メニューの **Messaging API**
3. **Messaging APIを利用する** をクリック
4. 初めての場合は開発者情報（名前・メールアドレス）を登録
5. プロバイダーを **新規作成**（名前は何でもよい。例: `family-bot`）→ **同意する** → **OK**
6. 有効化すると [LINE Developers コンソール](https://developers.line.biz/console/) にチャネルができる（同じLINEアカウントでログインする）

> プロバイダーは後から変更できない。迷ったら新規作成でよい。

**「Messaging API」が見つからないとき**

| 確認すること | 対処 |
|---|---|
| スマホアプリで見ている | PCブラウザで開く（上の注意を参照） |
| アカウントのホーム画面にいない | アカウント一覧ではなく、アカウントを選んだ後の画面右上に「設定」がある |
| 自分の権限が「管理者」でない | 設定 → 権限管理 で確認する。管理者だけが操作できる |
| 左メニューに「応答設定」などしかない | 「設定」（アカウント設定）ではなく、別の設定画面にいる。右上の歯車から開き直す |

## 3. 応答設定を変える（重要）

Official Account Manager → **設定** → **応答設定**

| 項目 | 設定 |
|---|---|
| チャット | **オフ** |
| あいさつメッセージ | オフ（botが代わりに返す） |
| Webhook | **オン** |
| 応答メッセージ | **オフ** |

これをやらないと、自動応答の定型文が返ってきてしまう。

## 4. グループ参加を許可する

Official Account Manager → **設定** → **アカウント設定** → 機能の利用 →
**グループ・複数人トークへの参加を許可する** を **オン**

（デフォルトはオフ。オフのままだとグループに招待できない）

## 5. キーを2つ控える

[LINE Developers コンソール](https://developers.line.biz/console/) → 作成したプロバイダー → チャネルを開く

| 値 | 場所 | 使い道 |
|---|---|---|
| **チャネルシークレット** | 「チャネル基本設定」タブ | Webhook の署名検証 |
| **チャネルアクセストークン（長期）** | 「Messaging API設定」タブ最下部 → 発行 | メッセージ送信 |

> どちらも他人に見せない・Gitにコミットしない。

## 6. Workers をデプロイする

Cloudflare アカウント（無料）を作成しておく。

> **iPad / スマホだけで進める場合は [deploy-browser.md](deploy-browser.md) を使う**（手順6〜8とリッチメニュー以外をブラウザで完結できる）。
> 以下はPCのターミナルを使う場合。

```bash
npm install
npx wrangler login

# シークレットを登録（それぞれ値を聞かれる）
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put API_TOKEN      # 自分で決める長いランダム文字列（例: openssl rand -hex 32）

npx wrangler deploy
```

デプロイすると `https://line-share-app.<あなたのサブドメイン>.workers.dev` のようなURLが表示される。

## 7. Webhook URL を登録する

LINE Developers コンソール → チャネル → **Messaging API設定** タブ

1. **Webhook URL** に `https://line-share-app.<サブドメイン>.workers.dev/webhook` を入力 → 更新
2. **検証** を押して「成功」と出ればOK
3. **Webhookの利用** を **オン**

## 8. 友だち追加 → 自分を「me」として登録

同じタブにある **QRコード** を自分のスマホで読み取り、友だち追加する。

→ botから「あなたを送信先「me」として登録しました」と返ってくれば成功。

## 9. 夫婦グループを作る → 「family」として登録

1. LINEで **自分・妻・bot** の3人グループを作る（または既存グループにbotを招待）
2. botが参加すると「このグループを送信先「family」として登録しました」と返信される

> 返ってこない場合は、グループ内で `登録` と送ると登録し直せる。
> `id` と送ると、そのトークの groupId / userId を確認できる。

## 10. 送信テスト

```bash
export LINE_API_URL=https://line-share-app.<サブドメイン>.workers.dev
export API_TOKEN=<手順6で決めた値>

# 登録済みの送信先を確認
curl -H "Authorization: Bearer $API_TOKEN" $LINE_API_URL/api/targets

# 自分に送る
curl -X POST $LINE_API_URL/api/push \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"me","text":"テスト送信です"}'

# 夫婦グループに送る
curl -X POST $LINE_API_URL/api/push \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"family","text":"今日は燃えるゴミの日です"}'
```

`scripts/push.sh` を使うと短く書ける：`./scripts/push.sh family "今日は燃えるゴミの日"`

## 11. リッチメニューを登録する

1:1トークの下に 📰ニュース / ⏰リマインド / 🍳献立 / ☰メニュー のボタンを出す。

```bash
LINE_CHANNEL_ACCESS_TOKEN=<手順5のトークン> node scripts/setup-richmenu.mjs
```

botとの1:1トークを開き直すと表示される（反映に少し時間がかかることがある）。
グループにはリッチメニューが出ないので、グループでは `メニュー` と送る。

機能の分け方・使い方は [features.md](features.md) を参照。

---

## 料金と通数の目安（無料プラン）

- 無料の「コミュニケーションプラン」は **月200通** まで（超過不可。上限に達すると送れなくなる）
- **返信（reply）は無料**、通数にカウントされない
- **push は受信者の人数分** カウントされる。夫婦グループ（人間2人）宛は **1回 = 2通**

| 用途 | 頻度 | 月の通数 |
|---|---|---|
| 毎朝ニュース → family | 1日1回 | 約60通 |
| リマインド → family | 1日1回程度 | 約60通 |
| 自分だけへの通知 → me | 1日1回程度 | 約30通 |
| **合計** | | **約150通** |

1回のpushに最大5つの吹き出しをまとめられる（それでも1通扱い）。ニュースは1回にまとめて送るのが節約のコツ。
今月の使用量は `GET /api/quota` で確認できる。

※ 料金体系は変わることがあるので、[LINE公式アカウントの料金プラン](https://www.lycbiz.com/jp/service/line-official-account/plan/) で最新を確認すること。

---

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| Webhook「検証」が失敗する | URL末尾の `/webhook` 忘れ、またはチャネルシークレットの登録ミス。`npx wrangler tail` でログを見る |
| 定型文が返ってくる | 手順3の「応答メッセージ」がオンのまま |
| グループに招待できない | 手順4の「グループ・複数人トークへの参加を許可する」がオフ |
| `送信先「family」が未登録です` | グループ内で `登録` と送る |
| `LINE API 401` | チャネルアクセストークンが間違っている / 再発行して古くなった |
| `LINE API 429` | 月の上限（200通）に到達 |
