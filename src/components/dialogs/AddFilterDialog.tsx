import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { TraceEvent } from '../../types/trace'
import type { FilterGroupOption } from '../../types/timeline'
import { useEscapeKey } from '../../hooks/useEscapeKey'

type AddFilterDialogProps = {
  event: TraceEvent
  filterGroups: FilterGroupOption[]
  onAddFilter: (domain: string, groupId: string) => void
  onClose: () => void
}

const escapeRegexDomain = (domain: string) => {
  return domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const extractDomain = (event: TraceEvent): string => {
  if (event.host) {
    return event.host
  }
  const urlString = event.url || event.targetUrl || ''
  if (!urlString) {
    return ''
  }
  try {
    const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`)
    return url.host
  } catch {
    return urlString.split('/')[0] || ''
  }
}

export const AddFilterDialog = ({
  event,
  filterGroups,
  onAddFilter,
  onClose,
}: AddFilterDialogProps) => {
  const domain = extractDomain(event)
  const escapedDomain = escapeRegexDomain(domain)
  const [filterPattern, setFilterPattern] = useState(escapedDomain)
  const [selectedGroupId, setSelectedGroupId] = useState(filterGroups[0]?.id || '')

  useEscapeKey(onClose)

  const selectedGroup = filterGroups.find((group) => group.id === selectedGroupId)

  const handleSubmit = () => {
    if (filterPattern.trim() && selectedGroupId) {
      onAddFilter(filterPattern.trim(), selectedGroupId)
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
          <h2 className="text-lg font-semibold text-gray-100">Add Domain Filter</h2>
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
          <div className="space-y-2">
            <label htmlFor="filter-pattern-input" className="block text-sm font-medium text-gray-200">
              Filter pattern
            </label>
            <input
              id="filter-pattern-input"
              type="text"
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
              className="w-full rounded-lg border border-borderMuted bg-panelMuted px-3 py-2.5 text-sm text-blue-300 font-mono focus:border-accent focus:outline-none"
              placeholder="Enter regex pattern"
              autoFocus
              spellCheck={false}
            />
            <p className="text-xs text-gray-500">
              Regex pattern to match request URLs. Original domain:{' '}
              <code className="text-gray-400">{domain || 'none'}</code>
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="filter-group-select" className="block text-sm font-medium text-gray-200">
              Add to filter group
            </label>
            <select
              id="filter-group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full rounded-lg border border-borderMuted bg-panelMuted px-3 py-2.5 text-sm text-gray-100 focus:border-accent focus:outline-none"
            >
              {filterGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          {selectedGroup && (
            <div className="rounded-lg border border-borderMuted/60 bg-panelMuted/50 px-3 py-2.5">
              <p className="text-xs text-gray-400">{selectedGroup.description}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-borderMuted px-4 py-2 text-sm text-gray-300 transition hover:bg-panelMuted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!filterPattern.trim() || !selectedGroupId}
              className="flex-1 rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add filter
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
