import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileText,
  Pin,
  PinOff,
  RotateCcw,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import DiagramPanel from './components/DiagramPanel'
import FileInputs from './components/FileInputs'
import FooterBar from './components/FooterBar'
import HeaderBar from './components/HeaderBar'
import TimelineSection, { type TimelineMarker } from './components/Timeline'
import TraceSettingsPanel from './components/TraceSettingsPanel'
import VideoPanel from './components/VideoPanel'
import type { TraceCapturedBody, TraceEvent, TraceFile, TraceNetworkTimings } from './types/trace'
import generateMermaidFromTrace from './utils/mermaid'
import {
  applyTraceFilters,
  createDefaultFilterSettings,
  type TraceFilterSettings,
} from './utils/traceFilters'

type LoadedVideo = {
  url: string
  name: string
}

type EventOverride = {
  label?: string
  removed?: boolean
}

type EventOverrideMap = Record<string, EventOverride>

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const generateInternalId = (seed: number) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `jr-${Date.now()}-${seed}-${Math.random().toString(36).slice(2)}`
}

const ensureInternalIds = (trace: TraceFile): TraceFile => {
  const eventsWithIds = (trace.events ?? []).map((event, index) =>
    event.jrInternalId ? event : { ...event, jrInternalId: generateInternalId(index) },
  )
  return { ...trace, events: eventsWithIds }
}

const buildDetails = (event: TraceEvent) => {
  const details: string[] = []
  if (event.label || event.text) {
    details.push(event.label ?? event.text ?? '')
  }
  if (event.selector) {
    details.push(`Selector: ${event.selector}`)
  }
  if (event.method || event.path) {
    details.push(`${event.method ?? ''} ${event.path ?? ''}`.trim())
  } else if (event.path) {
    details.push(event.path)
  }
  if (typeof event.status === 'number') {
    details.push(`Status: ${event.status}`)
  }
  if (event.ts) {
    details.push(`ts: ${event.ts}`)
  }
  return details.filter(Boolean).join('\n')
}

const deriveParticipants = (event: TraceEvent) => {
  if (event.kind === 'click') {
    return { from: 'User', to: 'WebApp' }
  }
  if (event.kind === 'request') {
    return { from: 'WebApp', to: extractEndpointName(event) }
  }
  return { from: 'System', to: 'System' }
}

const extractEndpointName = (event: TraceEvent) => {
  const candidate = event.targetUrl ?? event.url ?? event.path ?? event.label ?? ''
  if (!candidate) {
    return 'Service'
  }

  try {
    const url = candidate.startsWith('http') ? new URL(candidate) : new URL(`https://${candidate}`)
    return url.host
  } catch {
    return candidate.replace(/^https?:\/\//, '').split('/')[0] || 'Service'
  }
}

const getEventKey = (event: TraceEvent, index: number) => {
  const raw = event.id ?? `${event.kind}-${index}`
  return String(raw)
}

const getEventInternalId = (event: TraceEvent, fallback: string) =>
  event.jrInternalId ?? fallback

const applyEventOverridesToEvents = (events: TraceEvent[], overrides: EventOverrideMap) => {
  if (!events.length) {
    return []
  }
  return events.reduce<TraceEvent[]>((acc, event) => {
    const internalId = event.jrInternalId
    if (internalId) {
      const override = overrides[internalId]
      if (override) {
        if (override.removed) {
          return acc
        }
        if (override.label != null && override.label !== event.label) {
          acc.push({ ...event, label: override.label })
          return acc
        }
      }
    }
    acc.push(event)
    return acc
  }, [])
}

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

type TimelineComputation = {
  clicks: TimelineMarker[]
  requests: TimelineMarker[]
  timeRangeMs: number | null
  startTs: number | null
  endTs: number | null
}

const computeTimeline = (
  trace: TraceFile | null,
  videoAnchorMs: number | null,
  videoDurationMs: number | null,
): TimelineComputation => {
  const events = trace?.events ?? []
  const timestamps = events
    .map((event) => event.ts)
    .filter((ts): ts is number => typeof ts === 'number')

  if (timestamps.length === 0 && videoAnchorMs == null && videoDurationMs == null) {
    return { clicks: [], requests: [], timeRangeMs: null, startTs: null, endTs: null }
  }

  const minEventTs = timestamps.length > 0 ? Math.min(...timestamps) : videoAnchorMs ?? 0
  const baseStart =
    typeof videoAnchorMs === 'number' ? Math.min(videoAnchorMs, minEventTs) : minEventTs
  const startTs = Number.isFinite(baseStart) ? baseStart : 0

  const maxEventTs = timestamps.length > 0 ? Math.max(...timestamps) : startTs
  const videoEndTs =
    typeof videoAnchorMs === 'number' && typeof videoDurationMs === 'number'
      ? videoAnchorMs + videoDurationMs
      : null
  const endTs = Math.max(maxEventTs, videoEndTs ?? maxEventTs, startTs + 1)
  const range = endTs - startTs

  const relatedRequestsByEventId = new Map<string, TraceEvent[]>()
  const requestTriggerMap = new Map<string, TraceEvent | null>()

  let lastClick: TraceEvent | null = null
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    const key = getEventInternalId(event, getEventKey(event, i))
    if (event.kind === 'click') {
      lastClick = event
      const related: TraceEvent[] = []
      for (let j = i + 1; j < events.length; j += 1) {
        const candidate = events[j]
        if (candidate.kind === 'click') {
          break
        }
        if (candidate.kind === 'request') {
          related.push(candidate)
        }
      }
      relatedRequestsByEventId.set(key, related)
    } else if (event.kind === 'request') {
      requestTriggerMap.set(key, lastClick)
    }
  }

  const toMarker = (event: TraceEvent, index: number): TimelineMarker => {
    const ts = typeof event.ts === 'number' ? event.ts : startTs
    const position = clampPercent(((ts - startTs) / range) * 100)
    const label = event.label ?? event.text ?? event.path ?? event.method ?? event.kind
    const color = event.kind === 'click' ? '#f5d742' : '#4aa3ff'
    const participants = deriveParticipants(event)
    const eventKey = getEventInternalId(event, getEventKey(event, index))
    const markerId = getEventInternalId(event, `${event.kind}-${event.id ?? index}`)
    return {
      id: markerId,
      position,
      label,
      details: buildDetails(event),
      timestamp: typeof event.ts === 'number' ? event.ts : null,
      traceId: event.id,
      color,
      from: participants.from,
      to: participants.to,
      event,
      relatedRequests: relatedRequestsByEventId.get(eventKey) ?? [],
      triggeredBy: requestTriggerMap.get(eventKey) ?? null,
    }
  }

  const clicks = events.filter((event) => event.kind === 'click').map(toMarker)
  const requests = events.filter((event) => event.kind === 'request').map(toMarker)

  return {
    clicks,
    requests,
    timeRangeMs: range,
    startTs,
    endTs,
  }
}

function App() {
  const [video, setVideo] = useState<LoadedVideo | null>(null)
  const [loadedTraceFile, setLoadedTraceFile] = useState<TraceFile | null>(null)
  const [fileNames, setFileNames] = useState<{ video?: string; trace?: string }>({})
  const [fileError, setFileError] = useState<string | null>(null)
  const [videoProgressMs, setVideoProgressMs] = useState<number | null>(null)
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null)
  const [activeTraceId, setActiveTraceId] = useState<string | number | null>(null)
  const [activeTraceColor, setActiveTraceColor] = useState<string | null>(null)
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null)
  const [activeMarker, setActiveMarker] = useState<TimelineMarker | null>(null)
  const [fileInputsCollapsed, setFileInputsCollapsed] = useState(false)
  const [isTimelinePinned, setIsTimelinePinned] = useState(false)
  const [isCurrentJourneyItemPinned, setIsCurrentJourneyItemPinned] = useState(false)
  const [eventOverrides, setEventOverrides] = useState<EventOverrideMap>({})
  const [filterSettings, setFilterSettings] = useState<TraceFilterSettings>(createDefaultFilterSettings())
  const videoRef = useRef<HTMLVideoElement>(null)
  const autoCollapsedRef = useRef(false)

  const manualEvents = useMemo(
    () => applyEventOverridesToEvents(loadedTraceFile?.events ?? [], eventOverrides),
    [loadedTraceFile, eventOverrides],
  )

  const filterResult = useMemo(
    () => applyTraceFilters(manualEvents, filterSettings),
    [manualEvents, filterSettings],
  )

  const filteredTrace: TraceFile | null = useMemo(() => {
    if (!loadedTraceFile) {
      return null
    }
    const clonedEvents = filterResult.filteredEvents.map((event) => ({ ...event }))
    return { ...loadedTraceFile, events: clonedEvents }
  }, [loadedTraceFile, filterResult.filteredEvents])

  const videoAnchorTs = filteredTrace?.videoStartedAt ?? null

  const timeline = useMemo(
    () => computeTimeline(filteredTrace, videoAnchorTs, videoDurationMs),
    [filteredTrace, videoAnchorTs, videoDurationMs],
  )

  const handleVideoSelect = useCallback((file: File | null) => {
    if (!file) {
      return
    }
    const nextUrl = URL.createObjectURL(file)
    setVideo((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url)
      }
      return { url: nextUrl, name: file.name }
    })
    setFileNames((prev) => ({ ...prev, video: file.name }))
    setVideoProgressMs(0)
    setVideoDurationMs(null)
  }, [])

  useEffect(() => {
    const currentUrl = video?.url
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [video])

  const handleTraceSelect = useCallback(async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const content = await file.text()
      const parsed = JSON.parse(content) as TraceFile
      const normalized = ensureInternalIds(parsed)
      setLoadedTraceFile(normalized)
      setFileNames((prev) => ({ ...prev, trace: file.name }))
      setFileError(null)
      setEventOverrides({})
      setFilterSettings(createDefaultFilterSettings())
      setActiveMarker(null)
      setActiveMarkerId(null)
      setActiveTraceId(null)
      setActiveTraceColor(null)
    } catch (error) {
      setLoadedTraceFile(null)
      setEventOverrides({})
      setFileError('Unable to parse the trace JSON file.')
      console.error('Trace parse error', error)
    }
  }, [])

  const handleDownloadFilteredTrace = useCallback(() => {
    if (!filteredTrace) {
      return
    }
    const blob = new Blob([JSON.stringify(filteredTrace, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const baseName = fileNames.trace ? fileNames.trace.replace(/\.json$/i, '') : 'trace'
    link.href = url
    link.download = `${baseName}-filtered.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredTrace, fileNames.trace])

  const generatedDiagram = useMemo(() => {
    const events = filteredTrace?.events ?? null
    if (!events) {
      return ''
    }
    return generateMermaidFromTrace(events)
  }, [filteredTrace])

  const resolvedDiagram = generatedDiagram
  const diagramDisplayName =
    filteredTrace && resolvedDiagram.trim() ? 'Generated from trace JSON' : undefined

  const status = useMemo(() => {
    if (fileError) {
      return fileError
    }
    if (video && loadedTraceFile) {
      return 'Files loaded – ready to replay'
    }
    if (video || loadedTraceFile) {
      return 'Waiting for remaining files'
    }
    return 'Waiting for files'
  }, [fileError, loadedTraceFile, video])

  const ignoredCounts = filterResult.ignoredCounts
  const removedEvents = useMemo(() => {
    if (!loadedTraceFile?.events) {
      return []
    }
    return loadedTraceFile.events.filter(
      (event) => event.jrInternalId && eventOverrides[event.jrInternalId]?.removed,
    )
  }, [loadedTraceFile, eventOverrides])
  const manualRemovalCount = removedEvents.length
  const hasEventOverrides = useMemo(() => Object.keys(eventOverrides).length > 0, [eventOverrides])
  
  const totalFilteredCount = useMemo(() => {
    return Object.values(ignoredCounts).reduce((sum, count) => sum + (count ?? 0), 0)
  }, [ignoredCounts])
  const hasFilterChanges = useMemo(() => {
    const baseline = createDefaultFilterSettings()
    if (filterSettings.applyFilters !== baseline.applyFilters) {
      return true
    }
    if (filterSettings.customRegexText !== baseline.customRegexText) {
      return true
    }
    if (filterSettings.groups.length !== baseline.groups.length) {
      return true
    }
    for (let i = 0; i < filterSettings.groups.length; i += 1) {
      const group = filterSettings.groups[i]
      const base = baseline.groups[i]
      if (!base) {
        return true
      }
      if (
        group.id !== base.id ||
        group.enabled !== base.enabled ||
        group.patternsText !== base.patternsText
      ) {
        return true
      }
    }
    return false
  }, [filterSettings])

  const hasTraceModifications = Boolean(
    filteredTrace && (hasEventOverrides || hasFilterChanges),
  )

  const originalEventMap = useMemo(() => {
    const map = new Map<string, TraceEvent>()
    loadedTraceFile?.events?.forEach((event) => {
      if (event.jrInternalId) {
        map.set(event.jrInternalId, event)
      }
    })
    return map
  }, [loadedTraceFile])

  const labelEditCount = useMemo(() => {
    let count = 0
    Object.entries(eventOverrides).forEach(([internalId, override]) => {
      if (override.label != null && !override.removed) {
        const original = originalEventMap.get(internalId)
        const originalLabel = original?.label ?? ''
        if (override.label !== originalLabel) {
          count += 1
        }
      }
    })
    return count
  }, [eventOverrides, originalEventMap])

  const playbackPercent = useMemo(() => {
    if (
      !timeline.timeRangeMs ||
      typeof timeline.startTs !== 'number' ||
      typeof videoProgressMs !== 'number'
    ) {
      return null
    }
    const anchor = typeof videoAnchorTs === 'number' ? videoAnchorTs : timeline.startTs
    const playbackTs = anchor + videoProgressMs
    return ((playbackTs - timeline.startTs) / timeline.timeRangeMs) * 100
  }, [timeline.startTs, timeline.timeRangeMs, videoAnchorTs, videoProgressMs])

  const handleTimeUpdate = useCallback((currentTimeMs: number) => {
    setVideoProgressMs(currentTimeMs)
  }, [])

  const handleDuration = useCallback((durationMs: number) => {
    setVideoDurationMs(durationMs)
  }, [])

  const getOverrideForEvent = useCallback(
    (event: TraceEvent | null | undefined) => {
      if (!event?.jrInternalId) {
        return undefined
      }
      return eventOverrides[event.jrInternalId]
    },
    [eventOverrides],
  )

  const updateEventLabel = useCallback(
    (event: TraceEvent, nextLabel: string) => {
      const internalId = event?.jrInternalId
      if (!internalId) {
        return
      }
      setEventOverrides((prev) => {
        const originalLabel = originalEventMap.get(internalId)?.label ?? ''
        const normalized = nextLabel ?? ''
        const current = prev[internalId]
        if (normalized === originalLabel) {
          if (current?.removed) {
            if (current.label == null) {
              return prev
            }
            return { ...prev, [internalId]: { removed: true } }
          }
          if (!(internalId in prev)) {
            return prev
          }
          const { [internalId]: _omit, ...rest } = prev
          return rest
        }
        return {
          ...prev,
          [internalId]: { ...current, label: normalized },
        }
      })
    },
    [originalEventMap],
  )

  const toggleEventRemoval = useCallback(
    (event: TraceEvent, removed: boolean) => {
      const internalId = event?.jrInternalId
      if (!internalId) {
        return
      }
      setEventOverrides((prev) => {
        const current = prev[internalId]
        if (removed) {
          if (current?.removed) {
            return prev
          }
          return {
            ...prev,
            [internalId]: { ...current, removed: true },
          }
        }
        if (current?.label) {
          const originalLabel = originalEventMap.get(internalId)?.label ?? ''
          if (current.label !== originalLabel) {
            return {
              ...prev,
              [internalId]: { label: current.label },
            }
          }
        }
        if (!(internalId in prev)) {
          return prev
        }
        const { [internalId]: _omit, ...rest } = prev
        return rest
      })
    },
    [originalEventMap],
  )

  const resetEventChanges = useCallback((event: TraceEvent) => {
    const internalId = event?.jrInternalId
    if (!internalId) {
      return
    }
    setEventOverrides((prev) => {
      if (!(internalId in prev)) {
        return prev
      }
      const { [internalId]: _omit, ...rest } = prev
      return rest
    })
  }, [])

  const getOriginalEventFor = useCallback(
    (event: TraceEvent) => {
      if (!event?.jrInternalId) {
        return null
      }
      return originalEventMap.get(event.jrInternalId) ?? null
    },
    [originalEventMap],
  )

  const restoreEventByInternalId = useCallback(
    (internalId: string) => {
      setEventOverrides((prev) => {
        const current = prev[internalId]
        if (!current) {
          return prev
        }
        if (current.label) {
          const originalLabel = originalEventMap.get(internalId)?.label ?? ''
          if (current.label !== originalLabel) {
            return { ...prev, [internalId]: { label: current.label } }
          }
        }
        const { [internalId]: _omit, ...rest } = prev
        return rest
      })
    },
    [originalEventMap],
  )

  const combinedMarkers = useMemo(() => {
    return [...timeline.clicks, ...timeline.requests]
      .filter((marker) => typeof marker.timestamp === 'number')
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  }, [timeline])

  const activeMarkerIndex = useMemo(() => {
    if (!activeMarkerId) {
      return -1
    }
    return combinedMarkers.findIndex((marker) => marker.id === activeMarkerId)
  }, [combinedMarkers, activeMarkerId])

  const handleMarkerSelect = useCallback(
    (marker: TimelineMarker) => {
      if (marker.timestamp != null && videoRef.current && typeof videoAnchorTs === 'number') {
        const videoTimeSeconds = (marker.timestamp - videoAnchorTs) / 1000
        if (videoTimeSeconds >= 0 && videoTimeSeconds <= (videoDurationMs ?? Infinity) / 1000) {
          videoRef.current.currentTime = videoTimeSeconds
        }
      }
      setActiveMarkerId(marker.id)
      setActiveMarker(marker)
      if (marker.traceId != null) {
        setActiveTraceId(marker.traceId)
      } else {
        setActiveTraceId(null)
      }
      setActiveTraceColor(marker.color ?? null)
    },
    [videoAnchorTs, videoDurationMs],
  )

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (combinedMarkers.length === 0) {
        return
      }
      let targetIndex = activeMarkerIndex
      if (direction === 'next') {
        targetIndex = targetIndex < 0 ? 0 : Math.min(combinedMarkers.length - 1, targetIndex + 1)
      } else {
        if (targetIndex < 0) {
          targetIndex = combinedMarkers.length - 1
        } else {
          targetIndex = Math.max(0, targetIndex - 1)
        }
      }
      const targetMarker = combinedMarkers[targetIndex]
      if (targetMarker) {
        handleMarkerSelect(targetMarker)
      }
    },
    [combinedMarkers, activeMarkerIndex, handleMarkerSelect],
  )

  const handleResetFilters = useCallback(() => {
    setFilterSettings(createDefaultFilterSettings())
  }, [])

  const disablePrevious = combinedMarkers.length === 0 || activeMarkerIndex <= 0
  const disableNext =
    combinedMarkers.length === 0 || activeMarkerIndex === combinedMarkers.length - 1

  const allFilesLoaded = Boolean(video && loadedTraceFile)

  useEffect(() => {
    if (!allFilesLoaded) {
      setFileInputsCollapsed(false)
      autoCollapsedRef.current = false
      return
    }
    if (!autoCollapsedRef.current) {
      setFileInputsCollapsed(true)
      autoCollapsedRef.current = true
    }
  }, [allFilesLoaded])

  useEffect(() => {
    if (allFilesLoaded && combinedMarkers.length > 0 && activeMarkerIndex === -1) {
      const firstMarker = combinedMarkers[0]
      if (firstMarker) {
        handleMarkerSelect(firstMarker)
      }
    }
  }, [allFilesLoaded, combinedMarkers, activeMarkerIndex, handleMarkerSelect])

  // Update active marker when timeline changes (e.g., after label edits)
  useEffect(() => {
    if (activeMarkerId && combinedMarkers.length > 0) {
      const updatedMarker = combinedMarkers.find((marker) => marker.id === activeMarkerId)
      if (updatedMarker) {
        // Always update to reflect latest data (e.g., edited labels)
        setActiveMarker(updatedMarker)
        if (updatedMarker.traceId != null) {
          setActiveTraceId(updatedMarker.traceId)
        } else {
          setActiveTraceId(null)
        }
        setActiveTraceColor(updatedMarker.color ?? null)
      }
    }
  }, [combinedMarkers, activeMarkerId])

  const fileInputsContent = (
    <div className="flex w-full flex-col gap-5">
      <FileInputs
        onVideoSelect={handleVideoSelect}
        onTraceSelect={handleTraceSelect}
        loadedNames={{
          video: fileNames.video,
          trace: fileNames.trace,
        }}
        errorMessage={fileError}
      />
      {loadedTraceFile && (
        <TraceSettingsPanel
          rawTrace={loadedTraceFile}
          filteredTrace={filteredTrace}
          settings={filterSettings}
          ignoredCounts={ignoredCounts}
          manualRemovalCount={manualRemovalCount}
          removedEvents={removedEvents}
          onRestoreEvent={restoreEventByInternalId}
          onUpdateSettings={setFilterSettings}
          onResetFilters={handleResetFilters}
        />
      )}
    </div>
  )

  const downloadTooltipContent = useMemo(() => {
    if (!hasTraceModifications) {
      return null
    }
    const parts: string[] = []
    if (labelEditCount > 0) {
      parts.push(`${labelEditCount} label${labelEditCount > 1 ? 's' : ''} edited`)
    }
    if (manualRemovalCount > 0) {
      parts.push(`${manualRemovalCount} event${manualRemovalCount > 1 ? 's' : ''} removed`)
    }
    if (totalFilteredCount > 0) {
      parts.push(`${totalFilteredCount} event${totalFilteredCount > 1 ? 's' : ''} filtered`)
    }
    return parts.length > 0 ? parts.join(' • ') : 'Trace modified'
  }, [hasTraceModifications, labelEditCount, manualRemovalCount, totalFilteredCount])

  const headerActions = hasTraceModifications ? (
    <div className="group relative">
      <button
        type="button"
        onClick={handleDownloadFilteredTrace}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-borderMuted text-gray-200 transition hover:bg-panel hover:text-white"
        aria-label={downloadTooltipContent ?? 'Download updated trace JSON'}
      >
        <Download size={16} />
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_rgba(245,215,66,0.8)]" />
      </button>
      {downloadTooltipContent && (
        <div className="pointer-events-none absolute top-full right-0 mt-2 hidden w-64 rounded-lg border border-borderMuted bg-panel px-3 py-2 text-xs text-gray-200 shadow-lg group-hover:block z-50">
          <p className="font-semibold text-gray-100 mb-1">Download updated trace</p>
          <p className="text-gray-400">{downloadTooltipContent}</p>
          <p className="mt-2 text-gray-500">Includes all edits and filters</p>
          <div className="absolute -top-1 right-4">
            <div className="h-2 w-2 rotate-45 border-l border-t border-borderMuted bg-panel" />
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {!isCurrentJourneyItemPinned && (
        <HeaderBar actions={headerActions}>
          <FileInputsSection
            collapsed={fileInputsCollapsed}
            canToggle={allFilesLoaded}
            onToggle={() => setFileInputsCollapsed((prev) => !prev)}
            marker={activeMarker}
            status={status}
            disablePrevious={disablePrevious}
            disableNext={disableNext}
            onNavigatePrevious={() => handleNavigate('prev')}
            onNavigateNext={() => handleNavigate('next')}
            isPinned={isCurrentJourneyItemPinned}
            onTogglePin={() => setIsCurrentJourneyItemPinned(!isCurrentJourneyItemPinned)}
            eventEditor={{
              getOverrideForEvent,
              updateLabel: updateEventLabel,
              toggleRemoval: toggleEventRemoval,
              reset: resetEventChanges,
              getOriginalEvent: getOriginalEventFor,
            }}
          >
            {fileInputsContent}
          </FileInputsSection>
        </HeaderBar>
      )}

      {isCurrentJourneyItemPinned && (
        <FileInputsSection
          collapsed={fileInputsCollapsed}
          canToggle={allFilesLoaded}
          onToggle={() => setFileInputsCollapsed((prev) => !prev)}
          marker={activeMarker}
          status={status}
          disablePrevious={disablePrevious}
          disableNext={disableNext}
          onNavigatePrevious={() => handleNavigate('prev')}
          onNavigateNext={() => handleNavigate('next')}
          isPinned={isCurrentJourneyItemPinned}
          onTogglePin={() => setIsCurrentJourneyItemPinned(!isCurrentJourneyItemPinned)}
          eventEditor={{
            getOverrideForEvent,
            updateLabel: updateEventLabel,
            toggleRemoval: toggleEventRemoval,
            reset: resetEventChanges,
            getOriginalEvent: getOriginalEventFor,
          }}
        >
          {fileInputsContent}
        </FileInputsSection>
      )}

      <main className={`flex flex-1 flex-col gap-5 overflow-hidden px-6 py-6 ${isTimelinePinned ? 'pb-[60px]' : ''} ${isCurrentJourneyItemPinned ? 'pt-[120px]' : ''}`}>
        <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
          <VideoPanel
            ref={videoRef}
            src={video?.url}
            fileName={fileNames.video}
            onTimeUpdate={handleTimeUpdate}
            onDuration={handleDuration}
          />
          <DiagramPanel
            diagram={resolvedDiagram}
            fileName={diagramDisplayName}
            errorMessage={null}
            activeTraceId={activeTraceId}
            activeTraceColor={activeTraceColor}
          />
        </div>
        {!isTimelinePinned && (
          <TimelineSection
            clicks={timeline.clicks}
            requests={timeline.requests}
            timeRangeMs={timeline.timeRangeMs}
            playbackPercent={playbackPercent}
            onMarkerClick={handleMarkerSelect}
            onNavigatePrevious={() => handleNavigate('prev')}
            onNavigateNext={() => handleNavigate('next')}
            disablePrevious={disablePrevious}
            disableNext={disableNext}
            isPinned={isTimelinePinned}
            onTogglePin={() => setIsTimelinePinned(!isTimelinePinned)}
          />
        )}
      </main>

      {isTimelinePinned && (
        <TimelineSection
          clicks={timeline.clicks}
          requests={timeline.requests}
          timeRangeMs={timeline.timeRangeMs}
          playbackPercent={playbackPercent}
          onMarkerClick={handleMarkerSelect}
          onNavigatePrevious={() => handleNavigate('prev')}
          onNavigateNext={() => handleNavigate('next')}
          disablePrevious={disablePrevious}
          disableNext={disableNext}
          isPinned={isTimelinePinned}
          onTogglePin={() => setIsTimelinePinned(!isTimelinePinned)}
        />
      )}

      <FooterBar status={status} />
    </div>
  )
}

type FileInputsSectionProps = {
  collapsed: boolean
  canToggle: boolean
  onToggle: () => void
  marker: TimelineMarker | null
  status: string
  children: ReactNode
  disablePrevious: boolean
  disableNext: boolean
  onNavigatePrevious: () => void
  onNavigateNext: () => void
  isPinned: boolean
  onTogglePin: () => void
  eventEditor?: JourneyEventEditorProps
}

type JourneyEventEditorProps = {
  getOverrideForEvent: (event: TraceEvent | null | undefined) => EventOverride | undefined
  updateLabel: (event: TraceEvent, nextLabel: string) => void
  toggleRemoval: (event: TraceEvent, removed: boolean) => void
  reset: (event: TraceEvent) => void
  getOriginalEvent: (event: TraceEvent) => TraceEvent | null
}

const FileInputsSection = ({
  collapsed,
  canToggle,
  onToggle,
  marker,
  status,
  disablePrevious,
  disableNext,
  onNavigatePrevious,
  onNavigateNext,
  isPinned,
  onTogglePin,
  eventEditor,
  children,
}: FileInputsSectionProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
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

  const content = (
    <>
      <div className={`rounded-2xl border border-borderMuted bg-panelMuted/60 px-4 py-4 ${isPinned ? 'fixed top-0 left-0 right-0 z-[9998] w-screen border-b shadow-2xl' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                {collapsed ? 'Current Journey Item' : 'Load Session Files'}
              </p>
              {collapsed && marker?.timestamp && (
                <p className="text-xs uppercase tracking-[0.3em] text-purple-400">
                  {formatTimestamp(marker.timestamp)}
                </p>
              )}
            </div>
            <p className={`${collapsed ? 'text-lg font-semibold text-gray-50' : 'text-sm text-gray-300'}`}>
              {collapsed ? marker?.label ?? 'Select a timeline item to inspect' : status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {collapsed && (
              <>
                <button
                  type="button"
                  onClick={onTogglePin}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-borderMuted bg-panelMuted text-gray-200 transition hover:bg-panel hover:text-white"
                  aria-label={isPinned ? 'Unpin Current Journey Item' : 'Pin Current Journey Item to top'}
                  title={isPinned ? 'Unpin Current Journey Item' : 'Pin Current Journey Item to top'}
                >
                  {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                </button>
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
                {eventEditor && event && (
                  <>
                    <button
                      type="button"
                      onClick={handleEditClick}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-borderMuted bg-panelMuted text-gray-200 transition hover:bg-panel hover:text-white"
                      aria-label="Edit event"
                      title="Edit event"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveClick}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                        isRemoved
                          ? 'border-amber-300/70 text-amber-200 hover:bg-amber-500/10'
                          : 'border-red-400/60 text-red-200 hover:bg-red-500/10'
                      }`}
                      aria-label={isRemoved ? 'Restore event' : 'Remove event'}
                      title={isRemoved ? 'Restore event' : 'Remove event'}
                    >
                      {isRemoved ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                    </button>
                  </>
                )}
              </>
            )}
            {canToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-borderMuted bg-panel text-gray-200 transition hover:text-white"
              aria-label={collapsed ? 'Show file pickers' : 'Show Current Journey Item'}
              title={collapsed ? 'Show file pickers' : 'Show Current Journey Item'}
            >
              {collapsed ? <Settings size={16} /> : <FileText size={16} />}
            </button>
          )}
          </div>
        </div>
        <div className="mt-4">{collapsed ? <JourneyItemDetails marker={marker} /> : children}</div>
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
    </>
  )

  if (isPinned && typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }

  return content
}

const JourneyItemDetails = ({
  marker,
}: {
  marker: TimelineMarker | null
}) => {
  const expandedStateRef = useRef(false)
  const [expanded, setExpanded] = useState(expandedStateRef.current)

  const toggleExpanded = () => {
    expandedStateRef.current = !expandedStateRef.current
    setExpanded(expandedStateRef.current)
  }

  if (!marker) {
    return (
      <p className="text-sm text-gray-500">
        Click any journey timeline item to view contextual details here.
      </p>
    )
  }

  const event = marker.event
  const typeLabel =
    event?.kind === 'click'
      ? 'Click'
      : event?.kind === 'request'
        ? `Request${event.method ? ` · ${event.method}` : ''}`
        : 'Event'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <DetailChip color={marker.color}>{typeLabel}</DetailChip>
        {marker.from && marker.to && (
          <DetailChip>
            {marker.from} <ArrowRight size={14} className="mx-1 inline text-gray-500" /> {marker.to}
          </DetailChip>
        )}
        {event?.method && event.kind === 'request' && (
          <DetailChip>Method: {event.method}</DetailChip>
        )}
        {event?.type && event.kind === 'request' && <DetailChip>Type: {event.type}</DetailChip>}
        {(event?.protocol || event?.nextHopProtocol) && event.kind === 'request' && (
          <DetailChip>{`Protocol: ${event.nextHopProtocol ?? event.protocol}`}</DetailChip>
        )}
        {typeof event?.duration === 'number' && event.kind === 'request' && (
          <DetailChip>{`Duration: ${formatMs(event.duration)}`}</DetailChip>
        )}
        {typeof event?.status === 'number' && event.kind === 'request' && (
          <DetailChip className={getStatusChipClass(event.status)}>{`Status: ${event.status}`}</DetailChip>
        )}
        <button
          type="button"
          onClick={toggleExpanded}
          className="text-sm text-blue-400 underline-offset-2 transition hover:text-blue-300 hover:underline"
        >
          {expanded ? 'hide details' : 'view details'}
        </button>
      </div>

      {expanded && (
        <>
          {event?.kind === 'click' && (
            <ClickDetails event={event} related={marker.relatedRequests ?? []} />
          )}
          {event?.kind === 'request' && (
            <RequestDetails event={event} triggeredBy={marker.triggeredBy} />
          )}
          {!event && (
            <DetailCard title="Details">
              {marker.details
                ? marker.details.split('\n').map((line, index) => <p key={index}>{line}</p>)
                : 'No additional details.'}
            </DetailCard>
          )}
        </>
      )}
    </div>
  )
}

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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
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
              onChange={(event) => onChangeLabel(event.target.value)}
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

const ClickDetails = ({
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

const RequestDetails = ({
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
    className={`min-w-0 overflow-hidden rounded-2xl border border-borderMuted bg-panel px-4 py-3 ${className}`}
  >
    <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gray-500">{title}</p>
    <div className="min-w-0">{children}</div>
  </div>
)

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
    className={`inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel px-3 py-1 text-xs font-medium text-gray-100 ${className}`}
    style={color ? { color, borderColor: color + '4d', backgroundColor: color + '1a' } : undefined}
  >
    {children}
  </span>
)

const formatMs = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }
  return `${value.toFixed(2)} ms`
}

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

  // Start with curl command
  parts.push('curl')

  // Add verbose flag for better debugging
  parts.push('-v')

  // Add method
  const method = event.method.toUpperCase()
  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }

  // Build full URL with query string
  let fullUrl = event.url
  if (event.qs && event.qs !== 'null') {
    // Remove leading ? if present
    const qs = event.qs.startsWith('?') ? event.qs.slice(1) : event.qs
    fullUrl = fullUrl.includes('?') ? `${fullUrl}&${qs}` : `${fullUrl}?${qs}`
  }

  // Add URL (properly escaped)
  parts.push(`'${fullUrl.replace(/'/g, "'\\''")}'`)

  // Add headers
  const headers: string[] = []

  // Content-Type header
  if (event.requestBody) {
    const mimeType = event.requestBody.mimeType || event.contentType || 'application/json'
    headers.push(`'Content-Type: ${mimeType}'`)
  } else if (event.contentType) {
    headers.push(`'Content-Type: ${event.contentType}'`)
  }

  // Add Accept header for JSON responses
  if (event.contentType?.includes('json') || event.responseBody?.mimeType?.includes('json')) {
    headers.push("'Accept: application/json'")
  }

  // Add User-Agent (common browser user agent)
  headers.push(
    "'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'",
  )

  // Add all headers
  if (headers.length > 0) {
    headers.forEach((header) => {
      parts.push(`-H ${header}`)
    })
  }

  // Add request body if present
  if (event.requestBody) {
    const bodyContent = decodeBodyContent(event.requestBody)
    if (bodyContent) {
      // Try to format JSON if it's JSON
      let formattedBody = bodyContent.trim()
      if (formattedBody.startsWith('{') || formattedBody.startsWith('[')) {
        try {
          const parsed = JSON.parse(formattedBody)
          formattedBody = JSON.stringify(parsed)
        } catch {
          // If parsing fails, use original
        }
      }
      // Escape single quotes and wrap in single quotes
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

export default App
