#!/usr/bin/env bash
# 向 IndexNow（Bing / Yandex / Naver 等共用）推送站点 URL。用法：scripts/indexnow.sh [url ...]，不传则推送 sitemap 里的四个页面。
set -euo pipefail
HOST="tax.warmbeing.com"
KEY_FILE=$(ls "$(dirname "$0")"/../public/*.txt | head -1)
KEY=$(basename "$KEY_FILE" .txt)
if [ $# -gt 0 ]; then URLS=("$@"); else URLS=("https://$HOST/" "https://$HOST/bonus" "https://$HOST/settlement" "https://$HOST/social-insurance"); fi
LIST=$(printf '"%s",' "${URLS[@]}"); LIST="[${LIST%,}]"
curl -sS -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":$LIST}" -w "\nHTTP %{http_code}\n"
