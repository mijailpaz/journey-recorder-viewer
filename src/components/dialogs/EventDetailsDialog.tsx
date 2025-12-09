import { createPortal } from 'react-dom'
import { ArrowRight, ChevronDown, ChevronUp, Globe, User, X } from 'lucide-react'
import type { TimelineMarker } from '../../types/timeline'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { DetailCard } from '../shared/DetailCard'
import { EventNumberBadge } from '../shared/EventNumberBadge'
import { FlowBadge } from '../shared/FlowBadge'
import { ClickDetailsContent } from '../details/ClickDetailsContent'
import { RequestDetailsContent } from '../details/RequestDetailsContent'

type EventDetailsDialogProps = {
  marker: TimelineMarker
  onClose: () => void
  allMarkers?: TimelineMarker[]
  activeMarkerIndex?: number
  onNavigateToMarker?: (marker: TimelineMarker) => void
}

// Helper to compute flow data for any marker
// Uses marker.from and marker.to which are pre-computed in App.tsx with correct host tracking
const getFlowDataForMarker = (targetMarker: TimelineMarker) => {
  const event = targetMarker.event
  if (!event) return null

  const isClick = event.kind === 'click'
  const message = isClick
    ? event.label || event.text || event.selector || 'element'
    : event.path || targetMarker.label

  return {
    origin: targetMarker.from || null,
    message,
    destination: targetMarker.to || null,
    isClick,
  }
}

export const EventDetailsDialog = ({
  marker,
  onClose,
  allMarkers,
  activeMarkerIndex,
  onNavigateToMarker,
}: EventDetailsDialogProps) => {
  const event = marker.event

  useEscapeKey(onClose)

  // Compute flow data for current, previous, and next markers
  const flowData = getFlowDataForMarker(marker)

  const previousMarker =
    allMarkers && typeof activeMarkerIndex === 'number' && activeMarkerIndex > 0
      ? allMarkers[activeMarkerIndex - 1]
      : null
  const nextMarker =
    allMarkers &&
    typeof activeMarkerIndex === 'number' &&
    activeMarkerIndex < allMarkers.length - 1
      ? allMarkers[activeMarkerIndex + 1]
      : null

  const previousFlowData = previousMarker ? getFlowDataForMarker(previousMarker) : null
  const nextFlowData = nextMarker ? getFlowDataForMarker(nextMarker) : null

  const dialogContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-8xl max-h-[90vh] overflow-hidden rounded-2xl border border-borderMuted bg-panel shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-borderMuted px-6 py-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-100">Event Details</h2>

            {/* Previous Event Navigation */}
            {previousMarker &&
              previousFlowData &&
              onNavigateToMarker &&
              typeof activeMarkerIndex === 'number' && (
                <button
                  type="button"
                  onClick={() => onNavigateToMarker(previousMarker)}
                  className="group flex items-center gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronUp size={14} className="text-gray-500 group-hover:text-gray-300" />
                  <EventNumberBadge number={activeMarkerIndex} size="sm" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {previousFlowData.origin && (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel/50 px-2 py-0.5 font-medium text-gray-400">
                          {previousFlowData.isClick ? <User size={10} /> : <Globe size={10} />}
                          {previousFlowData.origin}
                        </span>
                        <ArrowRight size={12} className="text-gray-600" />
                      </>
                    )}
                    <span className="text-gray-500 font-mono truncate max-w-[200px]">
                      {previousFlowData.message}
                    </span>
                    {previousFlowData.destination && (
                      <>
                        <ArrowRight size={12} className="text-gray-600" />
                        <span className="inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel/50 px-2 py-0.5 font-medium text-gray-400">
                          <Globe size={10} />
                          {previousFlowData.destination}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              )}

            {/* Current Event */}
            {flowData ? (
              <FlowBadge
                origin={flowData.origin}
                message={flowData.message}
                destination={flowData.destination}
                isClick={flowData.isClick}
                eventNumber={typeof activeMarkerIndex === 'number' ? activeMarkerIndex + 1 : undefined}
              />
            ) : (
              <p className="text-sm text-gray-400 mt-0.5">{marker.label}</p>
            )}

            {/* Next Event Navigation */}
            {nextMarker &&
              nextFlowData &&
              onNavigateToMarker &&
              typeof activeMarkerIndex === 'number' && (
                <button
                  type="button"
                  onClick={() => onNavigateToMarker(nextMarker)}
                  className="group flex items-center gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronDown size={14} className="text-gray-500 group-hover:text-gray-300" />
                  <EventNumberBadge number={activeMarkerIndex + 2} size="sm" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {nextFlowData.origin && (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel/50 px-2 py-0.5 font-medium text-gray-400">
                          {nextFlowData.isClick ? <User size={10} /> : <Globe size={10} />}
                          {nextFlowData.origin}
                        </span>
                        <ArrowRight size={12} className="text-gray-600" />
                      </>
                    )}
                    <span className="text-gray-500 font-mono truncate max-w-[200px]">
                      {nextFlowData.message}
                    </span>
                    {nextFlowData.destination && (
                      <>
                        <ArrowRight size={12} className="text-gray-600" />
                        <span className="inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel/50 px-2 py-0.5 font-medium text-gray-400">
                          <Globe size={10} />
                          {nextFlowData.destination}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-panelMuted hover:text-gray-200 flex-shrink-0 self-start"
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
