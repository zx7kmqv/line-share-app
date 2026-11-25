// リッチメニュー（1:1トークの下に出るボタン）を登録する
//
//   LINE_CHANNEL_ACCESS_TOKEN=xxxx node scripts/setup-richmenu.mjs
//
// 何度実行してもよい（同名の古いメニューは削除してから作り直す）。
// ボタンを変えたら AREAS と assets/richmenu.html を直し、
// node scripts/render-richmenu.mjs で画像を作り直してから再実行する。
//
// ※ リッチメニューは1:1トークにしか表示されない。グループでは「メニュー」と送る。
import { readFile } from "node:fs/promises";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN を設定してください");
  process.exit(1);
}
const NAME = "main";
const W = 2500, H = 843;

// 左から順に。data は src/router.ts の handlePostback が解釈する（f=機能ID）
const AREAS = [
  { data: "f=news&a=open", displayText: "ニュース" },
  { data: "f=reminder&a=open", displayText: "リマインド" },
  { data: "f=recipe&a=open", displayText: "献立" },
  { data: "f=menu", displayText: "メニュー" },
];

const auth = { Authorization: `Bearer ${TOKEN}` };
async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...auth, ...init.headers } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

// 1. 同名の古いメニューを削除
const { richmenus } = await call("https://api.line.me/v2/bot/richmenu/list");
for (const m of richmenus.filter((m) => m.name === NAME)) {
  await call(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: "DELETE" });
  console.log("deleted", m.richMenuId);
}

// 2. 作成
const w = W / AREAS.length;
const { richMenuId } = await call("https://api.line.me/v2/bot/richmenu", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    size: { width: W, height: H },
    selected: true, // 最初から開いた状態
    name: NAME,
    chatBarText: "メニュー",
    areas: AREAS.map((a, i) => ({
      bounds: { x: Math.round(i * w), y: 0, width: Math.round(w), height: H },
      action: { type: "postback", data: a.data, displayText: a.displayText },
    })),
  }),
});
console.log("created", richMenuId);

// 3. 画像アップロード
const png = await readFile(new URL("../assets/richmenu.png", import.meta.url));
await call(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: "POST",
  headers: { "Content-Type": "image/png" },
  body: png,
});

// 4. 全ユーザーのデフォルトに設定
await call(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
console.log("done: デフォルトのリッチメニューに設定しました");
