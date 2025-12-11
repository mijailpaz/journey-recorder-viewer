import { memo, useCallback } from 'react'
import { FileJson } from 'lucide-react'
import type { TraceEvent } from '../../types/trace'
import type { TimelineMarker } from '../../types/timeline'
import { computeWaterfallData, formatWaterfallDuration } from '../../utils/waterfall'
import { downloadPostmanCollection } from '../../utils/postmanExporter'

type RequestWaterfallProps = {
  interactionTs: number | undefined
  requests: TraceEvent[]
  allMarkers?: TimelineMarker[]
  onNavigateToMarker?: (marker: TimelineMarker) => void
  collectionName?: string
}

const WaterfallLegend = () => (
  <div className="flex items-center gap-4 text-[10px] text-gray-500">
    <div className="flex items-center gap-1">
      <div className="w-3 h-2 rounded-sm bg-amber-500/70" />
      <span>Blocked</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-2 rounded-sm bg-blue-500/70" />
      <span>Waiting (TTFB)</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-2 rounded-sm bg-emerald-500/70" />
      <span>Receiving</span>
    </div>
  </div>
)

const TimeMarkers = ({ totalMs }: { totalMs: number }) => {
  // Generate time markers at 0%, 25%, 50%, 75%, 100%
  const markers = [0, 0.25, 0.5, 0.75, 1]
  
  return (
    <div className="relative h-4 border-b border-borderMuted mb-2">
      {markers.map((pct) => (
        <div
          key={pct}
          className="absolute top-0 bottom-0 flex flex-col items-center"
          style={{ left: `${pct * 100}%` }}
        >
          <div className="h-2 w-px bg-gray-600" />
          <span className="text-[9px] text-gray-500 -translate-x-1/2">
            {formatWaterfallDuration(totalMs * pct)}
          </span>
        </div>
      ))}
    </div>
  )
}

export const RequestWaterfall = memo(({ interactionTs, requests, allMarkers, onNavigateToMarker, collectionName }: RequestWaterfallProps) => {
  const data = computeWaterfallData(interactionTs, requests)

  // Find the marker and index for a request
  const findMarkerForRequest = useCallback((request: TraceEvent): { marker: TimelineMarker | null; index: number } => {
    if (!allMarkers) return { marker: null, index: -1 }
    
    const index = allMarkers.findIndex((m) => {
      const event = m.event
      if (!event) return false
      // Match by jrInternalId first, then by id
      if (request.jrInternalId && event.jrInternalId) {
        return request.jrInternalId === event.jrInternalId
      }
      return request.id !== undefined && event.id === request.id
    })
    
    return { marker: index >= 0 ? allMarkers[index] : null, index }
  }, [allMarkers])

  const handleRowClick = useCallback((request: TraceEvent) => {
    if (!onNavigateToMarker) return
    const { marker } = findMarkerForRequest(request)
    if (marker) {
      onNavigateToMarker(marker)
    }
  }, [findMarkerForRequest, onNavigateToMarker])

  if (!data || data.bars.length === 0) {
    return null
  }

  const isClickable = !!onNavigateToMarker && !!allMarkers

  return (
    <div className="rounded-lg border border-borderMuted bg-panel/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500">
          Request Waterfall
        </h4>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => downloadPostmanCollection(requests, collectionName)}
            className="flex items-center gap-1.5 text-[10px] text-orange-300 hover:text-orange-200 transition-colors"
            title="Export these requests as a Postman collection"
          >
            <FileJson size={12} />
            <span>Export to Postman</span>
          </button>
          <WaterfallLegend />
        </div>
      </div>

      <TimeMarkers totalMs={data.totalDurationMs} />

      <div className="space-y-1.5">
        {data.bars.map((bar, index) => {
          const { index: markerIndex } = findMarkerForRequest(bar.request)
          const eventNumber = markerIndex >= 0 ? markerIndex + 1 : null

          return (
            <div
              key={bar.request.id ?? index}
              className={`relative flex items-center gap-2 group ${isClickable ? 'cursor-pointer hover:bg-gray-700/30 rounded -mx-1 px-1' : ''}`}
              onClick={isClickable ? () => handleRowClick(bar.request) : undefined}
            >
              {/* Method & Status */}
              <div className="w-16 flex-shrink-0 text-right">
                <span
                  className={`text-[10px] font-medium ${
                    bar.isFailed ? 'text-red-400' : 'text-gray-400'
                  }`}
                >
                  {bar.method}
                </span>
                {bar.status && (
                  <span
                    className={`ml-1 text-[10px] ${
                      bar.isFailed
                        ? 'text-red-400'
                        : bar.status >= 200 && bar.status < 300
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {bar.status}
                  </span>
                )}
              </div>

              {/* Waterfall bar container */}
              <div className="flex-1 relative h-5 bg-gray-800/50 rounded overflow-hidden">
                {/* The actual waterfall bar */}
                <div
                  className="absolute top-0.5 bottom-0.5 flex rounded-sm overflow-hidden"
                  style={{
                    left: `${bar.startPercent}%`,
                    width: `${Math.max(bar.totalPercent, 0.5)}%`,
                  }}
                >
                  {/* Blocked phase */}
                  {bar.blockedPercent > 0 && (
                    <div
                      className="h-full bg-amber-500/70"
                      style={{ width: `${(bar.blockedPercent / bar.totalPercent) * 100}%` }}
                    />
                  )}
                  {/* Waiting phase */}
                  {bar.waitingPercent > 0 && (
                    <div
                      className="h-full bg-blue-500/70"
                      style={{ width: `${(bar.waitingPercent / bar.totalPercent) * 100}%` }}
                    />
                  )}
                  {/* Receiving phase */}
                  {bar.receivingPercent > 0 && (
                    <div
                      className="h-full bg-emerald-500/70"
                      style={{ width: `${(bar.receivingPercent / bar.totalPercent) * 100}%` }}
                    />
                  )}
                </div>

                {/* Slow indicator */}
                {bar.isSlowRequest && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <span className="text-[8px] text-orange-400 font-medium">SLOW</span>
                  </div>
                )}
              </div>

              {/* Duration */}
              <div className="w-14 flex-shrink-0 text-right">
                <span
                  className={`text-[10px] font-medium ${
                    bar.isSlowRequest ? 'text-orange-400' : 'text-gray-400'
                  }`}
                >
                  {formatWaterfallDuration(bar.durationMs)}
                </span>
              </div>

              {/* Hover tooltip with full path and timing breakdown */}
              <div className="pointer-events-none absolute left-16 bottom-full mb-1 hidden max-w-lg rounded-lg border border-borderMuted bg-panel px-4 py-3 text-sm shadow-lg group-hover:block z-50">
                <div className="flex items-start gap-2 mb-2">
                  {eventNumber && (
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border border-blue-400/50 bg-blue-500/20 text-[10px] font-medium text-blue-300">
                      {eventNumber}
                    </span>
                  )}
                  <div className="font-medium text-gray-100 break-all">
                    <span className={bar.isFailed ? 'text-red-400' : 'text-blue-400'}>{bar.method}</span>{' '}
                    {bar.request.path ?? bar.request.url}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                  {bar.blockedPercent > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/70" />
                      <span className="text-gray-400">Blocked:</span>
                      <span className="text-amber-300 font-medium">{formatWaterfallDuration(bar.blockedPercent * data.totalDurationMs / 100)}</span>
                    </div>
                  )}
                  {bar.waitingPercent > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/70" />
                      <span className="text-gray-400">Waiting:</span>
                      <span className="text-blue-300 font-medium">{formatWaterfallDuration(bar.waitingPercent * data.totalDurationMs / 100)}</span>
                    </div>
                  )}
                  {bar.receivingPercent > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" />
                      <span className="text-gray-400">Receiving:</span>
                      <span className="text-emerald-300 font-medium">{formatWaterfallDuration(bar.receivingPercent * data.totalDurationMs / 100)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">Total:</span>
                    <span className={bar.isSlowRequest ? 'text-orange-300 font-semibold' : 'text-gray-200 font-medium'}>{formatWaterfallDuration(bar.durationMs)}</span>
                  </div>
                </div>
                {isClickable && (
                  <div className="mt-2 pt-2 border-t border-borderMuted text-[10px] text-gray-500">
                    Click to view request details
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

RequestWaterfall.displayName = 'RequestWaterfall'

