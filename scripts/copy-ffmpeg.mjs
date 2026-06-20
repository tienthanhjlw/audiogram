import { createReadStream, createWriteStream } from 'node:fs';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ffmpeg-static downloads a platform-specific ffmpeg binary during install
// and exposes its absolute path here.
import ffmpeg from 'ffmpeg-static';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

if (!ffmpeg) {
  console.warn('[fetch:ffmpeg] ffmpeg-static did not provide a binary for this platform.');
  process.exit(0);
}

/**
 * Map Node platform to our bundle destination path.
 */
function targetPath() {
  switch (process.platform) {
    case 'darwin':
      return join(root, 'src-tauri', 'binaries', 'macos', 'ffmpeg');
    case 'win32':
      return join(root, 'src-tauri', 'binaries', 'windows', 'ffmpeg.exe');
    case 'linux':
      return join(root, 'src-tauri', 'binaries', 'linux', 'ffmpeg');
    default:
      console.warn(`[fetch:ffmpeg] Unsupported platform: ${process.platform}`);
      process.exit(0);
  }
}

const dest = targetPath();
const dir = dirname(dest);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

console.log(`[fetch:ffmpeg] Copying ffmpeg from ${ffmpeg} to ${dest}`);
await new Promise((resolve, reject) => {
  createReadStream(ffmpeg)
    .on('error', reject)
    .pipe(createWriteStream(dest))
    .on('error', reject)
    .on('finish', resolve);
});

if (process.platform !== 'win32') {
  try { chmodSync(dest, 0o755); } catch {}
}

// Also copy to a filename with the Rust target triple suffix that Tauri expects
function tauriTargetTriple() {
  const arch = process.arch;
  switch (process.platform) {
    case 'darwin':
      return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
    case 'win32':
      return arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
    case 'linux':
      return arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
    default:
      return null;
  }
}

const triple = tauriTargetTriple();
if (triple) {
  const suffixed = dest.replace(/(\.exe)?$/, (_, ext) => `-${triple}${ext || ''}`);
  console.log(`[fetch:ffmpeg] Creating suffixed copy: ${suffixed}`);
  await new Promise((resolve, reject) => {
    createReadStream(ffmpeg)
      .on('error', reject)
      .pipe(createWriteStream(suffixed))
      .on('error', reject)
      .on('finish', resolve);
  });
  if (process.platform !== 'win32') {
    try { chmodSync(suffixed, 0o755); } catch {}
  }
}

console.log('[fetch:ffmpeg] Done.');
