import { LineClient, LineEvent, LineMessage, text, verifySignature } from "./line";

export interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  /** /api/* を叩くための自分用トークン（任意の長いランダム文字列） */
  API_TOKEN: string;
  /** 送信先IDの保存先（family = 夫婦グループ, me = 自分） */
  LINE_KV: KVNamespace;
}

// 送信先エイリアス → KV のキー
const TARGET_KEY = (alias: string) => `target:${alias}`;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return new Response("ok");
    }
    if (req.method === "POST" && url.pathname === "/webhook") {
      return handleWebhook(req, env);
    }
    if (url.pathname.startsWith("/api/")) {
      if (!isAuthorized(req, env)) return json({ error: "unauthorized" }, 401);
      if (req.method === "POST" && url.pathname === "/api/push") return handlePush(req, env);
      if (req.method === "GET" && url.pathname === "/api/targets") return handleTargets(env);
      if (req.method === "GET" && url.pathname === "/api/quota") {
        return json(await new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN).consumption());
      }
    }
    return json({ error: "not found" }, 404);
  },

  // 毎朝ニュース・リマインド用（wrangler.toml の [triggers] を有効にすると動く）
  async scheduled(_ctrl: ScheduledController, _env: Env): Promise<void> {
    // 次のステップで実装予定
  },
} satisfies ExportedHandler<Env>;

// ---------- Webhook ----------

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  const body = await req.text();
  const ok = await verifySignature(
    env.LINE_CHANNEL_SECRET,
    body,
    req.headers.get("x-line-signature"),
  );
  if (!ok) return new Response("invalid signature", { status: 401 });

  const { events } = JSON.parse(body) as { events: LineEvent[] };
  const line = new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN);

  // LINE は 200 を早く返すことを求めるが、件数が少ないので逐次処理で十分
  for (const ev of events) {
    try {
      await handleEvent(ev, env, line);
    } catch (e) {
      console.error("event failed", ev.type, e);
    }
  }
  return new Response("ok");
}

async function handleEvent(ev: LineEvent, env: Env, line: LineClient) {
  const src = ev.source;
  if (!src) return;

  // 友だち追加 → 自分のIDとして登録
  if (ev.type === "follow" && src.type === "user") {
    await env.LINE_KV.put(TARGET_KEY("me"), src.userId);
    if (ev.replyToken) {
      await line.reply(ev.replyToken, [
        text(`友だち登録ありがとうございます。\nあなたを送信先「me」として登録しました。`),
      ]);
    }
    return;
  }

  // グループに招待された → 家族グループとして登録
  if (ev.type === "join" && src.type === "group") {
    await env.LINE_KV.put(TARGET_KEY("family"), src.groupId);
    if (ev.replyToken) {
      await line.reply(ev.replyToken, [
        text(`このグループを送信先「family」として登録しました。`),
      ]);
    }
    return;
  }

  if (ev.type === "leave" && src.type === "group") {
    const current = await env.LINE_KV.get(TARGET_KEY("family"));
    if (current === src.groupId) await env.LINE_KV.delete(TARGET_KEY("family"));
    return;
  }

  // テキストコマンド（返信なので通数を消費しない）
  if (ev.type === "message" && ev.message?.type === "text" && ev.replyToken) {
    const cmd = ev.message.text?.trim().toLowerCase();
    if (cmd === "id") {
      await line.reply(ev.replyToken, [text(describeSource(src))]);
    } else if (cmd === "登録" && src.type === "group") {
      await env.LINE_KV.put(TARGET_KEY("family"), src.groupId);
      await line.reply(ev.replyToken, [text("このグループを「family」として登録しました。")]);
    } else if (cmd === "登録" && src.type === "user") {
      await env.LINE_KV.put(TARGET_KEY("me"), src.userId);
      await line.reply(ev.replyToken, [text("あなたを「me」として登録しました。")]);
    }
  }
}

function describeSource(src: NonNullable<LineEvent["source"]>): string {
  switch (src.type) {
    case "user":
      return `userId: ${src.userId}`;
    case "group":
      return `groupId: ${src.groupId}${src.userId ? `\nuserId: ${src.userId}` : ""}`;
    case "room":
      return `roomId: ${src.roomId}`;
  }
}

// ---------- API ----------

function isAuthorized(req: Request, env: Env): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return !!env.API_TOKEN && auth === `Bearer ${env.API_TOKEN}`;
}

/**
 * POST /api/push
 * { "to": "family" | "me" | "<生のID>", "text": "..." }
 * または { "to": "...", "messages": [LINEメッセージオブジェクト...] }
 */
async function handlePush(req: Request, env: Env): Promise<Response> {
  let body: { to?: string; text?: string; messages?: LineMessage[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const alias = body.to ?? "family";
  const to = /^[UCR][0-9a-f]{32}$/.test(alias)
    ? alias
    : await env.LINE_KV.get(TARGET_KEY(alias));
  if (!to) return json({ error: `送信先「${alias}」が未登録です` }, 400);

  const messages = body.messages ?? (body.text ? [text(body.text)] : null);
  if (!messages?.length) return json({ error: "text か messages が必要です" }, 400);
  if (messages.length > 5) return json({ error: "messages は5件まで" }, 400);

  try {
    await new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN).push(to, messages);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
  return json({ ok: true, to: alias });
}

async function handleTargets(env: Env): Promise<Response> {
  const list = await env.LINE_KV.list({ prefix: "target:" });
  const targets: Record<string, string | null> = {};
  for (const k of list.keys) {
    targets[k.name.slice("target:".length)] = await env.LINE_KV.get(k.name);
  }
  return json(targets);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
