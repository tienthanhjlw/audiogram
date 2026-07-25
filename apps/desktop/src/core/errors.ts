// TECH_ARCHITECTURE.md §4.1 — one error shape for every source (IPC, engine,
// DOM), so UI code never has to branch on "is this a raw string or an
// Error or a Rust error". Rust commands currently return `Result<T, String>`
// (see presentation/commands/*.rs), so normalization here is a substring
// heuristic on that string — good enough until the backend grows a real
// structured AppError enum crossing the IPC boundary.
export type AppErrorKind =
  | 'ffmpeg-missing'
  | 'whisper-failed'
  | 'decode-failed'
  | 'io'
  | 'cancelled'
  | 'unknown'

export interface AppError {
  kind: AppErrorKind
  message: string
  detail?: string
  retryable: boolean
}

const RETRYABLE_KINDS: ReadonlySet<AppErrorKind> = new Set(['whisper-failed', 'io', 'unknown'])

const FRIENDLY_MESSAGE: Record<AppErrorKind, string> = {
  'ffmpeg-missing': 'FFmpeg could not be found.',
  'whisper-failed': 'Speech recognition failed.',
  'decode-failed': 'Could not decode this audio file.',
  io: 'A file operation failed.',
  cancelled: 'Cancelled.',
  unknown: 'Something went wrong.',
}

function classify(raw: string): AppErrorKind {
  const s = raw.toLowerCase()
  if (s.includes('ffmpeg')) return 'ffmpeg-missing'
  if (s.includes('whisper') || s.includes('model')) return 'whisper-failed'
  if (s.includes('decode')) return 'decode-failed'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('io error') || s.includes('no such file') || s.includes('permission denied')) return 'io'
  return 'unknown'
}

/** Normalize any error-ish value (Rust IPC error string, DOM error, thrown
 * Error, or an AppError already) into one AppError shape. */
export function toAppError(source: unknown): AppError {
  if (isAppError(source)) return source

  const raw = source instanceof Error ? source.message : String(source)
  const kind = classify(raw)
  return {
    kind,
    message: FRIENDLY_MESSAGE[kind],
    detail: raw,
    retryable: RETRYABLE_KINDS.has(kind),
  }
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'message' in value &&
    'retryable' in value
  )
}
