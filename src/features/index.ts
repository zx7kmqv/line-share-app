// 機能の一覧。新しい機能はファイルを作ってここに足すだけ。
import { news } from "./news";
import { recipe } from "./recipe";
import { reminder } from "./reminder";
import type { Feature } from "./types";

export const features: Feature[] = [news, reminder, recipe];

export function findFeature(idOrWord: string): Feature | undefined {
  const w = idOrWord.trim().toLowerCase();
  return features.find(
    (f) => f.id === w || f.label === w || f.keywords.some((k) => k.toLowerCase() === w),
  );
}

export function senderOf(f: Feature) {
  return f.sender ?? { name: `${f.emoji}${f.label}` };
}
