import { text } from "../line";
import type { Feature } from "./types";

export const recipe: Feature = {
  id: "recipe",
  label: "献立",
  emoji: "🍳",
  description: "今日の献立・レシピの提案",
  keywords: ["献立", "レシピ", "recipe"],
  defaultTarget: "family",

  async onMessage(_ctx, _args) {
    // TODO: 献立の提案・レシピ検索・買い物リスト
    return [text("献立・レシピは準備中です。")];
  },
};
