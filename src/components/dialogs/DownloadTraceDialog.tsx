import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

type DownloadTraceDialogProps = {
  defaultFileName: string
  onDownload: (fileName: string) => void
  onClose: () => void
}

export const DownloadTraceDialog = ({
  defaultFileName,
  onDownload,
  onClose,
}: DownloadTraceDialogProps) => {
  const [fileName, setFileName] = useState(defaultFileName)

  useEscapeKey(onClose)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = fileName.trim()
    if (trimmed) {
      onDownload(trimmed)
    }
  }

  const dialogContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-borderMuted bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-borderMuted px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">Download Trace</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-panelMuted hover:text-gray-200"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <label className="flex flex-col gap-2 text-sm text-gray-200">
            File Name
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="flex-1 rounded-lg border border-borderMuted bg-panelMuted px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
                placeholder="trace-name"
                autoFocus
              />
              <span className="text-gray-500">.json</span>
            </div>
            <span className="text-xs text-gray-500">
              Enter a name for your trace file (project name, session, etc.)
            </span>
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-borderMuted px-4 py-2 text-sm text-gray-300 transition hover:bg-panelMuted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fileName.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Download
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body)
  }

  return dialogContent
}
