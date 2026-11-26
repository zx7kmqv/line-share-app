import { text } from "../line";
import type { Feature } from "./types";

export const news: Feature = {
  id: "news",
  label: "ニュース",
  emoji: "📰",
  description: "毎朝のニュースまとめ",
  keywords: ["ニュース", "news"],
  defaultTarget: "family",

  async onMessage(_ctx, _args) {
    // TODO: ニュースの取得元（RSS など）を決めて実装
    return [text("ニュース配信は準備中です。\n毎朝7時にまとめて届く予定です。")];
  },

  // 毎朝の配信。wrangler.toml の crons に "0 22 * * *" を追加すると動く
  schedules: [
    {
      cron: "0 22 * * *", // 日本時間 7:00
      async run(_ctx) {
        // TODO: ニュースを取得して ctx.push([...]) で送る（1回5吹き出しまで＝1通扱い）
      },
    },
  ],
};
