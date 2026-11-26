// 送信先の管理
//
//   target:<alias>   … エイリアス → LINEのID   例) target:family = C1234...
//   route:<feature>  … 機能ごとの送信先の上書き  例) route:news = C5678...（ニュース専用グループ）
//
// 機能の送信先は route:<feature> → feature.defaultTarget の順で決まる。

import type { Env } from "./env";

const RAW_ID = /^[UCR][0-9a-f]{32}$/;

export const targetKey = (alias: string) => `target:${alias}`;
export const routeKey = (featureId: string) => `route:${featureId}`;

/** "family" / "me" / 生のID を LINE の ID に解決する */
export async function resolveTarget(env: Env, aliasOrId: string): Promise<string | null> {
  if (RAW_ID.test(aliasOrId)) return aliasOrId;
  return env.LINE_KV.get(targetKey(aliasOrId));
}

/** 機能の送信先を解決する */
export async function resolveFeatureTarget(
  env: Env,
  featureId: string,
  defaultTarget: string,
): Promise<string | null> {
  const routed = await env.LINE_KV.get(routeKey(featureId));
  return routed ?? resolveTarget(env, defaultTarget);
}

export async function listByPrefix(env: Env, prefix: string): Promise<Record<string, string | null>> {
  const list = await env.LINE_KV.list({ prefix });
  const out: Record<string, string | null> = {};
  for (const k of list.keys) out[k.name.slice(prefix.length)] = await env.LINE_KV.get(k.name);
  return out;
}
