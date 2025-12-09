import { memo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Filter,
  Focus,
  Globe,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
} from 'lucide-react'

// Types
import type {
  FilterGroupOption,
  JourneyEventEditorProps,
  JourneyPanelProps,
  TimelineMarker,
} from '../types/timeline'

// Hooks
import { usePanelHeight } from '../hooks/usePanelHeight'

// Utils
import { clampPercent, formatMs, formatTimestamp, getStatusChipClass } from '../utils/formatters'

// Components
import { Track } from './timeline/Track'
import { DetailChip, EventNumberBadge } from './shared'
import { EventEditDialog } from './dialogs/EventEditDialog'
import { EventDetailsDialog } from './dialogs/EventDetailsDialog'
import { AddFilterDialog } from './dialogs/AddFilterDialog'

// Re-export types for consumers
export type { TimelineMarker, FilterGroupOption, JourneyEventEditorProps, JourneyPanelProps }

const JourneyPanel = memo(
  ({
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
    allMarkers,
    activeMarkerIndex,
    filterGroups,
    onAddFilter,
  }: JourneyPanelProps) => {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
    const panelRef = useRef<HTMLDivElement | null>(null)

    const measuredHeight = usePanelHeight(panelRef, isPinned ? onPinnedHeightChange : undefined)

    const event = marker?.event
    const editorOverride = eventEditor && event ? eventEditor.getOverrideForEvent(event) : undefined
    const originalEvent = eventEditor && event ? eventEditor.getOriginalEvent(event) : null
    const isRemoved = editorOverride?.removed ?? false

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
      timeRangeMs && timeRangeMs > 0 ? `${(timeRangeMs / 1000).toFixed(2)}s` : null

    const getTypeLabel = () => {
      if (!event) return 'Event'
      switch (event.kind) {
        case 'click':
          return 'Click'
        case 'request':
          return `Request · ${event.method ?? 'GET'}`
        case 'navigation':
          return `Navigation · ${event.transitionType ?? 'navigate'}`
        case 'spa-navigation':
          return `SPA Navigation · ${event.navigationType ?? 'navigate'}`
        default:
          return 'Event'
      }
    }
    const typeLabel = getTypeLabel()

    const iconSize = 14
    const baseButtonClass =
      'flex h-7 w-7 items-center justify-center rounded-lg border border-borderMuted bg-panelMuted/70 text-gray-300 transition hover:bg-panel hover:text-white'
    const navButtonClass =
      'flex h-7 w-8 items-center justify-center text-gray-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40'

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
                {summary && <p className="text-xs text-gray-500">{summary} window</p>}
              </div>
              {!marker && (
                <p className="text-base font-semibold text-gray-50 truncate">
                  Select a timeline item to inspect
                </p>
              )}
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
                  aria-label={
                    isAutoZoomEnabled
                      ? 'Disable auto-zoom on diagram'
                      : 'Enable auto-zoom on diagram'
                  }
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
                  {onAddFilter && filterGroups && (
                    <button
                      type="button"
                      onClick={() => setIsFilterDialogOpen(true)}
                      className={`${baseButtonClass} ${event.kind !== 'request' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      aria-label={
                        event.kind === 'request'
                          ? 'Add domain to filter'
                          : 'Filtering only available for requests'
                      }
                      title={
                        event.kind === 'request'
                          ? 'Add domain to filter'
                          : 'Filtering only available for requests'
                      }
                      disabled={event.kind !== 'request'}
                    >
                      <Filter size={iconSize} />
                    </button>
                  )}
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
              {typeof activeMarkerIndex === 'number' && (
                <EventNumberBadge number={activeMarkerIndex + 1} />
              )}
              <DetailChip color={marker.color}>{typeLabel}</DetailChip>
              {marker.from && marker.to && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel px-2.5 py-0.5 text-sm font-medium text-gray-100">
                    <Globe size={12} />
                    {marker.from}
                  </span>
                  <ArrowRight size={12} className="text-gray-500" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-sm font-medium text-blue-300">
                    {marker.label}
                  </span>
                  <ArrowRight size={12} className="text-gray-500" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel px-2.5 py-0.5 text-sm font-medium text-gray-100">
                    <Globe size={12} />
                    {marker.to}
                  </span>
                </>
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
                <DetailChip
                  className={getStatusChipClass(event.status)}
                >{`Status: ${event.status}`}</DetailChip>
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
                  title="Interactions"
                  colorClass="bg-accent"
                  events={clicks}
                  emptyLabel="Awaiting interactions"
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
            allMarkers={allMarkers}
            activeMarkerIndex={activeMarkerIndex}
            onNavigateToMarker={onMarkerClick}
          />
        )}

        {isFilterDialogOpen && event?.kind === 'request' && onAddFilter && filterGroups && (
          <AddFilterDialog
            event={event}
            filterGroups={filterGroups}
            onAddFilter={(domain, groupId) => {
              onAddFilter(domain, groupId)
              setIsFilterDialogOpen(false)
            }}
            onClose={() => setIsFilterDialogOpen(false)}
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
  }
)

JourneyPanel.displayName = 'JourneyPanel'

export default JourneyPanel
