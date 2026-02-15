#!/usr/bin/env bash
set -euo pipefail

# ===== Config =====
LLAMA_DIR="${LLAMA_DIR:-$HOME/llama.cpp}"

# NOTE: llama-server is started with: -m ../models/$F1 (relative to $LLAMA_DIR/build)
# So the model must live in: $LLAMA_DIR/models
MODEL_DIR="${MODEL_DIR:-$LLAMA_DIR/models}"

F1="qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf"
F2="qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf"

HOST="${LLM_HOST:-127.0.0.1}"
PORT="${LLM_PORT:-8000}"
CTX="${LLM_CTX:-4096}"
NGL="${LLM_NGL:-30}"   # Apple Silicon default

REPO_BASE="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main"

say() { printf "\033[1;36m[dev_up]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[dev_up]\033[0m %s\n" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

download() {
  local url="$1"
  local out="$2"
  mkdir -p "$(dirname "$out")"

  if [[ -f "$out" ]]; then
    say "Already exists: $(basename "$out")"
    return 0
  fi

  say "Downloading: $(basename "$out")"
  if have aria2c; then
    aria2c -x 8 -s 8 -c -o "$(basename "$out")" -d "$(dirname "$out")" "$url"
  elif have curl; then
    curl -L --fail --retry 3 --retry-delay 2 -C - -o "$out" "$url"
  else
    die "Need aria2c or curl installed."
  fi
}

ensure_llama() {
  if [[ ! -d "$LLAMA_DIR/.git" ]]; then
    say "Cloning llama.cpp → $LLAMA_DIR"
    have git || die "git is required"
    git clone https://github.com/ggerganov/llama.cpp.git "$LLAMA_DIR"
  else
    say "Found llama.cpp → $LLAMA_DIR"
  fi
}

build_server() {
  local bin="$LLAMA_DIR/build/bin/llama-server"
  if [[ -x "$bin" ]]; then
    say "Found llama-server → $bin"
    return 0
  fi

  say "Building llama.cpp (first time takes a bit)..."
  have cmake || die "cmake required (brew install cmake)"
  pushd "$LLAMA_DIR" >/dev/null
  mkdir -p build
  cmake -S . -B build
  cmake --build build -j
  popd >/dev/null

  [[ -x "$bin" ]] || die "Build finished but llama-server not found at $bin"
  say "Built llama-server ✅"
}

ensure_model() {
  mkdir -p "$MODEL_DIR"
  say "Model dir: $MODEL_DIR"

  local f1_path="$MODEL_DIR/$F1"
  local f2_path="$MODEL_DIR/$F2"

  if [[ -f "$f1_path" && -f "$f2_path" ]]; then
    say "Qwen model already installed."
    return 0
  fi

  say "Model not fully present. Downloading missing parts..."

  [[ -f "$f1_path" ]] || download "$REPO_BASE/$F1" "$f1_path"
  [[ -f "$f2_path" ]] || download "$REPO_BASE/$F2" "$f2_path"

  [[ -f "$f1_path" ]] || die "Missing model file: $f1_path"
  [[ -f "$f2_path" ]] || die "Missing model file: $f2_path"

  say "Model ready."
}

start_llm() {
  say "Starting llama-server using your exact command..."
  pushd "$LLAMA_DIR/build" >/dev/null

  ./bin/llama-server \
    -m ../models/$F1 \
    -c "$CTX" \
    -ngl "$NGL" \
    --host "$HOST" \
    --port "$PORT" \
    > "$OLDPWD/.llama-server.log" 2>&1 &

  LLM_PID=$!
  popd >/dev/null

  say "llama-server PID=$LLM_PID (logs: .llama-server.log)"
}

wait_llm() {
  say "Waiting for LLM to respond..."
  local tries=0
  local max_tries=60

  while [[ $tries -lt $max_tries ]]; do
    tries=$((tries + 1))
    say "Health check attempt $tries/$max_tries..."

    if ! kill -0 "$LLM_PID" 2>/dev/null; then
      say "llama-server exited early. Last 120 log lines:"
      tail -n 120 .llama-server.log || true
      die "LLM crashed during startup (see .llama-server.log)."
    fi

    # Health check that works across llama-server versions
    if curl --max-time 1 -sSf "http://$HOST:$PORT/" >/dev/null 2>&1; then
      say "LLM ready ✅"
      return 0
    fi

    sleep 1
  done

  say "Timed out. Last 120 log lines:"
  tail -n 120 .llama-server.log || true
  die "LLM did not become ready."
}

cleanup() {
  if [[ -n "${LLM_PID:-}" ]]; then
    say "Stopping llama-server PID=$LLM_PID"
    kill "$LLM_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

say "Boot sequence..."
ensure_llama
build_server
ensure_model
start_llm
wait_llm

export LLM_BASE_URL="http://$HOST:$PORT/v1"
export LLM_MODEL="${LLM_MODEL:-qwen}"

say "Starting Next.js..."
have npm || die "npm required"
cd ai-practice-lab
npm run dev
