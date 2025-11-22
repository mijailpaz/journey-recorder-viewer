import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DiagramPanel from './components/DiagramPanel'
import FileInputs from './components/FileInputs'
import FooterBar from './components/FooterBar'
import HeaderBar from './components/HeaderBar'
import TimelineSection, { type TimelineMarker } from './components/Timeline'
import VideoPanel from './components/VideoPanel'
import type { TraceEvent, TraceFile } from './types/trace'

type LoadedVideo = {
  url: string
  name: string
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

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

  const toMarker = (event: TraceEvent, index: number): TimelineMarker => {
    const ts = typeof event.ts === 'number' ? event.ts : startTs
    const position = clampPercent(((ts - startTs) / range) * 100)
    const label = event.label ?? event.text ?? event.path ?? event.method ?? event.kind
    const color = event.kind === 'click' ? '#f5d742' : '#4aa3ff'
    return {
      id: `${event.kind}-${event.id ?? index}`,
      position,
      label,
      details: buildDetails(event),
      timestamp: typeof event.ts === 'number' ? event.ts : null,
      traceId: event.id,
      color,
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
  const [traceFile, setTraceFile] = useState<TraceFile | null>(null)
  const [diagram, setDiagram] = useState('')
  const [fileNames, setFileNames] = useState<{ video?: string; trace?: string; diagram?: string }>({})
  const [fileError, setFileError] = useState<string | null>(null)
  const [diagramError, setDiagramError] = useState<string | null>(null)
  const [videoProgressMs, setVideoProgressMs] = useState<number | null>(null)
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null)
  const [activeTraceId, setActiveTraceId] = useState<string | number | null>(null)
  const [activeTraceColor, setActiveTraceColor] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const videoAnchorTs = traceFile?.videoStartedAt ?? null

  const timeline = useMemo(
    () => computeTimeline(traceFile, videoAnchorTs, videoDurationMs),
    [traceFile, videoAnchorTs, videoDurationMs],
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
      setTraceFile(parsed)
      setFileNames((prev) => ({ ...prev, trace: file.name }))
      setFileError(null)
    } catch (error) {
      setTraceFile(null)
      setFileError('Unable to parse the trace JSON file.')
      console.error('Trace parse error', error)
    }
  }, [])

  const handleDiagramSelect = useCallback(async (file: File | null) => {
    if (!file) {
      return
    }
    try {
      const content = await file.text()
      setDiagram(content)
      setFileNames((prev) => ({ ...prev, diagram: file.name }))
      setDiagramError(null)
    } catch (error) {
      setDiagram('')
      setDiagramError('Unable to read the Mermaid file.')
      console.error('Mermaid file read error', error)
    }
  }, [])

  const status = useMemo(() => {
    if (fileError) {
      return fileError
    }
    if (diagramError) {
      return diagramError
    }
    if (video && traceFile && diagram.trim()) {
      return 'Files loaded – ready to replay'
    }
    if (video || traceFile || diagram.trim()) {
      return 'Waiting for remaining files'
    }
    return 'Waiting for files'
  }, [diagram, diagramError, fileError, traceFile, video])

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

  const handleMarkerClick = useCallback(
    (timestamp: number, marker?: TimelineMarker) => {
      if (!videoRef.current || typeof videoAnchorTs !== 'number') {
        return
      }
      const videoTimeSeconds = (timestamp - videoAnchorTs) / 1000
      if (videoTimeSeconds >= 0 && videoTimeSeconds <= (videoDurationMs ?? Infinity) / 1000) {
        videoRef.current.currentTime = videoTimeSeconds
      }
      if (marker?.traceId != null) {
        setActiveTraceId(marker.traceId)
      } else {
        setActiveTraceId(null)
      }
      setActiveTraceColor(marker?.color ?? null)
    },
    [videoAnchorTs, videoDurationMs],
  )

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <HeaderBar>
        <FileInputs
          onVideoSelect={handleVideoSelect}
          onTraceSelect={handleTraceSelect}
          onDiagramSelect={handleDiagramSelect}
          loadedNames={fileNames}
          errorMessage={fileError}
        />
      </HeaderBar>

      <main className="flex flex-1 flex-col gap-5 overflow-hidden px-6 py-6">
        <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
          <VideoPanel
            ref={videoRef}
            src={video?.url}
            fileName={fileNames.video}
            onTimeUpdate={handleTimeUpdate}
            onDuration={handleDuration}
          />
          <DiagramPanel
            diagram={diagram}
            fileName={fileNames.diagram}
            errorMessage={diagramError}
            activeTraceId={activeTraceId}
            activeTraceColor={activeTraceColor}
          />
        </div>
        <TimelineSection
          clicks={timeline.clicks}
          requests={timeline.requests}
          timeRangeMs={timeline.timeRangeMs}
          playbackPercent={playbackPercent}
          onMarkerClick={handleMarkerClick}
        />
      </main>

      <FooterBar status={status} />
    </div>
  )
}

export default App
