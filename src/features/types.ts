import type { Env } from "../env";
import type { LineClient, LineMessage, LineSource, Sender } from "../line";

/** 機能に渡される実行コンテキスト */
export interface FeatureContext {
  env: Env;
  line: LineClient;
  /** この機能の送信先（route:<id> → defaultTarget）へ、この機能の送信者名で push する */
  push(messages: LineMessage[]): Promise<void>;
}

/** トークから呼ばれたときのコンテキスト */
export interface ChatContext extends FeatureContext {
  source: LineSource;
}

/** 定時実行 */
export interface Schedule {
  /** wrangler.toml の [triggers] crons に同じ文字列を書くこと（UTC） */
  cron: string;
  run(ctx: FeatureContext): Promise<void>;
}

/**
 * 1つの機能（ニュース・リマインド・献立 …）
 *
 * - 送信するメッセージには自動で sender（表示名）が付き、トーク上で機能を見分けられる
 * - keywords の先頭一致でテキストがこの機能に振り分けられる（「ニュース 経済」→ args="経済"）
 * - postback の data は "f=<id>&a=<action>&..." 形式で、この機能の onPostback に届く
 */
export interface Feature {
  id: string;
  /** メニューに出す名前 */
  label: string;
  emoji: string;
  /** 1行説明（メニュー・ヘルプに表示） */
  description: string;
  /** この機能を呼び出す言葉。メッセージの先頭が完全一致したときだけ反応する */
  keywords: string[];
  /** 送信先エイリアス（"family" / "me"）。トークで「登録 <機能名>」すると上書きできる */
  defaultTarget: string;
  /** 省略時は `${emoji}${label}` */
  sender?: Sender;

  /** テキストで呼ばれたとき。返したメッセージは reply（無料）で送られる */
  onMessage?(ctx: ChatContext, args: string): Promise<LineMessage[] | void>;
  /** メニュー/クイックリプライのボタンから呼ばれたとき */
  onPostback?(ctx: ChatContext, params: URLSearchParams): Promise<LineMessage[] | void>;
  schedules?: Schedule[];
}
