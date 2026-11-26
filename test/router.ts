// 実行: npm test  （LINE API は呼ばず、返信内容を記録して確認する）
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Env } from "../src/env";
import type { LineClient, LineEvent, LineMessage } from "../src/line";
import { handleEvent } from "../src/router";

const G = "C" + "a".repeat(32);
const G2 = "C" + "b".repeat(32);
const U = "U" + "c".repeat(32);

function setup() {
  const store = new Map<string, string>();
  const kv = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
    }),
  };
  const env = { LINE_KV: kv } as unknown as Env;
  const replies: LineMessage[][] = [];
  const pushes: { to: string; messages: LineMessage[] }[] = [];
  const line = {
    reply: async (_t: string, m: LineMessage[]) => void replies.push(m),
    push: async (to: string, messages: LineMessage[]) => void pushes.push({ to, messages }),
  } as unknown as LineClient;
  const say = async (t: string, groupId = G) => {
    replies.length = 0;
    const ev: LineEvent = {
      type: "message", replyToken: "r", timestamp: 0,
      source: { type: "group", groupId, userId: U },
      message: { type: "text", text: t },
    };
    await handleEvent(ev, env, line);
    return replies[0] ?? [];
  };
  const postback = async (data: string) => {
    replies.length = 0;
    await handleEvent(
      { type: "postback", replyToken: "r", timestamp: 0, source: { type: "group", groupId: G }, postback: { data } },
      env, line,
    );
    return replies[0] ?? [];
  };
  return { store, env, line, say, postback, pushes };
}

test("グループ招待で family に登録し、メニューを返す", async () => {
  const { store, env, line } = setup();
  const replies: LineMessage[][] = [];
  (line as any).reply = async (_: string, m: LineMessage[]) => void replies.push(m);
  await handleEvent({ type: "join", replyToken: "r", timestamp: 0, source: { type: "group", groupId: G } }, env, line);
  assert.equal(store.get("target:family"), G);
  assert.ok(replies[0][1].quickReply?.items.length === 3);
});

test("キーワードで機能に振り分け、送信者名が付く", async () => {
  const { say } = setup();
  const [m] = await say("ニュース");
  assert.equal(m.sender?.name, "📰ニュース");
  const [r] = await say("献立 和食");
  assert.equal(r.sender?.name, "🍳献立");
  const [rr] = await say("レシピ");
  assert.equal(rr.sender?.name, "🍳献立");
});

test("普段の会話には反応しない", async () => {
  const { say } = setup();
  assert.deepEqual(await say("ニュース見た？"), []);
  assert.deepEqual(await say("今日の献立どうする"), []);
  assert.deepEqual(await say("おはよう"), []);
});

test("クイックリプライの postback で機能を開ける", async () => {
  const { postback } = setup();
  const [m] = await postback("f=reminder&a=open");
  assert.equal(m.sender?.name, "⏰リマインド");
  const [menu] = await postback("f=menu");
  assert.ok(menu.quickReply);
});

test("「登録 ニュース」でニュースだけ別グループへ、「解除」で戻る", async () => {
  const { store, say } = setup();
  await say("登録");
  await say("登録 ニュース", G2);
  assert.equal(store.get("target:family"), G);
  assert.equal(store.get("route:news"), G2);
  const [m] = await say("解除 ニュース", G2);
  assert.match(m.text!, /family/);
  assert.equal(store.has("route:news"), false);
});

test("featureContext.push は機能の送信先・送信者名で送る", async () => {
  const { store, env, line, pushes } = setup();
  const { featureContext } = await import("../src/router");
  const { reminder } = await import("../src/features/reminder");
  store.set("target:family", G);
  await featureContext(env, line, reminder).push([{ type: "text", text: "ゴミの日" }]);
  assert.equal(pushes[0].to, G);
  assert.equal(pushes[0].messages[0].sender?.name, "⏰リマインド");
});
