import { memo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react'
import type { TraceEvent } from '../types/trace'

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

export interface TimelineProps {
  clicks: TimelineMarker[]
  requests: TimelineMarker[]
  timeRangeMs: number | null
  playbackPercent?: number | null
  onMarkerClick?: (marker: TimelineMarker) => void
  onNavigatePrevious?: () => void
  onNavigateNext?: () => void
  disablePrevious?: boolean
  disableNext?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
}

const Track = ({
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
      <div className={`relative border border-borderMuted bg-panelMuted/80 ${isPinned ? 'h-6 px-2 rounded-none' : 'h-16 px-3 py-3 rounded-lg'}`}>
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
                className={`${isPinned ? 'h-4 w-[2px]' : 'h-10 w-[3px]'} cursor-pointer rounded-full transition group-hover:brightness-150 ${colorClass} ${
                  event.timestamp != null && onMarkerClick ? 'hover:scale-110' : ''
                }`}
                title={event.label}
                onClick={() => {
                  if (onMarkerClick) {
                    onMarkerClick(event)
                  }
                }}
              />
              <div className={`pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-pre-line rounded-md border border-borderMuted bg-panel px-2 py-1 text-[11px] text-gray-200 shadow-lg group-hover:block ${
                isPinned ? 'bottom-8' : 'bottom-12'
              }`}>
                {event.details}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const TimelineSection = memo(
  ({
    clicks,
    requests,
    timeRangeMs,
    playbackPercent,
    onMarkerClick,
    onNavigatePrevious,
    onNavigateNext,
    disablePrevious,
    disableNext,
    isPinned = false,
    onTogglePin,
  }: TimelineProps) => {
  const summary =
    timeRangeMs && timeRangeMs > 0
      ? `${(timeRangeMs / 1000).toFixed(2)}s window`
      : 'Load a trace file to populate the timeline'

  const timelineContent = (
    <section className={`panel flex w-full flex-col ${isPinned ? 'fixed bottom-0 left-0 right-0 z-[9999] w-screen border-t border-borderMuted bg-panel shadow-2xl' : 'relative gap-4 p-5'}`}>
      {!isPinned && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span className="font-medium text-gray-200">Journey Timeline</span>
          <div className="flex items-center gap-3">
            <span>{summary}</span>
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-borderMuted bg-panelMuted text-gray-200 transition hover:bg-panel hover:text-white"
                aria-label="Pin timeline to bottom"
                title="Pin timeline to bottom"
              >
                <Pin size={16} />
              </button>
            )}
            <div className="flex overflow-hidden rounded-xl border border-borderMuted bg-panelMuted/70">
              <button
                type="button"
                onClick={onNavigatePrevious}
                disabled={disablePrevious}
                className="flex h-8 w-9 items-center justify-center text-gray-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous event"
                title="Previous event"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={disableNext}
                className="flex h-8 w-9 items-center justify-center text-gray-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next event"
                title="Next event"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      {isPinned ? (
        <div className="flex items-start gap-1.5">
          <div className="relative flex flex-1 flex-col gap-1">
            {typeof playbackPercent === 'number' && (
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{ left: `${clampPercent(playbackPercent)}%` }}
              >
                <div className="h-full w-[1px] -translate-x-1/2 bg-red-400 shadow-[0_0_4px_rgba(255,0,0,0.5)]" />
              </div>
            )}
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
          <div className="flex w-[62px] flex-col items-stretch gap-1.5">
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                className="flex h-6 items-center justify-center rounded border border-borderMuted bg-panelMuted/50 text-gray-400 transition hover:bg-panelMuted hover:text-gray-200"
                aria-label="Unpin timeline"
                title="Unpin timeline"
              >
                <PinOff size={12} />
              </button>
            )}
            <div className="flex overflow-hidden rounded-xl border border-borderMuted bg-panelMuted/70">
              <button
                type="button"
                onClick={onNavigatePrevious}
                disabled={disablePrevious}
                className="flex h-6 w-7 items-center justify-center text-gray-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous event"
                title="Previous event"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={disableNext}
                className="flex h-6 w-7 items-center justify-center text-gray-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next event"
                title="Next event"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          {typeof playbackPercent === 'number' && (
            <div className="pointer-events-none absolute left-3 right-3 -top-1 -bottom-1 z-10">
              <div className="relative h-full w-full">
                <div
                  className="absolute h-full w-px -translate-x-1/2 bg-red-400 shadow-[0_0_4px_rgba(255,0,0,0.5)]"
                  style={{ left: `${clampPercent(playbackPercent)}%` }}
                />
              </div>
            </div>
          )}
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
      )}
    </section>
  )

  if (isPinned && typeof document !== 'undefined') {
    return createPortal(timelineContent, document.body)
  }

  return timelineContent
  },
)

TimelineSection.displayName = 'TimelineSection'

export default TimelineSection

