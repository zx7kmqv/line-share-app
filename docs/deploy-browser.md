# ブラウザだけでデプロイする（iPad / スマホ向け）

ターミナルを使わずに、Cloudflare の管理画面と GitHub の連携だけで Workers を公開する手順。
一度つなげば、GitHub にコードを push するたびに自動でデプロイされる。

> Cloudflare の画面は日本語/英語や時期によって表記が少し変わる。括弧内に英語表記を併記している。

---

## 1. GitHub リポジトリから Worker を作る

1. <https://dash.cloudflare.com/> にログイン
2. 左メニュー **Workers & Pages**（「コンピューティング（Workers）」の中にある場合もある）
3. **作成**（Create）→ **リポジトリをインポート**（Import a repository）
4. **GitHub に接続**（Connect GitHub）→ GitHub 側で Cloudflare のアクセスを許可
   - 対象リポジトリは `line-share-app` だけ選べば十分
5. リポジトリ一覧から **line-share-app** を選ぶ
6. 設定画面で次のとおり入力

   | 項目 | 値 |
   |---|---|
   | プロジェクト名（Project name） | `line-share-app`（**必ずこの名前**。wrangler.toml の name と一致させる） |
   | ビルドコマンド（Build command） | 空欄 |
   | デプロイコマンド（Deploy command） | `npx wrangler deploy` |
   | ルートディレクトリ（Root directory） | `/`（空欄） |

7. **デプロイ**（Deploy）を押す → 1〜2分でビルドが終わる

### ブランチについて

本番の URL にデプロイされるのは `main`（Production branch）のコードだけ。
ほかのブランチに push すると、プレビュー版が作られるだけになる。

### 古いアプリ（HTMLだけ）がデプロイされてしまったとき

`main` に新しいコードが入る前にインポートすると、古い静的サイトがデプロイされる。このとき次のような症状が出る。

- URL を開くと `ok` ではなく古いページが表示される
- 設定画面に「Variables cannot be added to a Worker that only has static assets」と表示され、シークレットを登録できない

**直し方：** 新しいコードが入った `main` で、もう一度ビルドを走らせる。ビルドは `main` に push されたときだけ自動で動くので、
`main` に何かコミットを入れれば、本番用のビルドとデプロイが実行される。
Deployments タブで、一番上の行に緑の点と「Ready」が表示され、Active deployment が新しくなれば完了。

> 青い棒の付いた行は `main` 以外のブランチから作られた **プレビュー版** で、本番の URL には反映されない。

ビルドが成功すると、Worker の概要画面に `https://line-share-app.<あなたのサブドメイン>.workers.dev` の URL が表示される。
Safari で開いて **`ok`** と表示されれば公開できている。

> KV（送信先の保存場所）は初回デプロイ時に自動で作られる。自分で作る必要はない。

## 2. シークレットを登録する

Worker の **設定**（Settings）→ **変数とシークレット**（Variables and Secrets）→ **追加**（Add）

3つとも **タイプ（Type）は「シークレット」（Secret）** にする（「テキスト」だと画面に値が見えてしまう）。

| 変数名 | 値 |
|---|---|
| `LINE_CHANNEL_SECRET` | Official Account Manager → 設定 → Messaging API の **Channel secret** |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging API設定 → **チャネルアクセストークン（長期）** |
| `API_TOKEN` | 自分で決める合言葉。英数字32文字以上のランダムな文字列（iPhone/iPad の「パスワード」アプリの自動生成を使うと楽） |

**デプロイ**（Deploy）を押して保存。シークレットは今後の自動デプロイでも消えない。

> どの値もチャットやメモアプリの共有ノートには貼らないこと。

## 3. LINE に Webhook URL を登録する

1. Official Account Manager → **設定** → **Messaging API**
2. **Webhook URL** に次を入力 → **保存**

   ```
   https://line-share-app.<あなたのサブドメイン>.workers.dev/webhook
   ```

   末尾の `/webhook` を忘れずに。

3. [LINE Developers コンソール](https://developers.line.biz/console/) → チャネル → **Messaging API設定** タブ
   - **Webhookの利用** を **オン**
   - **検証** を押して「成功」と出ればOK

> 検証が失敗する場合：URL末尾の `/webhook`、`LINE_CHANNEL_SECRET` の値、手順2で「デプロイ」を押したか、を確認。

## 4. 友だち追加とグループ作成

ここからは [line-setup.md の手順8〜9](line-setup.md#8-友だち追加--自分をmeとして登録) と同じ。

1. Messaging API設定タブの **QRコード** を読み取って友だち追加 → botから「me として登録しました」と返事が来る
2. 自分・妻・bot のグループを作る → 「family として登録しました」と返事が来る
3. グループで `メニュー` と送る → ボタンが出れば完了

## 5. 送信テスト（iPad のショートカットで）

ターミナルの代わりに「ショートカット」アプリで API を呼べる。

1. ショートカット → 新規 → アクション **「URLの内容を取得」**
2. URL：`https://line-share-app.<サブドメイン>.workers.dev/api/push`
3. 「表示を増やす」から
   - 方法：**POST**
   - ヘッダ：キー `Authorization`、値 `Bearer <API_TOKEN の値>`
   - 本文を要求：**JSON**
     - `feature`（テキスト）：`reminder`
     - `text`（テキスト）：`テスト送信です`
4. 実行 → 夫婦グループに「⏰リマインド テスト送信です」が届けば成功

このショートカットはそのまま「手動リマインド」としても使える。

## 6. リッチメニュー

1:1トークの下に出るボタンの登録はスクリプトが必要なので、Claude に「リッチメニューを登録して」と頼む。
トークンは安全な入力フォームから渡す（チャットには貼らない）。
