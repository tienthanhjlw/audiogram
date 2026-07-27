// Pure formatting helpers — UI_DESIGN_SPEC.md §2.3's Recents card meta line
// ("2 days ago · 1:24").

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Coarse relative time for a recents card — not a full i18n library, just
 * the handful of buckets the card needs. `now` is injectable for tests. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Math.max(0, now - then)

  if (diff < MINUTE) return 'Just now'
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE)
    return `${m} minute${m === 1 ? '' : 's'} ago`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = Math.floor(diff / DAY)
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.floor(d / 7)
  if (d < 30) return `${w} week${w === 1 ? '' : 's'} ago`
  return new Date(then).toLocaleDateString()
}

/** `m:ss` timecode, no fractional seconds — distinct from
 * features/transport/TransportBar.tsx's `formatTimecode` (which keeps a
 * decimal for the hover tooltip's finer precision). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Export Sheet's FILE NAME field (UI_DESIGN_SPEC.md §7.1) prefills from
 * `title` — lowercase, non-alphanumerics collapsed to single hyphens,
 * trimmed. Falls back to 'audiogram' for an empty/all-punctuation title. */
export function slugify(text: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'audiogram'
}

/** Export Sheet's "Estimated: ~45 MB" — MB with no decimal once it's a
 * 3-digit number, GB past 1000 MB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}
