#!/usr/bin/env bash
# 使い方: ./scripts/push.sh <family|me|ID> "メッセージ"
# 事前に LINE_API_URL と API_TOKEN を環境変数に設定しておく
set -euo pipefail
: "${LINE_API_URL:?LINE_API_URL を設定してください}"
: "${API_TOKEN:?API_TOKEN を設定してください}"
to="${1:?送信先を指定してください (family / me)}"
msg="${2:?メッセージを指定してください}"
payload=$(node -e 'console.log(JSON.stringify({to:process.argv[1],text:process.argv[2]}))' "$to" "$msg")
curl -sS -X POST "$LINE_API_URL/api/push" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$payload"
echo
