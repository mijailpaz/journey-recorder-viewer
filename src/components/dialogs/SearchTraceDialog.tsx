import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Globe, MousePointerClick, Search, X } from 'lucide-react'
import type { TimelineMarker } from '../../types/timeline'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { formatTimestamp } from '../../utils/formatters'

type SearchTraceDialogProps = {
  clicks: TimelineMarker[]
  requests: TimelineMarker[]
  onSelectMarker: (marker: TimelineMarker) => void
  onClose: () => void
}

type HostStats = {
  host: string
  markers: TimelineMarker[]
}

const extractHost = (marker: TimelineMarker): string => {
  const event = marker.event
  if (!event) return ''

  if (event.host) {
    return event.host
  }

  const urlString = event.url || event.targetUrl || ''
  if (!urlString) return ''

  try {
    const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`)
    return url.host
  } catch {
    return urlString.split('/')[0] || ''
  }
}

const getInteractionLabel = (marker: TimelineMarker): string => {
  const event = marker.event
  if (!event) return marker.label || 'Unknown'

  if (event.kind === 'click') {
    return event.text || event.label || event.selector || 'Click'
  }
  if (event.kind === 'navigation') {
    const host = event.host || 'Unknown'
    return `${host} (${event.transitionType || 'navigate'})`
  }
  if (event.kind === 'spa-navigation') {
    const host = event.host || 'Unknown'
    return `${host} (${event.navigationType || 'navigate'})`
  }
  return marker.label || 'Event'
}

const getInteractionTypeLabel = (marker: TimelineMarker): string => {
  const event = marker.event
  if (!event) return 'Event'

  switch (event.kind) {
    case 'click':
      return 'Click'
    case 'navigation':
      return 'Navigation'
    case 'spa-navigation':
      return 'SPA Nav'
    default:
      return 'Event'
  }
}

export const SearchTraceDialog = ({
  clicks,
  requests,
  onSelectMarker,
  onClose,
}: SearchTraceDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isInteractionsExpanded, setIsInteractionsExpanded] = useState(true)
  const [isHostsExpanded, setIsHostsExpanded] = useState(true)

  useEscapeKey(onClose)

  const normalizedSearch = searchTerm.toLowerCase().trim()

  // Filter interactions based on search
  const filteredInteractions = useMemo(() => {
    if (!normalizedSearch) return clicks

    return clicks.filter((marker) => {
      const label = getInteractionLabel(marker).toLowerCase()
      const event = marker.event
      const text = event?.text?.toLowerCase() || ''
      const selector = event?.selector?.toLowerCase() || ''
      const host = event?.host?.toLowerCase() || ''
      const url = event?.url?.toLowerCase() || ''

      return (
        label.includes(normalizedSearch) ||
        text.includes(normalizedSearch) ||
        selector.includes(normalizedSearch) ||
        host.includes(normalizedSearch) ||
        url.includes(normalizedSearch)
      )
    })
  }, [clicks, normalizedSearch])

  // Aggregate hosts with counts and filter based on search
  const hostStats = useMemo(() => {
    const hostMap = new Map<string, HostStats>()

    requests.forEach((marker) => {
      const host = extractHost(marker)
      if (!host) return

      const existing = hostMap.get(host)
      if (existing) {
        existing.markers.push(marker)
      } else {
        hostMap.set(host, { host, markers: [marker] })
      }
    })

    let stats = Array.from(hostMap.values()).sort((a, b) => b.markers.length - a.markers.length)

    if (normalizedSearch) {
      stats = stats.filter((s) => {
        // Check if host matches
        if (s.host.toLowerCase().includes(normalizedSearch)) {
          return true
        }
        // Check if any marker's URL/path matches
        return s.markers.some((m) => {
          const evt = m.event
          const url = evt?.url?.toLowerCase() || ''
          const path = evt?.path?.toLowerCase() || ''
          const targetUrl = evt?.targetUrl?.toLowerCase() || ''
          const targetPath = evt?.targetPath?.toLowerCase() || ''
          return (
            url.includes(normalizedSearch) ||
            path.includes(normalizedSearch) ||
            targetUrl.includes(normalizedSearch) ||
            targetPath.includes(normalizedSearch)
          )
        })
      })
    }

    return stats
  }, [requests, normalizedSearch])

  const handleSelect = (marker: TimelineMarker) => {
    onSelectMarker(marker)
    onClose()
  }

  // Helper to check if a marker matches the search
  const markerMatchesSearch = (m: TimelineMarker): boolean => {
    const evt = m.event
    const url = evt?.url?.toLowerCase() || ''
    const path = evt?.path?.toLowerCase() || ''
    const targetUrl = evt?.targetUrl?.toLowerCase() || ''
    const targetPath = evt?.targetPath?.toLowerCase() || ''
    return (
      url.includes(normalizedSearch) ||
      path.includes(normalizedSearch) ||
      targetUrl.includes(normalizedSearch) ||
      targetPath.includes(normalizedSearch)
    )
  }

  // Get the marker to navigate to (first matching when searching, otherwise first)
  const getTargetMarker = (stat: HostStats): TimelineMarker => {
    if (!normalizedSearch) return stat.markers[0]
    // If host itself matches, return first marker
    if (stat.host.toLowerCase().includes(normalizedSearch)) return stat.markers[0]
    // Otherwise find the first marker that matches
    return stat.markers.find(markerMatchesSearch) || stat.markers[0]
  }

  // Get display info for the subtitle
  const getHostSubtitle = (stat: HostStats): string => {
    if (!normalizedSearch) {
      return `First of ${stat.markers.length} request${stat.markers.length !== 1 ? 's' : ''}`
    }
    // If host matches, show count
    if (stat.host.toLowerCase().includes(normalizedSearch)) {
      return `${stat.markers.length} request${stat.markers.length !== 1 ? 's' : ''}`
    }
    // Count how many markers match the search
    const matchCount = stat.markers.filter(markerMatchesSearch).length
    const targetMarker = stat.markers.find(markerMatchesSearch)
    const path = targetMarker?.event?.path || targetMarker?.event?.url || ''
    // Show truncated path
    const displayPath = path.length > 50 ? `...${path.slice(-47)}` : path
    if (matchCount > 1) {
      return `${displayPath} (+${matchCount - 1} more)`
    }
    return displayPath
  }

  const dialogContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex w-full max-w-4xl flex-col rounded-2xl border border-borderMuted bg-panel shadow-2xl max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderMuted px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">Search Events</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-panelMuted hover:text-gray-200"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 py-4 border-b border-borderMuted">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-borderMuted bg-panelMuted pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-accent focus:outline-none"
              placeholder="Search by label, host, selector..."
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Interactions Group */}
          <div>
            <button
              type="button"
              onClick={() => setIsInteractionsExpanded(!isInteractionsExpanded)}
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-gray-200 hover:text-white transition"
            >
              {isInteractionsExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <MousePointerClick size={14} className="text-accent" />
              <span>Interactions</span>
              <span className="ml-auto text-xs text-gray-500">
                {filteredInteractions.length} event{filteredInteractions.length !== 1 ? 's' : ''}
              </span>
            </button>

            {isInteractionsExpanded && (
              <div className="mt-2 space-y-1">
                {filteredInteractions.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2 pl-6">No matching interactions</p>
                ) : (
                  filteredInteractions.map((marker) => (
                    <button
                      key={marker.id}
                      type="button"
                      onClick={() => handleSelect(marker)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-panelMuted group"
                    >
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: marker.color || '#f5d742' }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-gray-200 truncate group-hover:text-white">
                          {getInteractionLabel(marker)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {getInteractionTypeLabel(marker)}
                        </span>
                      </span>
                      {marker.timestamp && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatTimestamp(marker.timestamp)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Hosts Group */}
          <div>
            <button
              type="button"
              onClick={() => setIsHostsExpanded(!isHostsExpanded)}
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-gray-200 hover:text-white transition"
            >
              {isHostsExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <Globe size={14} className="text-accentBlue" />
              <span>Request Hosts</span>
              <span className="ml-auto text-xs text-gray-500">
                {hostStats.length} host{hostStats.length !== 1 ? 's' : ''}
              </span>
            </button>

            {isHostsExpanded && (
              <div className="mt-2 space-y-1">
                {hostStats.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2 pl-6">No matching hosts</p>
                ) : (
                  hostStats.map((stat) => {
                    const targetMarker = getTargetMarker(stat)
                    return (
                      <button
                        key={stat.host}
                        type="button"
                        onClick={() => handleSelect(targetMarker)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-panelMuted group"
                      >
                        <span className="h-2 w-2 rounded-full bg-accentBlue flex-shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-gray-200 truncate group-hover:text-white">
                            {stat.host}
                          </span>
                          <span className="block text-xs text-gray-500 truncate">
                            {getHostSubtitle(stat)}
                          </span>
                        </span>
                        {targetMarker.timestamp && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTimestamp(targetMarker.timestamp)}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="border-t border-borderMuted px-6 py-3">
          <p className="text-xs text-gray-500">
            Click an item to navigate to it on the timeline
          </p>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body)
  }

  return dialogContent
}
