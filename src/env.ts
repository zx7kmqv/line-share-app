export interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  /** /api/* を叩くための自分用トークン（任意の長いランダム文字列） */
  API_TOKEN: string;
  /** 送信先IDや各機能のデータの保存先 */
  LINE_KV: KVNamespace;
}
