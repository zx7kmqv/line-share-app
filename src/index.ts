import type { Env } from "./env";
import { features, findFeature } from "./features";
import { LineClient, LineEvent, LineMessage, text, verifySignature } from "./line";
import { featureContext, handleEvent, withSender } from "./router";
import { listByPrefix, resolveFeatureTarget, resolveTarget } from "./targets";

export type { Env };

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

  // 各機能の schedules から、発火した cron に一致するものを実行する
  async scheduled(ctrl: ScheduledController, env: Env): Promise<void> {
    const line = new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
    for (const f of features) {
      for (const s of f.schedules ?? []) {
        if (s.cron !== ctrl.cron) continue;
        try {
          await s.run(featureContext(env, line, f));
        } catch (e) {
          console.error(`schedule failed: ${f.id} ${s.cron}`, e);
        }
      }
    }
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
  for (const ev of events) {
    try {
      await handleEvent(ev, env, line);
    } catch (e) {
      console.error("event failed", ev.type, e);
    }
  }
  return new Response("ok");
}

// ---------- API ----------

function isAuthorized(req: Request, env: Env): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return !!env.API_TOKEN && auth === `Bearer ${env.API_TOKEN}`;
}

/**
 * POST /api/push
 *   { "feature": "reminder", "text": "..." }      … 機能の送信者名・送信先で送る
 *   { "to": "family" | "me" | "<ID>", "text": "..." }
 *   text の代わりに messages: [LINEメッセージオブジェクト...]（5件まで）も可
 */
async function handlePush(req: Request, env: Env): Promise<Response> {
  let body: { to?: string; feature?: string; text?: string; messages?: LineMessage[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const f = body.feature ? findFeature(body.feature) : undefined;
  if (body.feature && !f) return json({ error: `機能「${body.feature}」はありません` }, 400);

  let to: string | null;
  if (body.to) to = await resolveTarget(env, body.to);
  else if (f) to = await resolveFeatureTarget(env, f.id, f.defaultTarget);
  else to = await resolveTarget(env, "family");
  if (!to) return json({ error: `送信先「${body.to ?? f?.defaultTarget ?? "family"}」が未登録です` }, 400);

  let messages = body.messages ?? (body.text ? [text(body.text)] : null);
  if (!messages?.length) return json({ error: "text か messages が必要です" }, 400);
  if (messages.length > 5) return json({ error: "messages は5件まで" }, 400);
  if (f) messages = withSender(f, messages);

  try {
    await new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN).push(to, messages);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
  return json({ ok: true });
}

async function handleTargets(env: Env): Promise<Response> {
  return json({
    targets: await listByPrefix(env, "target:"),
    routes: await listByPrefix(env, "route:"),
    features: features.map((f) => ({ id: f.id, label: f.label, defaultTarget: f.defaultTarget })),
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
