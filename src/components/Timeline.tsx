import { memo } from 'react'

export type TimelineMarker = {
  id: string
  position: number
  label: string
  details: string
  timestamp: number | null
  traceId?: string | number
  color?: string
}

export interface TimelineProps {
  clicks: TimelineMarker[]
  requests: TimelineMarker[]
  timeRangeMs: number | null
  playbackPercent?: number | null
  onMarkerClick?: (timestamp: number, marker?: TimelineMarker) => void
}

const Track = ({
  title,
  colorClass,
  events,
  emptyLabel,
  onMarkerClick,
}: {
  title: string
  colorClass: string
  events: TimelineMarker[]
  emptyLabel: string
  onMarkerClick?: (timestamp: number, marker?: TimelineMarker) => void
}) => {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
      <div className="relative h-16 rounded-lg border border-borderMuted bg-panelMuted/80 px-3 py-3">
        {events.length === 0 && (
          <p className="text-xs text-gray-500">{emptyLabel}</p>
        )}
        <div className="absolute inset-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="group absolute bottom-0 -ml-[1px]"
              style={{ left: `${event.position}%` }}
            >
              <div
                className={`h-10 w-[3px] cursor-pointer rounded-full transition group-hover:brightness-150 ${colorClass} ${
                  event.timestamp != null && onMarkerClick ? 'hover:scale-110' : ''
                }`}
                title={event.label}
                onClick={() => {
                  if (event.timestamp != null && onMarkerClick) {
                    onMarkerClick(event.timestamp, event)
                  }
                }}
              />
              <div className="pointer-events-none absolute bottom-12 left-1/2 hidden -translate-x-1/2 whitespace-pre-line rounded-md border border-borderMuted bg-panel px-2 py-1 text-[11px] text-gray-200 shadow-lg group-hover:block">
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

const TimelineSection = memo(({ clicks, requests, timeRangeMs, playbackPercent, onMarkerClick }: TimelineProps) => {
  const summary =
    timeRangeMs && timeRangeMs > 0
      ? `${(timeRangeMs / 1000).toFixed(2)}s window`
      : 'Load a trace file to populate the timeline'

  return (
    <section className="panel relative flex w-full flex-col gap-4 p-5">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span className="font-medium text-gray-200">Journey Timeline</span>
        <span>{summary}</span>
      </div>
      <div className="relative">
        {typeof playbackPercent === 'number' && (
          <div
            className="pointer-events-none absolute -top-1 -bottom-1 z-10"
            style={{ left: `${clampPercent(playbackPercent)}%` }}
          >
            <div className="h-full w-px -translate-x-1/2 bg-red-400 shadow-[0_0_4px_rgba(255,0,0,0.5)]" />
          </div>
        )}
        <Track
          title="Click Events"
          colorClass="bg-accent"
          events={clicks}
          emptyLabel="Awaiting click events"
          onMarkerClick={onMarkerClick}
        />
        <Track
          title="Network Requests"
          colorClass="bg-accentBlue"
          events={requests}
          emptyLabel="Awaiting network requests"
          onMarkerClick={onMarkerClick}
        />
      </div>
    </section>
  )
})

TimelineSection.displayName = 'TimelineSection'

export default TimelineSection

