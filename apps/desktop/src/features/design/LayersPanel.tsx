// features/design/LayersPanel.tsx — P5-T7. Lists store.nodes (the scene
// graph, P5-T6), lets the user add/hide/reorder/select them. Lives behind
// the "Try new layers (beta)" toolbar toggle (store/ui.slice.ts's
// layersBetaEnabled) — collapsed by default, never the entry point: the
// template gallery in DesignPanel.tsx above it is unaffected either way
// (PHASE5_TASKS.md §7b — this panel is additive, not a replacement).
import { useState } from 'react'
import { useAppStore } from '../../store'
import { Button } from '../../ui'
import type { SceneNode, SceneNodeType } from '../../types'

let nextManualId = 0
function makeId(prefix: string): string {
  nextManualId += 1
  return `${prefix}-${Date.now()}-${nextManualId}`
}

function newTextNode(): SceneNode {
  return {
    id: makeId('text'),
    type: 'text',
    transform: { x: 0.3, y: 0.4, w: 0.4, h: 0.15, rotation: 0, opacity: 1 },
    z: 100,
    props: {
      type: 'text', text: 'New text', role: 'freeform', boundToTranscript: false,
      color: '#FFFFFF', font: 'Arial', size: 40, align: 'center', bold: false, italic: false,
    },
  }
}

function newImageNode(): SceneNode {
  return {
    id: makeId('image'),
    type: 'image',
    transform: { x: 0.35, y: 0.35, w: 0.3, h: 0.3, rotation: 0, opacity: 1 },
    z: 100,
    props: { type: 'image', src: '', fit: 'cover', shape: 'rect' },
  }
}

function newStickerNode(assetId: string): SceneNode {
  return {
    id: makeId('sticker'),
    type: 'sticker',
    transform: { x: 0.4, y: 0.4, w: 0.2, h: 0.2, rotation: 0, opacity: 1 },
    z: 100,
    props: { type: 'sticker', assetId },
  }
}

const TYPE_ICON: Record<SceneNodeType, string> = {
  waveform: '〜', text: 'T', image: '🖼', sticker: '★', video: '▶', group: '▤',
}

function nodeLabel(node: SceneNode): string {
  if (node.props?.type === 'text') return node.props.text || '(empty text)'
  if (node.props?.type === 'image') return node.props.src ? node.props.src.split('/').pop()! : '(no image)'
  if (node.props?.type === 'sticker') return `Sticker: ${node.props.assetId}`
  if (node.props?.type === 'video') return 'Video background'
  if (node.type === 'waveform') return 'Waveform'
  return node.type
}

export function LayersPanel() {
  const nodes = useAppStore(s => s.nodes)
  const selectedNodeIds = useAppStore(s => s.selectedNodeIds)
  const setSelectedNodeIds = useAppStore(s => s.setSelectedNodeIds)
  const addNode = useAppStore(s => s.addNode)
  const removeNode = useAppStore(s => s.removeNode)
  const updateNodeTransform = useAppStore(s => s.updateNodeTransform)
  const moveNodeZ = useAppStore(s => s.moveNodeZ)
  const groupNodes = useAppStore(s => s.groupNodes)
  const ungroupNode = useAppStore(s => s.ungroupNode)
  const [collapsed, setCollapsed] = useState(true)

  const sorted = [...nodes].sort((a, b) => b.z - a.z) // topmost (highest z) first, matches most layer UIs

  const selectRow = (nodeId: string, e: { shiftKey: boolean }) => {
    if (e.shiftKey) {
      setSelectedNodeIds(
        selectedNodeIds.includes(nodeId)
          ? selectedNodeIds.filter(id => id !== nodeId)
          : [...selectedNodeIds, nodeId],
      )
    } else {
      setSelectedNodeIds([nodeId])
    }
  }

  const selectedGroupId = selectedNodeIds.length === 1
    ? nodes.find(n => n.id === selectedNodeIds[0] && n.type === 'group')?.id
    : undefined

  return (
    <section className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="mb-2 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3"
      >
        <span>Layers <span className="normal-case text-text-3/70">(beta)</span></span>
        <span>{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => addNode(newTextNode())}>+ Text</Button>
            <Button size="sm" variant="ghost" onClick={() => addNode(newImageNode())}>+ Image</Button>
            <Button size="sm" variant="ghost" onClick={() => addNode(newStickerNode('mic-wave'))}>+ Sticker</Button>
            {selectedNodeIds.length >= 2 && (
              <Button size="sm" variant="ghost" onClick={() => groupNodes(selectedNodeIds)}>Group ⌘G</Button>
            )}
            {selectedGroupId && (
              <Button size="sm" variant="ghost" onClick={() => ungroupNode(selectedGroupId)}>Ungroup ⇧⌘G</Button>
            )}
          </div>

          {sorted.length === 0 ? (
            <p className="rounded-[var(--radius-s)] border border-dashed border-border p-3 text-[11px] leading-relaxed text-text-3">
              Add text, images or stickers on top of your template.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sorted.map((node, i) => {
                const selected = selectedNodeIds.includes(node.id)
                const hidden = (node.transform.opacity ?? 1) === 0
                return (
                  <li
                    key={node.id}
                    className={[
                      'flex items-center gap-1.5 rounded-[var(--radius-s)] border px-2 py-1.5 text-[12px]',
                      selected ? 'border-accent bg-bg-elevated' : 'border-transparent hover:bg-bg-elevated',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={e => selectRow(node.id, e)}
                      className="flex flex-1 items-center gap-1.5 overflow-hidden text-left"
                    >
                      <span className="w-4 shrink-0 text-center text-text-3">{TYPE_ICON[node.type]}</span>
                      <span className={['truncate', hidden ? 'text-text-3 line-through' : 'text-text-1'].join(' ')}>
                        {nodeLabel(node)}
                      </span>
                    </button>
                    <button
                      type="button"
                      title={hidden ? 'Show' : 'Hide'}
                      onClick={() => updateNodeTransform(node.id, { opacity: hidden ? 1 : 0 })}
                      className="shrink-0 text-text-3 hover:text-text-1"
                    >
                      {hidden ? '🚫' : '👁'}
                    </button>
                    <button
                      type="button"
                      title="Move up"
                      disabled={i === 0}
                      onClick={() => moveNodeZ(node.id, 'up')}
                      className="shrink-0 text-text-3 hover:text-text-1 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={i === sorted.length - 1}
                      onClick={() => moveNodeZ(node.id, 'down')}
                      className="shrink-0 text-text-3 hover:text-text-1 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => removeNode(node.id)}
                      className="shrink-0 text-text-3 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
