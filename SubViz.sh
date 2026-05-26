#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "SubViz 订阅节点可视化分析器"
echo "=========================="

if [ -x "./node/bin/node" ]; then
  NODE="./node/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE="node"
else
  echo "[错误] 未找到 Node.js，请安装 Node.js 18+。"
  exit 1
fi

echo "启动中... 浏览器访问 http://localhost:3456"
exec "$NODE" server.js
