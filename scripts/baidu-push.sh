#!/usr/bin/env bash
# 百度站长平台「普通收录 → API 提交」。需要环境变量 BAIDU_PUSH_TOKEN（站长平台给的 token，不要写进仓库）。
# 用法：BAIDU_PUSH_TOKEN=xxx scripts/baidu-push.sh [url ...]，不传则推送全部页面。
set -euo pipefail
SITE="https://tax.warmbeing.com"
: "${BAIDU_PUSH_TOKEN:?请设置 BAIDU_PUSH_TOKEN}"
if [ $# -gt 0 ]; then URLS=("$@"); else URLS=("$SITE/" "$SITE/bonus" "$SITE/offer" "$SITE/settlement" "$SITE/social-insurance"); fi
printf '%s\n' "${URLS[@]}" | curl -sS -H 'Content-Type: text/plain' --data-binary @- \
  "http://data.zz.baidu.com/urls?site=${SITE}&token=${BAIDU_PUSH_TOKEN}" -w "\nHTTP %{http_code}\n"
