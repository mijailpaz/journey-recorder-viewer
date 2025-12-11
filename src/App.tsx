import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import {
  Download,
  Settings,
} from 'lucide-react'
import DiagramPanel from './components/DiagramPanel'
import FileInputs from './components/FileInputs'
import FooterBar from './components/FooterBar'
import HeaderBar from './components/HeaderBar'
import JourneyPanel, { type TimelineMarker, type FilterGroupOption } from './components/JourneyPanel'
import TraceSettingsPanel from './components/TraceSettingsPanel'
import VideoPanel from './components/VideoPanel'
import type { TraceEvent, TraceFile } from './types/trace'
import generateMermaidFromTrace from './utils/mermaid'
import {
  applyTraceFilters,
  createDefaultFilterSettings,
  FILTER_GROUP_TEMPLATES,
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

const deriveParticipants = (event: TraceEvent, currentHost: string) => {
  if (event.kind === 'click') {
    const clickHost = event.host ? normalizeHost(event.host) : 'WebApp'
    // If there's a targetHost that's different, show navigation destination
    if (event.targetHost) {
      const targetNormalized = normalizeHost(event.targetHost)
      if (targetNormalized !== clickHost) {
        return { from: 'User', to: `${clickHost} → ${targetNormalized}` }
      }
    }
    return { from: 'User', to: clickHost }
  }
  if (event.kind === 'navigation') {
    const navHost = event.host ? normalizeHost(event.host) : 'WebApp'
    const transitionLabel = event.transitionType || 'navigate'
    return { from: 'User', to: `${navHost} (${transitionLabel})` }
  }
  if (event.kind === 'spa-navigation') {
    const currentSpaHost = event.previousHost ? normalizeHost(event.previousHost) : 'WebApp'
    const targetSpaHost = event.host ? normalizeHost(event.host) : currentSpaHost
    const navType = event.navigationType || 'navigate'
    if (currentSpaHost !== targetSpaHost) {
      return { from: 'User', to: `${currentSpaHost} → ${targetSpaHost} (${navType})` }
    }
    return { from: 'User', to: `${targetSpaHost} (${navType})` }
  }
  if (event.kind === 'request') {
    return { from: currentHost, to: extractEndpointName(event) }
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

type TimelineComputation = {
  clicks: TimelineMarker[]
  requests: TimelineMarker[]
  timeRangeMs: number | null
  startTs: number | null
  endTs: number | null
}

const normalizeHost = (host: string) => host.replace(/^www\./i, '')

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

  const isInteractionKind = (kind: string) =>
    kind === 'click' || kind === 'navigation' || kind === 'spa-navigation'

  let lastInteraction: TraceEvent | null = null
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    const key = getEventInternalId(event, getEventKey(event, i))
    if (isInteractionKind(event.kind)) {
      lastInteraction = event
      const related: TraceEvent[] = []
      for (let j = i + 1; j < events.length; j += 1) {
        const candidate = events[j]
        if (isInteractionKind(candidate.kind)) {
          break
        }
        if (candidate.kind === 'request') {
          related.push(candidate)
        }
      }
      relatedRequestsByEventId.set(key, related)
    } else if (event.kind === 'request') {
      requestTriggerMap.set(key, lastInteraction)
    }
  }

  // Get the current host for a request based on its triggering interaction (click or navigation)
  const getCurrentHostForRequest = (event: TraceEvent): string => {
    const eventKey = getEventInternalId(event, getEventKey(event, events.indexOf(event)))
    const triggerInteraction = requestTriggerMap.get(eventKey)
    if (triggerInteraction) {
      // For navigation events, use the destination host
      if (triggerInteraction.kind === 'navigation' || triggerInteraction.kind === 'spa-navigation') {
        return triggerInteraction.host ? normalizeHost(triggerInteraction.host) : 'WebApp'
      }
      // For clicks, use targetHost if the click navigated, otherwise use the click's host
      if (triggerInteraction.targetHost) {
        const targetNormalized = normalizeHost(triggerInteraction.targetHost)
        const clickHost = triggerInteraction.host ? normalizeHost(triggerInteraction.host) : 'WebApp'
        if (targetNormalized !== clickHost) {
          return targetNormalized
        }
      }
      return triggerInteraction.host ? normalizeHost(triggerInteraction.host) : 'WebApp'
    }
    return 'WebApp'
  }

  const toMarker = (event: TraceEvent, index: number): TimelineMarker => {
    const ts = typeof event.ts === 'number' ? event.ts : startTs
    const position = clampPercent(((ts - startTs) / range) * 100)
    const label = event.label ?? event.text ?? event.path ?? event.method ?? event.kind
    const isInteractionEvent =
      event.kind === 'click' || event.kind === 'navigation' || event.kind === 'spa-navigation'
    const color = isInteractionEvent ? '#f5d742' : '#4aa3ff'
    const currentHost = event.kind === 'request' ? getCurrentHostForRequest(event) : 'WebApp'
    const participants = deriveParticipants(event, currentHost)
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

  const isInteraction = (event: TraceEvent) =>
    event.kind === 'click' || event.kind === 'navigation' || event.kind === 'spa-navigation'
  const interactions = events.filter(isInteraction).map(toMarker)
  const requests = events.filter((event) => event.kind === 'request').map(toMarker)

  return {
    clicks: interactions,
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
  const [isJourneyPinned, setIsJourneyPinned] = useState(false)
  const [isAutoZoomEnabled, setIsAutoZoomEnabled] = useState(false)
  const [eventOverrides, setEventOverrides] = useState<EventOverrideMap>({})
  const [filterSettings, setFilterSettings] = useState<TraceFilterSettings>(createDefaultFilterSettings())
  const [pinnedJourneyHeight, setPinnedJourneyHeight] = useState(0)
  const [showLoadSessionPanel, setShowLoadSessionPanel] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)
  const [isLoadingTrace, setIsLoadingTrace] = useState(false)
  const [isFilterPending, startFilterTransition] = useTransition()
  const videoRef = useRef<HTMLVideoElement>(null)
  const autoHideLoadPanelRef = useRef(false)

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

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
    setIsLoadingTrace(true)
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
    } finally {
      setIsLoadingTrace(false)
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

  const filterGroupOptions: FilterGroupOption[] = useMemo(() => {
    const groupOptions = FILTER_GROUP_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      description: template.description,
    }))
    // Add custom regex as an option
    groupOptions.push({
      id: 'custom',
      label: 'Custom regex filters',
      description: 'Your own custom filters. One regex pattern per line.',
    })
    return groupOptions
  }, [])

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
    startFilterTransition(() => {
      setFilterSettings(createDefaultFilterSettings())
    })
  }, [startFilterTransition])

  const handleUpdateFilterSettings = useCallback(
    (updater: TraceFilterSettings | ((prev: TraceFilterSettings) => TraceFilterSettings)) => {
      startFilterTransition(() => {
        setFilterSettings(updater)
      })
    },
    [startFilterTransition],
  )

  const handleAddFilter = useCallback((pattern: string, groupId: string): number => {
    // Count how many request events match this pattern in the current filtered trace
    let matchCount = 0
    try {
      const regex = new RegExp(pattern, 'i')
      matchCount = (filteredTrace?.events ?? []).filter(
        (event) => event.kind === 'request' && regex.test(event.url || event.host || event.path || '')
      ).length
    } catch {
      // Invalid regex - count will be 0
    }

    startFilterTransition(() => {
      setFilterSettings((prev) => {
        // If adding to custom filters
        if (groupId === 'custom') {
          const currentText = prev.customRegexText.trim()
          const newText = currentText ? `${currentText}\n${pattern}` : pattern
          return { ...prev, customRegexText: newText }
        }
        // Otherwise add to a specific group
        return {
          ...prev,
          groups: prev.groups.map((group) => {
            if (group.id === groupId) {
              const currentText = group.patternsText.trim()
              const newText = currentText ? `${currentText}\n${pattern}` : pattern
              return { ...group, patternsText: newText }
            }
            return group
          }),
        }
      })
    })

    // Show toast with result
    if (matchCount > 0) {
      setToast({
        message: `Filtered ${matchCount} request${matchCount !== 1 ? 's' : ''} matching "${pattern}"`,
        type: 'success',
      })
    } else {
      setToast({
        message: `Filter added. No current requests match "${pattern}"`,
        type: 'info',
      })
    }

    return matchCount
  }, [filteredTrace, startFilterTransition])

  const disablePrevious = combinedMarkers.length === 0 || activeMarkerIndex <= 0
  const disableNext =
    combinedMarkers.length === 0 || activeMarkerIndex === combinedMarkers.length - 1

  const allFilesLoaded = Boolean(video && loadedTraceFile)

  useEffect(() => {
    if (!allFilesLoaded) {
      setShowLoadSessionPanel(true)
      autoHideLoadPanelRef.current = false
      return
    }
    if (!autoHideLoadPanelRef.current) {
      setShowLoadSessionPanel(false)
      autoHideLoadPanelRef.current = true
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
        isLoadingTrace={isLoadingTrace}
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
          onUpdateSettings={handleUpdateFilterSettings}
          onResetFilters={handleResetFilters}
        />
      )}
    </div>
  )

  const mainStyle = isJourneyPinned
    ? { paddingBottom: `${pinnedJourneyHeight + 16}px` }
    : undefined

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

  const loadPanelToggleLabel = showLoadSessionPanel ? 'Hide Load Session Files' : 'Show Load Session Files'
  const loadPanelToggleButton = allFilesLoaded ? (
    <button
      type="button"
      onClick={() => setShowLoadSessionPanel((prev) => !prev)}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-borderMuted transition ${
        showLoadSessionPanel ? 'bg-panel text-white' : 'text-gray-200 hover:bg-panel hover:text-white'
      }`}
      aria-label={loadPanelToggleLabel}
      title={loadPanelToggleLabel}
      aria-pressed={showLoadSessionPanel}
    >
      <Settings size={16} />
    </button>
  ) : null

  const loadSessionSection = (
    <LoadSessionPanel status={status}>
      {fileInputsContent}
    </LoadSessionPanel>
  )

  const shouldShowLoadSessionSection = !allFilesLoaded || showLoadSessionPanel

  const journeySection = (
    <JourneyPanel
      marker={activeMarker}
      clicks={timeline.clicks}
      requests={timeline.requests}
      timeRangeMs={timeline.timeRangeMs}
      playbackPercent={playbackPercent}
      onMarkerClick={handleMarkerSelect}
      disablePrevious={disablePrevious}
      disableNext={disableNext}
      onNavigatePrevious={() => handleNavigate('prev')}
      onNavigateNext={() => handleNavigate('next')}
      isPinned={isJourneyPinned}
      onTogglePin={() => setIsJourneyPinned((prev) => !prev)}
      isAutoZoomEnabled={isAutoZoomEnabled}
      onToggleAutoZoom={() => setIsAutoZoomEnabled((prev) => !prev)}
      eventEditor={{
        getOverrideForEvent,
        updateLabel: updateEventLabel,
        toggleRemoval: toggleEventRemoval,
        reset: resetEventChanges,
        getOriginalEvent: getOriginalEventFor,
      }}
      onPinnedHeightChange={setPinnedJourneyHeight}
      allMarkers={combinedMarkers}
      activeMarkerIndex={activeMarkerIndex}
      filterGroups={filterGroupOptions}
      onAddFilter={handleAddFilter}
      isLoading={isLoadingTrace || isFilterPending}
    />
  )

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <HeaderBar actions={headerActions} modeActions={loadPanelToggleButton} />

      <main
        className={`flex flex-1 flex-col gap-5 overflow-hidden px-6 py-6`}
        style={mainStyle}
      >
        {shouldShowLoadSessionSection && loadSessionSection}

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
            isAutoZoomEnabled={isAutoZoomEnabled}
            isLoading={isLoadingTrace || isFilterPending}
          />
        </div>

        {journeySection}
      </main>

      <FooterBar status={status} />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[10002] -translate-x-1/2 animate-fade-in">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
              toast.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100'
                : 'border-blue-500/40 bg-blue-500/20 text-blue-100'
            }`}
          >
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-current opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const LoadSessionPanel = ({
  status,
  children,
}: {
  status: string
  children?: ReactNode
}) => {
  return (
    <div className="rounded-2xl border border-borderMuted bg-panelMuted/90 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            Load Session Files
          </p>
          <p className="text-sm text-gray-300">{status}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default App
