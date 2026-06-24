#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Audiogram generator (FFmpeg)

Usage:
  $(basename "$0") -a <audio> -b <image> -o <output.mp4> [options]

Required:
  -a  Audio file (mp3, wav, m4a, flac, aac)
  -b  Background image (png/jpg)
  -o  Output mp4 path

Options:
  -r  Resolution WxH (default: 1280x720)  e.g. 1920x1080, 1080x1080, 1080x1920
  -f  FPS (default: 30)
  -m  Wave mode: cline | sline | line | bar | p2p (default: bar)
  -c  Wave color hex (default: #00FFC3) e.g. #FF3B3B
  -s  Optional captions (SRT) to burn in
  -h  Show this help

Examples:
  $(basename "$0") -a song.m4a -b bg.png -o out.mp4
  $(basename "$0") -a song.m4a -b bg.png -o out.mp4 -r 1080x1080 -f 60 -m line -c '#FF3B3B'
  $(basename "$0") -a song.m4a -b bg.png -o out.mp4 -s subs.srt
EOF
}

AUDIO=""
BG=""
OUT=""
RES="1280x720"
FPS=30
MODE="bar"
COLOR="#00FFC3"
SRT=""

while getopts ":a:b:o:r:f:m:c:s:h" opt; do
  case "$opt" in
    a) AUDIO="$OPTARG" ;;
    b) BG="$OPTARG" ;;
    o) OUT="$OPTARG" ;;
    r) RES="$OPTARG" ;;
    f) FPS="$OPTARG" ;;
    m) MODE="$OPTARG" ;;
    c) COLOR="$OPTARG" ;;
    s) SRT="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) echo "Unknown option: -$OPTARG" >&2; usage; exit 1 ;;
    :) echo "Option -$OPTARG requires an argument." >&2; usage; exit 1 ;;
  esac
done

# Validate required
if [ -z "${AUDIO}" ] || [ -z "${BG}" ] || [ -z "${OUT}" ]; then
  echo "Missing required args." >&2
  usage
  exit 1
fi
if [ ! -f "${AUDIO}" ]; then
  echo "Audio not found: ${AUDIO}" >&2
  exit 1
fi
if [ ! -f "${BG}" ]; then
  echo "Background image not found: ${BG}" >&2
  exit 1
fi
if [ -n "${SRT}" ] && [ ! -f "${SRT}" ]; then
  echo "Warning: SRT not found, ignoring: ${SRT}" >&2
  SRT=""
fi

# Parse resolution
# Parse resolution
W=$(printf "%s" "$RES" | awk -F"x" '{print $1}')
H=$(printf "%s" "$RES" | awk -F"x" '{print $2}')
case "$W$H" in
  (*[!0-9]*) echo "Invalid resolution format: $RES (expected WxH)" >&2; exit 1;;
  ("") echo "Invalid resolution format: $RES (expected WxH)" >&2; exit 1;;
esac

# Wave layout: height ~ 1/3 video, clamp [120,300], with bottom margin 60
wave_h=$(( H / 3 ))
(( wave_h < 120 )) && wave_h=120
(( wave_h > 300 )) && wave_h=300
overlay_y=$(( H - wave_h - 60 ))
(( overlay_y < 0 )) && overlay_y=0

# Normalize color to 0xRRGGBB
case "$COLOR" in
  \#*) COLOR=${COLOR#\#} ;;
esac
COLOR="0x${COLOR}"

# Validate mode and map to ffmpeg-supported showwaves modes
# FFmpeg showwaves supports: point | line | p2p
# We map unsupported names for convenience: bar->p2p, cline/sline->line
case "$MODE" in
  bar) SW_MODE="p2p" ;;
  cline|sline) SW_MODE="line" ;;
  line|p2p|point) SW_MODE="$MODE" ;;
  *) echo "Invalid mode: $MODE (use cline|sline|line|bar|p2p)" >&2; exit 1 ;;
esac

# Build filter graph
FILTER="[0:v]scale=${W}:${H},format=rgba[bg];[1:a]aformat=channel_layouts=stereo,showwaves=s=${W}x${wave_h}:mode=${SW_MODE}:colors=${COLOR},format=rgba[w];[bg][w]overlay=0:${overlay_y},format=yuv420p[v]"
VLAB="[v]"

# Escape a path for use in subtitles= filter (escape \\, :, ')
escape_filter_path() {
  # Escape \, :, '
  printf "%s" "$1" \
    | sed -e 's/\\/\\\\/g' -e 's/:/\\:/g' -e "s/'/\\\\'/g"
}

if [ -n "$SRT" ]; then
  esc_srt=$(escape_filter_path "$SRT")
  FILTER="${FILTER};${VLAB}subtitles='${esc_srt}':force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00222222&,Outline=2,Shadow=1[out]"
  VLAB="[out]"
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUT")"

# Run ffmpeg
set -x
ffmpeg -y \
  -loop 1 -framerate "$FPS" -i "$BG" \
  -i "$AUDIO" \
  -filter_complex "$FILTER" \
  -map "$VLAB" -map "1:a" \
  -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart -shortest -r "$FPS" \
  "$OUT"
set +x

# Verify output
if [ ! -f "$OUT" ]; then
  echo "Error: output file not found: $OUT" >&2
  exit 2
fi
if [ ! -s "$OUT" ]; then
  echo "Error: output file is empty: $OUT" >&2
  exit 3
fi

echo "Done: $OUT"
