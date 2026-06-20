#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
  echo ""
  echo -e "${CYAN}正在停止所有服务…${NC}"
  kill $UVICORN_PID $REDIS_PID $CELERY_PID 2>/dev/null
  wait $UVICORN_PID $REDIS_PID $CELERY_PID 2>/dev/null
  echo -e "${GREEN}所有服务已停止。${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# 激活虚拟环境
if [ -f venv/bin/activate ]; then
  source venv/bin/activate
else
  echo -e "${RED}未找到虚拟环境，请先运行 python -m venv venv${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/bin/redis-cli" ]; then
  export PATH="$SCRIPT_DIR/bin:$PATH"
fi

echo -e "${GREEN}启动 Redis…${NC}"
if [ -f "$SCRIPT_DIR/bin/redis-server" ]; then
  "$SCRIPT_DIR/bin/redis-server" --daemonize yes --port 6379 --pidfile "$SCRIPT_DIR/.redis.pid" &
else
  redis-server --daemonize yes --port 6379 &
fi
REDIS_PID=$!

echo -e "${GREEN}启动 Celery Worker…${NC}"
celery -A app.celery_app worker --loglevel=info &
CELERY_PID=$!

echo -e "${GREEN}启动 FastAPI (端口 8000)…${NC}"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
UVICORN_PID=$!

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  FastAPI:  http://localhost:8000${NC}"
echo -e "${GREEN}  API 文档: http://localhost:8000/docs${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "按 ${RED}Ctrl+C${NC} 停止所有服务"
echo ""

wait
