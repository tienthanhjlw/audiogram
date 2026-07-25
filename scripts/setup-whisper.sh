#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# scripts/setup-whisper.sh
# Builds a statically-linked whisper-cli binary and bundles it with
# the Tauri app so users need zero extra dependencies.
#
# Run ONCE before `npm run tauri dev` or `npm run tauri build`:
#   npm run setup:whisper
#
# Supports: macOS (arm64 + x86_64), Linux
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

WHISPER_VERSION="v1.7.5"
OS=$(uname -s)
ARCH=$(uname -m)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/apps/desktop/src-tauri"
BINARIES_DIR="$TAURI_DIR/binaries"

green()  { printf "\033[0;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[0;33m%s\033[0m\n" "$*"; }
red()    { printf "\033[0;31m%s\033[0m\n" "$*"; }

green "=== Audiogram — Whisper Setup ==="
echo  "Platform : $OS $ARCH"
echo  "Version  : $WHISPER_VERSION"
echo  "Root     : $ROOT"
echo ""

# ── Build static whisper-cli from source ───────────────────────
build_whisper_from_source() {
  local DEST="$1"
  local EXTRA_CMAKE_FLAGS="${2:-}"

  yellow "Building whisper-cli from source (static, no Homebrew deps)..."
  echo   "  This takes ~2 minutes on first run."
  echo ""

  if ! command -v cmake &>/dev/null; then
    if command -v brew &>/dev/null; then
      yellow "cmake not found — installing via Homebrew..."
      brew install cmake
    else
      red "cmake not found. Install it: brew install cmake"
      exit 1
    fi
  fi

  TMP=$(mktemp -d)
  trap "rm -rf '$TMP'" EXIT

  git clone --depth 1 --branch "$WHISPER_VERSION" \
    https://github.com/ggerganov/whisper.cpp "$TMP/whisper.cpp" 2>&1 \
    | grep -v "^$" | tail -5

  cmake -S "$TMP/whisper.cpp" -B "$TMP/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_EXAMPLES=ON \
    -DGGML_BLAS=OFF \
    -DGGML_OPENMP=OFF \
    $EXTRA_CMAKE_FLAGS \
    -DCMAKE_EXE_LINKER_FLAGS="-static-libstdc++ -static-libgcc" \
    > /dev/null 2>&1

  cmake --build "$TMP/build" --config Release -j"$(getconf _NPROCESSORS_ONLN)" \
    --target whisper-cli 2>&1 | grep -E "^\[|error:|warning:" | tail -10

  local BIN="$TMP/build/bin/whisper-cli"
  [ -f "$BIN" ] || { red "Build failed — binary not found"; exit 1; }

  cp "$BIN" "$DEST"
  chmod +x "$DEST"
  trap - EXIT
  rm -rf "$TMP"
  green "✓ Built static whisper-cli → $DEST ($(du -sh "$DEST" | cut -f1))"
}

# ── macOS ──────────────────────────────────────────────────────
if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    TRIPLE="aarch64-apple-darwin"
  else
    TRIPLE="x86_64-apple-darwin"
  fi

  DEST="$BINARIES_DIR/macos/whisper-cpp"
  TRIPLE_DEST="$BINARIES_DIR/macos/whisper-cpp-$TRIPLE"
  mkdir -p "$(dirname "$DEST")"

  if [ -f "$DEST" ] && [ -s "$DEST" ]; then
    # Verify it's statically linked (no Homebrew deps)
    if otool -L "$DEST" 2>/dev/null | grep -q /opt/homebrew; then
      yellow "Existing binary has Homebrew dylib deps — rebuilding static version..."
      chmod +w "$DEST" "$TRIPLE_DEST" 2>/dev/null || true
      build_whisper_from_source "$DEST" "-DGGML_METAL=ON"
    else
      green "✓ Static binary already bundled: $DEST ($(du -sh "$DEST" | cut -f1))"
    fi
  else
    build_whisper_from_source "$DEST" "-DGGML_METAL=ON"
  fi

  chmod +w "$TRIPLE_DEST" 2>/dev/null || true
  cp "$DEST" "$TRIPLE_DEST"
  green "✓ Triple-suffixed copy: $TRIPLE_DEST"

# ── Linux ───────────────────────────────────────────────────────
elif [ "$OS" = "Linux" ]; then
  DEST="$BINARIES_DIR/linux/whisper-cpp"
  mkdir -p "$(dirname "$DEST")"

  if [ -f "$DEST" ] && [ -s "$DEST" ]; then
    green "✓ Already bundled: $DEST"
  else
    build_whisper_from_source "$DEST" "-DGGML_CUDA=OFF"
  fi

else
  yellow "Windows: place a statically-linked whisper-cli.exe at:"
  yellow "  apps/desktop/src-tauri/binaries/windows/whisper-cpp.exe"
  yellow "Download from: https://github.com/ggerganov/whisper.cpp/releases"
fi

# ── Model setup ─────────────────────────────────────────────────
echo ""
green "=== Whisper model ==="

MODEL="${WHISPER_MODEL:-base}"
MODEL_FILE="$ROOT/models/ggml-${MODEL}.bin"
BUNDLE_MODEL_DIR="$TAURI_DIR/models"
BUNDLE_MODEL="$BUNDLE_MODEL_DIR/ggml-${MODEL}.bin"

APP_ID="com.root.audiogram"
if [ "$OS" = "Darwin" ]; then
  APP_DATA_MODEL="$HOME/Library/Application Support/$APP_ID/models/ggml-${MODEL}.bin"
elif [ "$OS" = "Linux" ]; then
  APP_DATA_MODEL="${XDG_DATA_HOME:-$HOME/.local/share}/$APP_ID/models/ggml-${MODEL}.bin"
else
  APP_DATA_MODEL="$APPDATA/$APP_ID/models/ggml-${MODEL}.bin"
fi

MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL}.bin"

# Find or download model
if [ -f "$MODEL_FILE" ] && [ -s "$MODEL_FILE" ]; then
  SIZE_MB=$(du -m "$MODEL_FILE" | cut -f1)
  green "✓ Model present in project: ggml-${MODEL}.bin (${SIZE_MB} MB)"
elif [ -f "$APP_DATA_MODEL" ] && [ -s "$APP_DATA_MODEL" ]; then
  SIZE_MB=$(du -m "$APP_DATA_MODEL" | cut -f1)
  green "✓ Model present in app data: (${SIZE_MB} MB) — copying to project models/"
  mkdir -p "$ROOT/models"
  cp "$APP_DATA_MODEL" "$MODEL_FILE"
else
  echo "  Model : ggml-${MODEL}.bin"
  echo "  URL   : $MODEL_URL"
  echo "  Dest  : $MODEL_FILE"
  echo ""
  mkdir -p "$ROOT/models"
  yellow "Downloading... (base ≈ 142 MB)"
  curl -L --progress-bar -o "${MODEL_FILE}.part" "$MODEL_URL"
  mv "${MODEL_FILE}.part" "$MODEL_FILE"
  SIZE_MB=$(du -m "$MODEL_FILE" | cut -f1)
  green "✓ Downloaded: ${SIZE_MB} MB"
fi

# Copy into src-tauri/models/ for bundling as Tauri resource
mkdir -p "$BUNDLE_MODEL_DIR"
if [ -f "$BUNDLE_MODEL" ] && [ -s "$BUNDLE_MODEL" ]; then
  green "✓ Bundle resource already present: src-tauri/models/ggml-${MODEL}.bin"
else
  cp "$MODEL_FILE" "$BUNDLE_MODEL"
  green "✓ Copied model to bundle resources: src-tauri/models/ggml-${MODEL}.bin"
fi

# Also seed app data dir for dev mode
if [ ! -f "$APP_DATA_MODEL" ] || [ ! -s "$APP_DATA_MODEL" ]; then
  mkdir -p "$(dirname "$APP_DATA_MODEL")"
  cp "$MODEL_FILE" "$APP_DATA_MODEL"
  green "✓ Seeded app data dir for dev mode"
fi

echo ""
green "=== Setup complete! ==="
echo ""
echo "  Binary : src-tauri/binaries/macos/whisper-cpp (static, no Homebrew deps)"
echo "  Model  : $MODEL_FILE"
echo "  Bundle : $BUNDLE_MODEL (packaged into app .dmg)"
echo ""
echo "To use a different model: WHISPER_MODEL=small npm run setup:whisper"
echo ""
echo "Next: npm run tauri dev"
