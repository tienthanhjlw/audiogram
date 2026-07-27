import { useCallback } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../../store'
import { ipc, type LayoutZonesDto } from '../../core/ipc/client'
import { CANVAS_SIZES, type LayoutZones } from '../../types'
import type { AppError } from '../../core/errors'

/** Mirrors StepExport.tsx's own `toZonesDto` (kept there too — that file is
 * deleted whole in p3-t13, not worth de-duplicating into a shared helper
 * for its last few weeks of existence). */
function toZonesDto(zones: LayoutZones | null): LayoutZonesDto | null {
  if (!zones) return null
  return {
    waveform: zones.waveform,
    title: zones.title,
    avatar: zones.avatar ?? null,
    subtitle: zones.subtitle ?? null,
  }
}

// Export Sheet's render trigger (PHASE3_TASKS.md T10) — the save() dialog +
// write_ass + renderAudiogram sequence ported from StepExport.tsx's own
// `render()`, adapted to take the sheet's file name field instead of
// reading `title` directly, and to drive `exportSheet` state instead of
// `StepExport`'s local UI. The actual State B/C/D UI (progress checklist,
// success/error screens) is p3-t11/t12 — this hook only needs to get a
// render started and land on the right terminal state.
export function useRenderExport() {
  const run = useCallback(async (fileName: string): Promise<void> => {
    const state = useAppStore.getState()
    const {
      audioPath, peaks, bgColor, canvasSize, waveColor, waveStyle, title,
      layoutTemplate, coverImagePath, segments, fontSize, fontName,
      karaokeEnabled, karaokeColor, subtitleColor, subtitleYPct, zones, fps,
      showSubtitles, titleColor, titleAlign, titleBold, titleItalic, set,
    } = state
    const { w, h } = CANVAS_SIZES[canvasSize]

    const outPath = await save({
      defaultPath: `${fileName || 'audiogram'}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })
    if (!outPath) return

    let captionsPath: string | null = null
    if (showSubtitles && segments.length > 0) {
      captionsPath = await ipc.writeAss(segments, {
        highlightColor: karaokeColor,
        videoWidth: w,
        videoHeight: h,
        fontSizePct: fontSize,
        layoutTemplate,
        karaokeEnabled,
        fontName,
        subtitleYPct: subtitleYPct ?? null,
        subtitleColor,
      })
    }

    set({
      exportSheet: 'rendering',
      exportSheetMinimized: false,
      isRendering: true,
      progress: 0,
      stage: 'preparing',
      logs: [
        'Starting render…',
        captionsPath ? `Subtitles${karaokeEnabled ? ' (karaoke)' : ''}: ${captionsPath}` : '(no subtitles)',
      ],
    })

    try {
      const res = await ipc.renderAudiogram({
        audio_path: audioPath,
        peaks,
        bg_color: bgColor,
        captions_path: captionsPath,
        width: w,
        height: h,
        fps,
        wave_color: waveColor,
        wave_style: waveStyle,
        intro_title: title || null,
        font_size: fontSize,
        font_name: fontName,
        layout_template: layoutTemplate,
        output_path: outPath,
        cover_image_path: coverImagePath || null,
        zones: toZonesDto(zones),
        title_color: titleColor,
        title_align: titleAlign,
        title_bold: titleBold,
        title_italic: titleItalic,
      })
      useAppStore.setState(s => ({ lastOutput: res, isRendering: false, exportSheet: 'success', exportSheetMinimized: false, logs: [...s.logs, `Done: ${res}`] }))
    } catch (e) {
      const err = e as AppError
      useAppStore.setState(s => ({
        isRendering: false, exportSheet: 'error', exportSheetMinimized: false,
        lastErrorMessage: err.message,
        logs: [...s.logs, `Error: ${err.detail ?? err.message}`],
      }))
    }
  }, [])

  return { run }
}
