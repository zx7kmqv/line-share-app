// LINEから届いたイベントを、共通コマンド or 各機能に振り分ける
import type { Env } from "./env";
import { features, findFeature, senderOf } from "./features";
import type { ChatContext, Feature, FeatureContext } from "./features/types";
import {
  LineClient,
  LineEvent,
  LineMessage,
  LineSource,
  QuickReplyItem,
  sourceId,
  text,
} from "./line";
import { resolveFeatureTarget, routeKey, targetKey } from "./targets";

/** 機能のメッセージに送信者名を付ける（既に付いていればそのまま） */
export function withSender(f: Feature, messages: LineMessage[]): LineMessage[] {
  return messages.map((m) => (m.sender ? m : { ...m, sender: senderOf(f) }));
}

export function featureContext(env: Env, line: LineClient, f: Feature): FeatureContext {
  return {
    env,
    line,
    async push(messages) {
      const to = await resolveFeatureTarget(env, f.id, f.defaultTarget);
      if (!to) throw new Error(`${f.id}: 送信先「${f.defaultTarget}」が未登録`);
      await line.push(to, withSender(f, messages));
    },
  };
}

// ---------- メニュー ----------

const MENU_WORDS = ["メニュー", "menu", "help", "ヘルプ", "?", "？"];

function menuQuickReply(): { items: QuickReplyItem[] } {
  return {
    items: features.map((f) => ({
      type: "action" as const,
      action: {
        type: "postback" as const,
        label: `${f.emoji}${f.label}`.slice(0, 20),
        data: `f=${f.id}&a=open`,
        displayText: f.label,
      },
    })),
  };
}

function menuMessage(): LineMessage {
  const lines = features.map((f) => `${f.emoji} ${f.label} … ${f.description}\n　「${f.keywords[0]}」`);
  return {
    ...text(
      [
        "使える機能",
        "",
        ...lines,
        "",
        "その他",
        "　「id」このトークのIDを表示",
        "　「登録」このトークを送信先に登録",
        "　「登録 ニュース」ニュースだけこのトークに届ける",
      ].join("\n"),
    ),
    quickReply: menuQuickReply(),
  };
}

// ---------- イベント処理 ----------

export async function handleEvent(ev: LineEvent, env: Env, line: LineClient): Promise<void> {
  const src = ev.source;
  if (!src) return;
  const reply = (messages: LineMessage[]) =>
    ev.replyToken && messages.length ? line.reply(ev.replyToken, messages) : Promise.resolve();

  switch (ev.type) {
    case "follow": // 友だち追加 → 自分のIDとして登録
      if (src.type === "user") {
        await env.LINE_KV.put(targetKey("me"), src.userId);
        await reply([text("友だち登録ありがとうございます。\nあなたを送信先「me」として登録しました。"), menuMessage()]);
      }
      return;

    case "join": // グループに招待された → 家族グループとして登録
      if (src.type === "group") {
        await env.LINE_KV.put(targetKey("family"), src.groupId);
        await reply([text("このグループを送信先「family」として登録しました。"), menuMessage()]);
      }
      return;

    case "leave":
      if (src.type === "group") await forgetGroup(env, src.groupId);
      return;

    case "postback":
      if (ev.postback) await reply(await handlePostback(env, line, src, ev.postback.data));
      return;

    case "message":
      if (ev.message?.type === "text" && ev.message.text) {
        await reply(await handleText(env, line, src, ev.message.text));
      }
      return;
  }
}

async function handleText(
  env: Env,
  line: LineClient,
  src: LineSource,
  raw: string,
): Promise<LineMessage[]> {
  const input = raw.trim();
  const [head, ...rest] = input.split(/\s+/);
  const word = head.toLowerCase();
  const args = rest.join(" ");

  // 共通コマンド
  if (MENU_WORDS.includes(word) && !args) return [menuMessage()];
  if (word === "id" && !args) return [text(describeSource(src))];
  if (word === "登録") return register(env, src, args);
  if (word === "解除" && args) return unregister(env, src, args);

  // 機能へ振り分け（先頭の単語がキーワードに完全一致したときだけ。
  // グループでは普段の会話も全部届くので、「ニュース見た？」には反応しない）
  const f = features.find((f) => f.keywords.some((k) => k.toLowerCase() === word));
  if (!f?.onMessage) return [];
  const out = await f.onMessage(chatContext(env, line, f, src), args);
  return out ? withSender(f, out) : [];
}

async function handlePostback(
  env: Env,
  line: LineClient,
  src: LineSource,
  data: string,
): Promise<LineMessage[]> {
  const params = new URLSearchParams(data);
  const id = params.get("f");
  if (id === "menu") return [menuMessage()];
  const f = id ? findFeature(id) : undefined;
  if (!f) return [];

  const ctx = chatContext(env, line, f, src);
  let out: LineMessage[] | void = undefined;
  if (f.onPostback) out = await f.onPostback(ctx, params);
  else if (params.get("a") === "open" && f.onMessage) out = await f.onMessage(ctx, "");
  return out ? withSender(f, out) : [];
}

function chatContext(env: Env, line: LineClient, f: Feature, source: LineSource): ChatContext {
  return { ...featureContext(env, line, f), source };
}

// ---------- 登録 ----------

async function register(env: Env, src: LineSource, args: string): Promise<LineMessage[]> {
  const id = sourceId(src);

  if (!args) {
    if (src.type === "group") {
      await env.LINE_KV.put(targetKey("family"), id);
      return [text("このグループを「family」として登録しました。")];
    }
    if (src.type === "user") {
      await env.LINE_KV.put(targetKey("me"), id);
      return [text("あなたを「me」として登録しました。")];
    }
    return [text("このトークは登録できません。")];
  }

  const f = findFeature(args);
  if (!f) return [text(`「${args}」という機能はありません。「メニュー」で一覧を表示します。`)];
  await env.LINE_KV.put(routeKey(f.id), id);
  return withSender(f, [text(`${f.label}の送信先をこのトークにしました。\n元に戻すには「解除 ${f.label}」`)]);
}

async function unregister(env: Env, src: LineSource, args: string): Promise<LineMessage[]> {
  const f = findFeature(args);
  if (!f) return [text(`「${args}」という機能はありません。`)];
  const current = await env.LINE_KV.get(routeKey(f.id));
  if (current !== sourceId(src)) return [text(`${f.label}はこのトークに届く設定になっていません。`)];
  await env.LINE_KV.delete(routeKey(f.id));
  return [text(`${f.label}の送信先を「${f.defaultTarget}」に戻しました。`)];
}

/** bot がグループから外れたら、そのグループ宛の設定を消す */
async function forgetGroup(env: Env, groupId: string) {
  const keys = [targetKey("family"), ...features.map((f) => routeKey(f.id))];
  for (const k of keys) {
    if ((await env.LINE_KV.get(k)) === groupId) await env.LINE_KV.delete(k);
  }
}

function describeSource(src: LineSource): string {
  switch (src.type) {
    case "user":
      return `userId: ${src.userId}`;
    case "group":
      return `groupId: ${src.groupId}${src.userId ? `\nuserId: ${src.userId}` : ""}`;
    case "room":
      return `roomId: ${src.roomId}`;
  }
}
