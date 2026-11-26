# 機能の分け方

1つの公式アカウント（bot）で、ニュース・リマインド・献立などの機能を分けて使うための仕組み。

## トーク上での見え方

どの機能のメッセージも、**送信者名と吹き出しのアイコン表記が機能ごとに変わる**（Messaging API の `sender`）。

```
📰ニュース   おはようございます。今日のニュースです…
⏰リマインド  今日は燃えるゴミの日です
🍳献立       今夜は鶏の照り焼きはどうですか？
```

同じトークに届いても、どの機能からのメッセージかひと目で分かる。

## 呼び出し方

| 場所 | 方法 |
|---|---|
| 1:1トーク | 画面下の **リッチメニュー**（📰 ⏰ 🍳 ☰）をタップ |
| グループ | `メニュー` と送る → **クイックリプライ**のボタンが出る。リッチメニューはグループには表示されない |
| どこでも | 機能名を送る：`ニュース` / `リマインド` / `献立`（`レシピ` でも可） |

テキストは **先頭の単語が完全一致したときだけ** 反応する。グループには普段の会話もすべて届くので、
「ニュース見た？」「今日の献立どうする」のようなメッセージには反応しない。
機能名の後ろに空白を入れて続けた言葉は引数になる（例：`献立 和食` → 献立機能に「和食」が渡る）。

## 届け先を機能ごとに変える

初期状態では、どの機能も夫婦グループ（`family`）に届く。

機能ごとに別のトークへ届けたい場合は、届けたいトークで次のように送る。

```
登録 ニュース        … ニュースはこのトークに届く（例：自分との1:1や、ニュース専用グループ）
解除 ニュース        … family に戻す
```

例：ニュースは自分だけ、リマインドと献立は夫婦グループ、という使い分けができる。
現在の設定は `GET /api/targets` で確認できる。

> 通数メモ：グループ宛は人数分カウントされる。自分だけが読むものは 1:1 に回すと無料枠（月200通）の節約になる。

## 外部から機能として送る

```bash
curl -X POST $LINE_API_URL/api/push \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"feature":"reminder","text":"今日は燃えるゴミの日です"}'
```

`feature` を指定すると、その機能の送信者名と届け先が使われる。`to` を一緒に指定すると届け先だけ上書きされる。

## 新しい機能を追加する

1. `src/features/<名前>.ts` を作る（`src/features/recipe.ts` をコピーすると早い）

   ```ts
   export const weather: Feature = {
     id: "weather",
     label: "天気",
     emoji: "☀️",
     description: "今日の天気",
     keywords: ["天気"],
     defaultTarget: "family",
     async onMessage(ctx, args) {
       return [text("晴れです")];             // reply（無料）で返る
     },
     schedules: [{
       cron: "30 21 * * *",                    // UTC（日本時間 6:30）
       async run(ctx) { await ctx.push([text("今日は晴れ")]); },  // push（通数を消費）
     }],
   };
   ```

2. `src/features/index.ts` の `features` に追加する
3. 定時実行を使う場合は `wrangler.toml` の `crons` に同じ cron を追加する（無料プランはアカウント全体で5個まで）
4. リッチメニューにも出す場合は `assets/richmenu.html` と `scripts/setup-richmenu.mjs` の `AREAS` を直して、画像の作り直しと再登録をする

```bash
node scripts/render-richmenu.mjs
LINE_CHANNEL_ACCESS_TOKEN=xxxx node scripts/setup-richmenu.mjs
```

グループで使うクイックリプライ・メニュー・`登録 <機能名>` は、`features` に追加するだけで自動的に対応する。

## ファイル構成

```
src/
  index.ts          … HTTP（/webhook, /api/*）と定時実行の入口
  router.ts         … イベントを共通コマンド or 各機能に振り分け、送信者名を付ける
  targets.ts        … 送信先（family / me / 機能ごとの上書き）の管理
  line.ts           … LINE API クライアント
  features/
    types.ts        … Feature の型
    index.ts        … 機能の一覧
    news.ts / reminder.ts / recipe.ts
test/router.ts      … 振り分けのテスト（npm test）
assets/richmenu.*   … リッチメニュー画像
scripts/            … リッチメニュー登録、送信テスト
```
