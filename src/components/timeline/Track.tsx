import { memo } from 'react'
import type { TimelineMarker } from '../../types/timeline'

type TrackProps = {
  title: string
  colorClass: string
  events: TimelineMarker[]
  emptyLabel: string
  onMarkerClick?: (marker: TimelineMarker) => void
  isPinned?: boolean
}

export const Track = memo(
  ({ title, colorClass, events, emptyLabel, onMarkerClick, isPinned = false }: TrackProps) => {
    return (
      <div className={isPinned ? '' : 'space-y-1'}>
        {!isPinned && (
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
        )}
        <div
          className={`relative border border-borderMuted bg-panelMuted/80 ${isPinned ? 'h-5 px-2 rounded' : 'h-12 px-3 py-3 rounded-lg'}`}
        >
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
                <div
                  className={`pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-pre-line rounded-md border border-borderMuted bg-panel px-2 py-1 text-[11px] text-gray-200 shadow-lg group-hover:block z-50 ${
                    isPinned ? 'bottom-6' : 'bottom-8'
                  }`}
                >
                  {event.details}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
)

Track.displayName = 'Track'
