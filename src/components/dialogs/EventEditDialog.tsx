import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { TraceEvent } from '../../types/trace'
import type { EventOverride } from '../../types/timeline'
import { useEscapeKey } from '../../hooks/useEscapeKey'

type EventEditDialogProps = {
  event: TraceEvent
  override?: EventOverride
  originalLabel: string
  onChangeLabel: (value: string) => void
  onReset: () => void
  onClose: () => void
}

export const EventEditDialog = ({
  event,
  override,
  originalLabel,
  onChangeLabel,
  onReset,
  onClose,
}: EventEditDialogProps) => {
  const value = override?.label ?? event.label ?? event.text ?? ''

  useEscapeKey(onClose)

  const dialogContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-borderMuted bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-borderMuted px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">Edit Event Metadata</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-panelMuted hover:text-gray-200"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <label className="flex flex-col gap-2 text-sm text-gray-200">
            Label
            <input
              type="text"
              value={value}
              onChange={(e) => onChangeLabel(e.target.value)}
              className="rounded-lg border border-borderMuted bg-panelMuted px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
              placeholder="Event label"
              autoFocus
            />
            <span className="text-xs text-gray-500">Original: {originalLabel || '—'}</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 rounded-lg border border-borderMuted px-4 py-2 text-sm text-gray-300 transition hover:bg-panelMuted"
            >
              Reset changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-accent/90"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body)
  }

  return dialogContent
}
