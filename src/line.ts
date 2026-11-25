// LINE Messaging API の薄いクライアント
// https://developers.line.biz/ja/reference/messaging-api/

const API_BASE = "https://api.line.me/v2/bot";

export type LineMessage =
  | { type: "text"; text: string }
  | { type: string; [key: string]: unknown };

export type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type: string; text?: string };
  timestamp: number;
}

/** x-line-signature を検証する（HMAC-SHA256 / Base64） */
export async function verifySignature(
  channelSecret: string,
  body: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class LineClient {
  constructor(private accessToken: string) {}

  /** 返信（無料・メッセージ数にカウントされない） */
  reply(replyToken: string, messages: LineMessage[]) {
    return this.post("/message/reply", { replyToken, messages });
  }

  /** プッシュ（無料枠の通数を消費する。グループ宛はメンバー人数分） */
  push(to: string, messages: LineMessage[]) {
    return this.post("/message/push", { to, messages });
  }

  /** 今月の送信済み通数 */
  async consumption(): Promise<{ totalUsage: number }> {
    const res = await fetch(`${API_BASE}/message/quota/consumption`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`LINE API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  private async post(path: string, payload: unknown) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`LINE API ${res.status}: ${await res.text()}`);
  }
}

export const text = (t: string): LineMessage => ({ type: "text", text: t });
