import { text } from "../line";
import type { Feature } from "./types";

export const reminder: Feature = {
  id: "reminder",
  label: "リマインド",
  emoji: "⏰",
  description: "ゴミの日・予定などのお知らせ",
  keywords: ["リマインド", "remind"],
  defaultTarget: "family",

  async onMessage(_ctx, _args) {
    // TODO: 「リマインド 明日8時 ゴミ出し」のような登録・一覧・削除
    return [text("リマインドは準備中です。")];
  },
};
