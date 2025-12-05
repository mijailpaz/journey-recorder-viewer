import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Focus,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import type { TraceCapturedBody, TraceEvent, TraceNetworkTimings } from '../types/trace'

export type TimelineMarker = {
  id: string
  position: number
  label: string
  details: string
  timestamp: number | null
  traceId?: string | number
  color?: string
  from?: string
  to?: string
  event?: TraceEvent
  relatedRequests?: TraceEvent[]
  triggeredBy?: TraceEvent | null
}

type EventOverride = {
  label?: string
  removed?: boolean
}

type JourneyEventEditorProps = {
  getOverrideForEvent: (event: TraceEvent | null | undefined) => EventOverride | undefined
  updateLabel: (event: TraceEvent, nextLabel: string) => void
  toggleRemoval: (event: TraceEvent, removed: boolean) => void
  reset: (event: TraceEvent) => void
  getOriginalEvent: (event: TraceEvent) => TraceEvent | null
}

export type JourneyPanelProps = {
  marker: TimelineMarker | null
  clicks: TimelineMarker[]
  requests: TimelineMarker[]
  timeRangeMs: number | null
  playbackPercent?: number | null
  onMarkerClick?: (marker: TimelineMarker) => void
  onNavigatePrevious: () => void
  onNavigateNext: () => void
  disablePrevious: boolean
  disableNext: boolean
  isPinned: boolean
  onTogglePin: () => void
  isAutoZoomEnabled?: boolean
  onToggleAutoZoom?: () => void
  eventEditor?: JourneyEventEditorProps
  onPinnedHeightChange?: (height: number) => void
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const formatTimestamp = (ts: number | null | undefined) => {
  if (!ts) {
    return '—'
  }
  const date = new Date(ts)
  const month = date.toLocaleString(undefined, { month: 'short' })
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${month} ${day} · ${hours}:${minutes}:${seconds}`
}

const formatMs = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }
  return `${value.toFixed(2)} ms`
}

const getStatusChipClass = (status?: number | null) => {
  if (typeof status !== 'number') {
    return ''
  }
  if (status >= 200 && status < 300) {
    return 'bg-emerald-500/10 text-emerald-200'
  }
  if (status >= 400) {
    return 'bg-rose-500/10 text-rose-200'
  }
  return 'bg-amber-500/10 text-amber-200'
}

const Track = memo(({
  title,
  colorClass,
  events,
  emptyLabel,
  onMarkerClick,
  isPinned = false,
}: {
  title: string
  colorClass: string
  events: TimelineMarker[]
  emptyLabel: string
  onMarkerClick?: (marker: TimelineMarker) => void
  isPinned?: boolean
}) => {
  return (
    <div className={isPinned ? '' : 'space-y-1'}>
      {!isPinned && (
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
      )}
      <div className={`relative border border-borderMuted bg-panelMuted/80 ${isPinned ? 'h-5 px-2 rounded' : 'h-12 px-3 py-3 rounded-lg'}`}>
        {events.length === 0 && !isPinned && (
          <p className="text-xs text-gray-500">{emptyLabel}</p>
        )}
        <div className={isPinned ? 'absolute inset-0.5' : 'absolute inset-3'}>
          {events.map((event) => (
            <div
              key={event.id}
              className="group absolute bottom-0 -ml-[1px]"
              style={{ left: `${event.position}%` }}
            >
              <div
                className={`${isPinned ? 'h-3 w-[2px]' : 'h-6 w-[3px]'} cursor-pointer rounded-full transition group-hover:brightness-150 ${colorClass} ${
                  event.timestamp != null && onMarkerClick ? 'hover:scale-110' : ''
                }`}
                title={event.label}
                onClick={() => {
                  if (onMarkerClick) {
                    onMarkerClick(event)
                  }
                }}
              />
              <div className={`pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-pre-line rounded-md border border-borderMuted bg-panel px-2 py-1 text-[11px] text-gray-200 shadow-lg group-hover:block z-50 ${
                isPinned ? 'bottom-6' : 'bottom-8'
              }`}>
                {event.details}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

Track.displayName = 'Track'

const DetailChip = ({
  children,
  color,
  className = '',
}: {
  children: ReactNode
  color?: string
  className?: string
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel px-2.5 py-0.5 text-[11px] font-medium text-gray-100 ${className}`}
    style={color ? { color, borderColor: color + '4d', backgroundColor: color + '1a' } : undefined}
  >
    {children}
  </span>
)

const JourneyPanel = memo(({
  marker,
  clicks,
  requests,
  timeRangeMs,
  playbackPercent,
  onMarkerClick,
  onNavigatePrevious,
  onNavigateNext,
  disablePrevious,
  disableNext,
  isPinned,
  onTogglePin,
  isAutoZoomEnabled = false,
  onToggleAutoZoom,
  eventEditor,
  onPinnedHeightChange,
}: JourneyPanelProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const event = marker?.event
  const editorOverride = eventEditor && event ? eventEditor.getOverrideForEvent(event) : undefined
  const originalEvent = eventEditor && event ? eventEditor.getOriginalEvent(event) : null
  const isRemoved = editorOverride?.removed ?? false

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const node = panelRef.current
    if (!node) {
      return
    }
    const updateHeight = () => {
      const height = node.getBoundingClientRect().height
      setMeasuredHeight(height)
      if (onPinnedHeightChange) {
        onPinnedHeightChange(height)
      }
    }
    updateHeight()
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateHeight()
      })
      observer.observe(node)
    } else {
      window.addEventListener('resize', updateHeight)
    }
    return () => {
      if (observer) {
        observer.disconnect()
      } else {
        window.removeEventListener('resize', updateHeight)
      }
    }
  }, [isPinned, onPinnedHeightChange])

  const handleRemoveClick = () => {
    if (!eventEditor || !event) return
    if (!isRemoved) {
      const confirmed = window.confirm('Remove this event from the timeline and diagram?')
      if (!confirmed) {
        return
      }
      eventEditor.toggleRemoval(event, true)
    } else {
      eventEditor.toggleRemoval(event, false)
    }
  }

  const handleEditClick = () => {
    setIsEditDialogOpen(true)
  }

  const summary =
    timeRangeMs && timeRangeMs > 0
      ? `${(timeRangeMs / 1000).toFixed(2)}s`
      : null

  const typeLabel =
    event?.kind === 'click'
      ? 'Click'
      : event?.kind === 'request'
        ? `Request · ${event.method ?? 'GET'}`
        : 'Event'

  const iconSize = 14
  const baseButtonClass = 'flex h-7 w-7 items-center justify-center rounded-lg border border-borderMuted bg-panelMuted/70 text-gray-300 transition hover:bg-panel hover:text-white'
  const navButtonClass = 'flex h-7 w-8 items-center justify-center text-gray-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40'

  const content = (
    <>
      <div
        ref={panelRef}
        className={`rounded-2xl border border-borderMuted bg-panelMuted/90 ${isPinned ? 'fixed left-0 right-0 z-[10000] w-screen border-t shadow-2xl px-4 py-3' : 'px-4 py-4'}`}
        style={isPinned ? { bottom: 0 } : undefined}
      >
        {/* Header row with current item info and controls */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Journey</p>
              {marker?.timestamp && (
                <p className="text-xs uppercase tracking-[0.2em] text-purple-400">
                  {formatTimestamp(marker.timestamp)}
                </p>
              )}
              {summary && (
                <p className="text-xs text-gray-500">{summary} window</p>
              )}
            </div>
            <p className="text-base font-semibold text-gray-50 truncate">
              {marker?.label ?? 'Select a timeline item to inspect'}
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTogglePin}
              className={baseButtonClass}
              aria-label={isPinned ? 'Unpin Journey Panel' : 'Pin Journey Panel to bottom'}
              title={isPinned ? 'Unpin Journey Panel' : 'Pin Journey Panel to bottom'}
            >
              {isPinned ? <PinOff size={iconSize} /> : <Pin size={iconSize} />}
            </button>
            {onToggleAutoZoom && (
              <button
                type="button"
                onClick={onToggleAutoZoom}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition hover:bg-panel hover:text-white ${
                  isAutoZoomEnabled 
                    ? 'border-blue-400/70 bg-blue-500/20 text-blue-300' 
                    : 'border-borderMuted bg-panelMuted/70 text-gray-300'
                }`}
                aria-label={isAutoZoomEnabled ? 'Disable auto-zoom on diagram' : 'Enable auto-zoom on diagram'}
                title={isAutoZoomEnabled ? 'Auto-zoom enabled' : 'Auto-zoom disabled'}
                aria-pressed={isAutoZoomEnabled}
              >
                <Focus size={iconSize} />
              </button>
            )}
            <div className="flex overflow-hidden rounded-xl border border-borderMuted bg-panelMuted/70">
              <button
                type="button"
                onClick={onNavigatePrevious}
                disabled={disablePrevious}
                className={navButtonClass}
                aria-label="Previous event"
                title="Previous event"
              >
                <ChevronLeft size={iconSize} />
              </button>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={disableNext}
                className={navButtonClass}
                aria-label="Next event"
                title="Next event"
              >
                <ChevronRight size={iconSize} />
              </button>
            </div>
            {marker && (
              <button
                type="button"
                onClick={() => setIsDetailsDialogOpen(true)}
                className={baseButtonClass}
                aria-label="View event details"
                title="View details"
              >
                <Eye size={iconSize} />
              </button>
            )}
            {eventEditor && event && (
              <>
                <button
                  type="button"
                  onClick={handleEditClick}
                  className={baseButtonClass}
                  aria-label="Edit event"
                  title="Edit event"
                >
                  <Edit2 size={iconSize} />
                </button>
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                    isRemoved
                      ? 'border-amber-300/70 text-amber-200 hover:bg-amber-500/10'
                      : 'border-red-400/60 text-red-200 hover:bg-red-500/10'
                  }`}
                  aria-label={isRemoved ? 'Restore event' : 'Remove event'}
                  title={isRemoved ? 'Restore event' : 'Remove event'}
                >
                  {isRemoved ? <RotateCcw size={iconSize} /> : <Trash2 size={iconSize} />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Metadata chips row */}
        {marker && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <DetailChip color={marker.color}>
              {typeLabel}
            </DetailChip>
            {marker.from && marker.to && (
              <DetailChip>
                {marker.from} <ArrowRight size={12} className="mx-1 inline text-gray-500" /> {marker.to}
              </DetailChip>
            )}
            {event?.type && event.kind === 'request' && (
              <DetailChip>Type: {event.type}</DetailChip>
            )}
            {(event?.protocol || event?.nextHopProtocol) && event?.kind === 'request' && (
              <DetailChip>{`Protocol: ${event.nextHopProtocol ?? event.protocol}`}</DetailChip>
            )}
            {typeof event?.duration === 'number' && event?.kind === 'request' && (
              <DetailChip>{`Duration: ${formatMs(event.duration)}`}</DetailChip>
            )}
            {typeof event?.status === 'number' && event?.kind === 'request' && (
              <DetailChip className={getStatusChipClass(event.status)}>{`Status: ${event.status}`}</DetailChip>
            )}
          </div>
        )}

        {/* Timeline tracks */}
        <div className="relative">
          {typeof playbackPercent === 'number' && (
            <div className="pointer-events-none absolute left-2 right-2 -top-1 -bottom-1 z-10">
              <div className="relative h-full w-full">
                <div
                  className="absolute h-full w-px -translate-x-1/2 bg-red-400 shadow-[0_0_4px_rgba(255,0,0,0.5)]"
                  style={{ left: `${clampPercent(playbackPercent)}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Track
                title="Click Events"
                colorClass="bg-accent"
                events={clicks}
                emptyLabel="Awaiting click events"
                onMarkerClick={onMarkerClick}
                isPinned={isPinned}
              />
              <Track
                title="Network Requests"
                colorClass="bg-accentBlue"
                events={requests}
                emptyLabel="Awaiting network requests"
                onMarkerClick={onMarkerClick}
                isPinned={isPinned}
              />
            </div>
          </div>
        </div>
      </div>

      {isEditDialogOpen && eventEditor && event && (
        <EventEditDialog
          event={event}
          override={editorOverride}
          originalLabel={originalEvent?.label ?? ''}
          onChangeLabel={(value) => eventEditor.updateLabel(event, value)}
          onReset={() => eventEditor.reset(event)}
          onClose={() => setIsEditDialogOpen(false)}
        />
      )}

      {isDetailsDialogOpen && marker && (
        <EventDetailsDialog
          marker={marker}
          onClose={() => setIsDetailsDialogOpen(false)}
        />
      )}
    </>
  )

  if (isPinned && typeof document !== 'undefined') {
    const placeholderHeight = measuredHeight || 140
    return (
      <>
        <div aria-hidden="true" style={{ height: placeholderHeight, width: '100%' }} />
        {createPortal(content, document.body)}
      </>
    )
  }

  return content
})

JourneyPanel.displayName = 'JourneyPanel'

export default JourneyPanel

// Event Edit Dialog Component
type EventEditDialogProps = {
  event: TraceEvent
  override?: EventOverride
  originalLabel: string
  onChangeLabel: (value: string) => void
  onReset: () => void
  onClose: () => void
}

const EventEditDialog = ({
  event,
  override,
  originalLabel,
  onChangeLabel,
  onReset,
  onClose,
}: EventEditDialogProps) => {
  const value = override?.label ?? event.label ?? event.text ?? ''
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

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
            <span className="text-xs text-gray-500">
              Original: {originalLabel || '—'}
            </span>
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

// Event Details Dialog Component
type EventDetailsDialogProps = {
  marker: TimelineMarker
  onClose: () => void
}

const EventDetailsDialog = ({ marker, onClose }: EventDetailsDialogProps) => {
  const event = marker.event

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const dialogContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-8xl max-h-[90vh] overflow-hidden rounded-2xl border border-borderMuted bg-panel shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-borderMuted px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Event Details</h2>
            <p className="text-sm text-gray-400 mt-0.5">{marker.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-panelMuted hover:text-gray-200"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-auto flex-1">
          {event?.kind === 'click' && (
            <ClickDetailsContent event={event} related={marker.relatedRequests ?? []} />
          )}
          {event?.kind === 'request' && (
            <RequestDetailsContent event={event} triggeredBy={marker.triggeredBy} />
          )}
          {!event && (
            <DetailCard title="Details">
              {marker.details
                ? marker.details.split('\n').map((line, index) => <p key={index}>{line}</p>)
                : 'No additional details.'}
            </DetailCard>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body)
  }

  return dialogContent
}

// Detail Card Component
const DetailCard = ({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) => (
  <div
    className={`min-w-0 overflow-hidden rounded-2xl border border-borderMuted bg-panelMuted px-4 py-3 ${className}`}
  >
    <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gray-500">{title}</p>
    <div className="min-w-0">{children}</div>
  </div>
)

// Detail List Component
const DetailList = ({
  entries,
}: {
  entries: Array<[string, ReactNode]>
}) => (
  <dl className="space-y-1 text-sm text-gray-300">
    {entries.map(([label, value]) => (
      <div key={label} className="flex items-start justify-between gap-4">
        <dt className="flex-shrink-0 text-gray-500">{label}</dt>
        <dd className="min-w-0 break-words text-right text-gray-100">{value ?? '—'}</dd>
      </div>
    ))}
  </dl>
)

// Click Details Content
const ClickDetailsContent = ({
  event,
  related,
}: {
  event: TraceEvent
  related: TraceEvent[]
}) => {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <DetailCard title="Interaction">
        <DetailList
          entries={[
            ['Label', event.label ?? '—'],
            ['Selector', event.selector ?? '—'],
            ['Path', event.path ?? '—'],
            ['Query', event.qs ?? '—'],
            ['Timestamp', formatTimestamp(event.ts)],
            ['ID', event.id != null ? String(event.id) : '—'],
          ]}
        />
      </DetailCard>
      <DetailCard title="Requests Triggered">
        {related.length === 0 ? (
          <p className="text-sm text-gray-400">No matching requests captured for this click.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-300">
            <DetailChip>
              {related.length} matching request{related.length > 1 ? 's' : ''}
            </DetailChip>
            <ol className="list-inside list-decimal space-y-1">
              {related.map((req) => (
                <li key={`related-${req.id ?? req.ts}`} className="break-words">
                  <span className="font-medium text-gray-100">{req.method ?? 'GET'}</span>{' '}
                  <span className="text-gray-400">{req.path ?? req.url}</span>
                  {typeof req.status === 'number' && (
                    <span className="text-gray-500"> · {req.status}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </DetailCard>
    </div>
  )
}

// Request Details Content
const RequestDetailsContent = ({
  event,
  triggeredBy,
}: {
  event: TraceEvent
  triggeredBy?: TraceEvent | null
}) => {
  const requestUrlEntries: Array<[string, ReactNode]> = [
    ['URL', event.url ?? '—'],
    ['Host', event.host ?? '—'],
    ['Path', event.path ?? '—'],
    ['Query', event.qs ?? '—'],
    ['Target URL', event.targetUrl ?? '—'],
    ['Target host', event.targetHost ?? '—'],
    ['Target path', event.targetPath ?? '—'],
    ['Content type', event.contentType ?? '—'],
    ['Initiator', event.initiator ?? event.targetUrl ?? '—'],
    ['Frame ID', event.frameId ?? '—'],
    ['Tab ID', event.tabId ?? '—'],
    ['Request ID', event.requestId ?? event.id ?? '—'],
  ]

  const statusEntries: Array<[string, ReactNode]> = [
    ['Method', event.method ?? '—'],
    [
      'Triggered by',
      triggeredBy
        ? `${triggeredBy.kind} #${triggeredBy.id ?? ''} (${triggeredBy.label ?? triggeredBy.text ?? ''})`
        : 'Unknown',
    ],
    ['Timestamp', formatTimestamp(event.ts)],
    ['Protocol', event.protocol ?? event.nextHopProtocol ?? '—'],
    ['Type', event.type ?? 'request'],
  ]

  const performanceEntries: Array<[string, ReactNode]> = [
    ['Start time', formatMs(event.startTime)],
    ['Duration', formatMs(event.duration)],
    ['Response start', formatMs(event.responseStart)],
    ['Response end', formatMs(event.responseEnd)],
    ['Transfer size', formatBytes(event.transferSize)],
    ['Body (encoded)', formatBytes(event.encodedBodySize)],
    ['Body (decoded)', formatBytes(event.decodedBodySize)],
    ['Network type', event.type ?? '—'],
    ['Next hop', event.nextHopProtocol ?? '—'],
  ]

  const showPerformanceCard = performanceEntries.some(([, value]) => value !== '—')
  const timingEntries = buildTimingEntries(event.timings)
  const showTimings = timingEntries.length > 0
  const curlCommand = generateCurlCommand(event)

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <DetailCard title="Request URL">
        <DetailList entries={requestUrlEntries} />
      </DetailCard>
      <DetailCard title="Status">
        <div className="space-y-2 text-sm text-gray-300">
          <DetailChip className={getStatusChipClass(event.status)}>
            {event.status ?? '—'} {event.statusText ? `· ${event.statusText}` : ''}
          </DetailChip>
          <DetailList entries={statusEntries} />
        </div>
      </DetailCard>
      {showPerformanceCard && (
        <DetailCard title="Performance">
          <DetailList entries={performanceEntries} />
        </DetailCard>
      )}
      {showTimings && (
        <DetailCard title="Network Timings">
          <DetailList entries={timingEntries} />
        </DetailCard>
      )}
      {curlCommand && (
        <DetailCard title="cURL Command" className="md:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Copy this command to replay the request</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(curlCommand)
                }}
                className="text-xs text-blue-400 transition hover:text-blue-300 hover:underline"
              >
                Copy
              </button>
            </div>
            <textarea
              readOnly
              value={curlCommand}
              className="w-full resize-none rounded-lg border border-borderMuted bg-black/30 p-3 font-mono text-xs leading-relaxed text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              rows={Math.min(Math.max(curlCommand.split('\n').length, 3), 15)}
              onClick={(e) => {
                e.currentTarget.select()
              }}
            />
          </div>
        </DetailCard>
      )}
      <BodyCard title="Request Body" body={event.requestBody} />
      <BodyCard title="Response Body" body={event.responseBody} />
    </div>
  )
}

// Helper functions
const formatBytes = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`
  }
  return `${value.toLocaleString()} bytes`
}

const TIMING_ORDER: Array<keyof TraceNetworkTimings> = [
  'blocked',
  'dns',
  'connect',
  'ssl',
  'send',
  'wait',
  'receive',
  '_blocked_queueing',
  '_workerStart',
  '_workerReady',
  '_workerFetchStart',
  '_workerRespondWithSettled',
]

const TIMING_LABELS: Record<keyof TraceNetworkTimings, string> = {
  blocked: 'Blocked',
  dns: 'DNS',
  connect: 'Connect',
  ssl: 'SSL',
  send: 'Send',
  wait: 'Wait / TTFB',
  receive: 'Receive',
  _blocked_queueing: 'Queueing',
  _workerStart: 'Worker start',
  _workerReady: 'Worker ready',
  _workerFetchStart: 'Worker fetch',
  _workerRespondWithSettled: 'Worker respond',
}

const buildTimingEntries = (timings?: TraceNetworkTimings): Array<[string, ReactNode]> => {
  if (!timings) {
    return []
  }
  return TIMING_ORDER.reduce<Array<[string, ReactNode]>>((entries, key) => {
    const value = timings[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      entries.push([TIMING_LABELS[key] ?? key, formatMs(value)])
    }
    return entries
  }, [])
}

const generateCurlCommand = (event: TraceEvent): string | null => {
  if (!event.url || !event.method) {
    return null
  }

  const parts: string[] = []
  parts.push('curl')
  parts.push('-v')

  const method = event.method.toUpperCase()
  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }

  let fullUrl = event.url
  if (event.qs && event.qs !== 'null') {
    const qs = event.qs.startsWith('?') ? event.qs.slice(1) : event.qs
    fullUrl = fullUrl.includes('?') ? `${fullUrl}&${qs}` : `${fullUrl}?${qs}`
  }

  parts.push(`'${fullUrl.replace(/'/g, "'\\''")}'`)

  const headers: string[] = []

  if (event.requestBody) {
    const mimeType = event.requestBody.mimeType || event.contentType || 'application/json'
    headers.push(`'Content-Type: ${mimeType}'`)
  } else if (event.contentType) {
    headers.push(`'Content-Type: ${event.contentType}'`)
  }

  if (event.contentType?.includes('json') || event.responseBody?.mimeType?.includes('json')) {
    headers.push("'Accept: application/json'")
  }

  headers.push(
    "'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'",
  )

  if (headers.length > 0) {
    headers.forEach((header) => {
      parts.push(`-H ${header}`)
    })
  }

  if (event.requestBody) {
    const bodyContent = decodeBodyContent(event.requestBody)
    if (bodyContent) {
      let formattedBody = bodyContent.trim()
      if (formattedBody.startsWith('{') || formattedBody.startsWith('[')) {
        try {
          const parsed = JSON.parse(formattedBody)
          formattedBody = JSON.stringify(parsed)
        } catch {
          // If parsing fails, use original
        }
      }
      const escapedBody = formattedBody.replace(/'/g, "'\\''")
      parts.push(`-d '${escapedBody}'`)
    }
  }

  return parts.join(' \\\n  ')
}

const decodeBodyContent = (body?: TraceCapturedBody | null): string | null => {
  if (!body) {
    return null
  }
  const raw = body.text ?? body.content
  if (raw == null || typeof raw !== 'string') {
    return null
  }
  if (body.encoding?.toLowerCase() === 'base64') {
    try {
      if (typeof atob === 'function') {
        return atob(raw)
      }
    } catch {
      return raw
    }
  }
  return raw
}

const formatBodyPreview = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return 'Body captured but empty.'
  }
  const firstChar = trimmed[0]
  if (firstChar === '{' || firstChar === '[') {
    try {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // ignore malformed JSON, show raw payload instead
    }
  }
  return raw
}

const BodyCard = ({ title, body }: { title: string; body?: TraceCapturedBody | null }) => {
  const decoded = decodeBodyContent(body)
  if (decoded == null) {
    return null
  }
  const formatted = formatBodyPreview(decoded)
  const metaEntries: Array<[string, ReactNode]> = []
  if (body?.mimeType) {
    metaEntries.push(['MIME Type', body.mimeType])
  }
  if (body?.encoding) {
    metaEntries.push(['Encoding', body.encoding])
  }
  metaEntries.push(['Length', `${decoded.length.toLocaleString()} chars`])

  return (
    <DetailCard title={title} className="md:col-span-2">
      <div className="space-y-3 text-sm text-gray-300">
        <DetailList entries={metaEntries} />
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-3 font-mono text-xs leading-relaxed text-gray-100">
          {formatted}
        </pre>
      </div>
    </DetailCard>
  )
}
