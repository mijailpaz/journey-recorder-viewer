import type { TraceEvent } from './trace'

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

export type EventOverride = {
  label?: string
  removed?: boolean
}

export type FilterGroupOption = {
  id: string
  label: string
  description: string
}

export type JourneyEventEditorProps = {
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
  allMarkers?: TimelineMarker[]
  activeMarkerIndex?: number
  filterGroups?: FilterGroupOption[]
  onAddFilter?: (domain: string, groupId: string) => number
  onSearchClick?: () => void
  isLoading?: boolean
}
