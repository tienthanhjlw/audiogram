// TECH_ARCHITECTURE.md §2.3 — the one place allowed to import bindings.gen.ts
// (and therefore @tauri-apps/api/core, transitively). Everything else in the
// app calls `ipc.xxx()` and gets back either a resolved value or a thrown
// AppError — never a raw Rust error string, never a {status:'ok'|'error'}
// tag union to remember to check.
import { commands } from './bindings.gen'
import type {
  LayoutZones as LayoutZonesDto,
  ModelInfo,
  RenderJobDto,
  Segment,
  SpectrumResult,
  WriteAssParams,
} from './bindings.gen'
import { toAppError } from '../errors'

type Result<T, E> = { status: 'ok'; data: T } | { status: 'error'; error: E }

/** Awaits a tauri-specta Result-wrapped call, throwing a normalized AppError
 * on either an {status:'error'} business failure or an IPC-level throw. */
async function call<T>(promise: Promise<Result<T, string>>): Promise<T> {
  let result: Result<T, string>
  try {
    result = await promise
  } catch (e) {
    throw toAppError(e)
  }
  if (result.status === 'error') throw toAppError(result.error)
  return result.data
}

/** Same, for the two commands that don't return a Result at all (ping,
 * list_models) — only the IPC-level throw path applies. */
async function callDirect<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (e) {
    throw toAppError(e)
  }
}

export const ipc = {
  ping: (name: string) => callDirect(commands.ping(name)),
  openFolder: (path: string) => call(commands.openFolder(path)),
  renderAudiogram: (params: RenderJobDto) => call(commands.renderAudiogram(params)),
  resolveFfmpegPath: () => call(commands.resolveFfmpegPath()),
  analyzeSpectrum: (audioPath: string) => call(commands.analyzeSpectrum(audioPath)),
  transcribeAudio: (audioPath: string, modelName: string | null) =>
    call(commands.transcribeAudio(audioPath, modelName)),
  writeSrt: (segments: Segment[]) => call(commands.writeSrt(segments)),
  writeAss: (segments: Segment[], params: WriteAssParams) => call(commands.writeAss(segments, params)),
  listModels: () => callDirect(commands.listModels()),
  downloadModel: (name: string) => call(commands.downloadModel(name)),
  cancelRender: () => callDirect(commands.cancelRender()),
}

export type { ModelInfo, RenderJobDto, Segment, SpectrumResult, WriteAssParams, LayoutZonesDto }
