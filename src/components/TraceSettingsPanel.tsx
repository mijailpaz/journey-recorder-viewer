import { useMemo, useRef } from 'react'
import { Download, Upload, FileJson } from 'lucide-react'
import type { TraceEvent, TraceFile } from '../types/trace'
import type { TraceFilterCounts, TraceFilterSettings } from '../utils/traceFilters'
import { downloadPostmanCollection } from '../utils/postmanExporter'

type TraceSettingsPanelProps = {
  rawTrace: TraceFile | null
  filteredTrace: TraceFile | null
  settings: TraceFilterSettings
  ignoredCounts: TraceFilterCounts
  manualRemovalCount: number
  removedEvents: TraceEvent[]
  onRestoreEvent: (eventId: string) => void
  onUpdateSettings: (
    updater: (prev: TraceFilterSettings) => TraceFilterSettings,
  ) => void
  onResetFilters: () => void
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border border-borderMuted/60 bg-panelMuted/40 px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
      {label}
    </p>
    <p className="text-xl font-semibold text-gray-100">{value}</p>
  </div>
)

const formatRemovedEvent = (event: TraceEvent) => {
  const label = event.label || event.text || event.path || event.url || event.kind
  const method = event.method ? `${event.method} · ` : ''
  const status = typeof event.status === 'number' ? ` (${event.status})` : ''
  return `${event.kind === 'request' ? method : ''}${label}${status}`
}

const MAX_PREVIEW_LINES = 500

const jsonPreview = (trace: TraceFile | null) => {
  if (!trace) {
    return 'Load a trace JSON file to preview the filtered output.'
  }
  try {
    const text = JSON.stringify(trace, null, 2)
    const lines = text.split('\n')

    if (lines.length > MAX_PREVIEW_LINES) {
      const visible = lines.slice(0, MAX_PREVIEW_LINES)
      visible.push(`… truncated ${lines.length - MAX_PREVIEW_LINES} lines from preview …`)
      return visible.join('\n')
    }

    return text
  } catch (error) {
    return `Unable to render trace: ${String(error)}`
  }
}

const TraceSettingsPanel = ({
  rawTrace,
  filteredTrace,
  settings,
  ignoredCounts,
  manualRemovalCount,
  removedEvents,
  onRestoreEvent,
  onUpdateSettings,
  onResetFilters,
}: TraceSettingsPanelProps) => {
  const importInputRef = useRef<HTMLInputElement>(null)

  if (!rawTrace) {
    return null
  }

  const totalEvents = rawTrace.events?.length ?? 0
  const visibleEvents = filteredTrace?.events?.length ?? 0
  const filteredEvents = Math.max(totalEvents - visibleEvents, 0)
  const jsonText = useMemo(() => jsonPreview(filteredTrace), [filteredTrace])

  const handleExportFilters = () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      filters: {
        applyFilters: settings.applyFilters,
        customRegexText: settings.customRegexText,
        groups: settings.groups.map((group) => ({
          id: group.id,
          label: group.label,
          description: group.description,
          enabled: group.enabled,
          patternsText: group.patternsText,
        })),
      },
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `journey-filters-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportFilters = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)
        
        // Validate the imported data structure
        if (!importData.filters || !Array.isArray(importData.filters.groups)) {
          throw new Error('Invalid filter file format')
        }

        onUpdateSettings(() => ({
          applyFilters: importData.filters.applyFilters ?? true,
          customRegexText: importData.filters.customRegexText ?? '',
          groups: importData.filters.groups.map((group: TraceFilterSettings['groups'][0]) => ({
            id: group.id,
            label: group.label,
            description: group.description,
            enabled: group.enabled ?? true,
            patternsText: group.patternsText ?? '',
          })),
        }))
      } catch (error) {
        console.error('Failed to import filters:', error)
        alert('Failed to import filters. Please check the file format.')
      }
    }
    reader.readAsText(file)
    // Reset the input so the same file can be imported again
    event.target.value = ''
  }

  return (
    <section className="rounded-2xl border border-borderMuted bg-panelMuted/40 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            Trace Settings
          </p>
          <p className="text-lg font-semibold text-gray-50">
            Filter requests & preview JSON
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={settings.applyFilters}
              onChange={() =>
                onUpdateSettings((prev) => ({ ...prev, applyFilters: !prev.applyFilters }))
              }
            />
            Apply filters
          </label>
          <button
            type="button"
            onClick={handleExportFilters}
            className="flex items-center gap-1.5 rounded-lg border border-borderMuted px-3 py-1 text-sm text-gray-300 transition hover:bg-panel"
            title="Export filter settings to JSON file"
          >
            <Download size={14} />
            Export
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-borderMuted px-3 py-1 text-sm text-gray-300 transition hover:bg-panel"
            title="Import filter settings from JSON file"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              if (filteredTrace?.events) {
                downloadPostmanCollection(filteredTrace.events)
              }
            }}
            disabled={!filteredTrace?.events?.length}
            className="flex items-center gap-1.5 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-1 text-sm text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            title="Export all request events as Postman collection"
          >
            <FileJson size={14} />
            Postman
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFilters}
            className="hidden"
          />
          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-lg border border-borderMuted px-3 py-1 text-sm text-gray-300 transition hover:bg-panel"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Stat label="Total events" value={totalEvents} />
        <Stat label="Visible events" value={visibleEvents} />
        <Stat label="Filtered out" value={filteredEvents} />
        <Stat label="Manual removals" value={manualRemovalCount} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,45%)_minmax(0,55%)]">
        <div className="space-y-4 min-w-0">
          {settings.groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl border border-borderMuted/60 bg-panelMuted/30 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-100">
                    {group.label}
                  </p>
                  <p className="text-xs text-gray-500">{group.description}</p>
                </div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={group.enabled}
                    onChange={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        groups: prev.groups.map((entry) =>
                          entry.id === group.id
                            ? { ...entry, enabled: !entry.enabled }
                            : entry,
                        ),
                      }))
                    }
                  />
                  Enabled
                </label>
              </div>
              <textarea
                className="mt-3 h-28 w-full rounded-lg border border-borderMuted bg-panel px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
                value={group.patternsText}
                onChange={(event) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    groups: prev.groups.map((entry) =>
                      entry.id === group.id
                        ? { ...entry, patternsText: event.target.value }
                        : entry,
                    ),
                  }))
                }
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-gray-500">
                Filtered: {ignoredCounts[group.id] ?? 0}
              </p>
            </div>
          ))}
          <div className="rounded-xl border border-borderMuted/60 bg-panelMuted/30 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-100">
                  Custom regex filters
                </p>
                <p className="text-xs text-gray-500">
                  One per line. Prefix with method: or status: to match those
                  fields.
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Filtered: {ignoredCounts.custom ?? 0}
              </p>
            </div>
            <textarea
              className="mt-3 h-24 w-full rounded-lg border border-borderMuted bg-panel px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
              value={settings.customRegexText}
              onChange={(event) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  customRegexText: event.target.value,
                }))
              }
              spellCheck={false}
              placeholder="play.google.com"
            />
          </div>
          {removedEvents.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4">
              <p className="text-sm font-semibold text-amber-200">
                Removed events
              </p>
              <p className="text-xs text-amber-100/80">
                These events were manually removed from the timeline. Restore
                them to bring them back into the diagram.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-amber-50">
                {removedEvents.map((event) => (
                  <li
                    key={
                      event.jrInternalId
                        ?? `${event.kind}-${event.id ?? event.ts ?? 'missing'}`
                    }
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex-1 break-words">
                      {formatRemovedEvent(event)}
                    </span>
                    {event.jrInternalId && (
                      <button
                        type="button"
                        onClick={() => onRestoreEvent(event.jrInternalId!)}
                        className="rounded-md border border-amber-300/60 px-2 py-1 text-xs text-amber-50 transition hover:bg-amber-500/20"
                      >
                        Restore
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex h-full flex-col gap-3 min-w-0">
          <div className="rounded-xl border border-borderMuted/70 bg-panel/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-100">JSON preview</p>
              <span className="text-xs text-gray-500">{visibleEvents} events</span>
            </div>
            <pre className="mt-3 max-h-[65vh] w-full overflow-auto rounded-lg bg-black/30 p-3 text-[12px] leading-relaxed text-gray-200 font-mono">
              {jsonText}
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}

export default TraceSettingsPanel


