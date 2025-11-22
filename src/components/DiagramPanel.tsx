import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
})

type DiagramPanelProps = {
  diagram: string
  fileName?: string
  errorMessage?: string | null
  activeTraceId?: string | number | null
  activeTraceColor?: string | null
}

type CopyStatus = 'idle' | 'copied' | 'error'

type ViewTransform = {
  zoom: number
  x: number
  y: number
}

const ZOOM_STEP = 0.2
const MIN_ZOOM = 0.5
const MAX_ZOOM = 5.5
const PAN_STEP = 48

const createDefaultTransform = (): ViewTransform => ({
  zoom: 1,
  x: 0,
  y: 0,
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const applySvgTransform = (svg: SVGSVGElement | null, transform: ViewTransform) => {
  if (!svg) {
    return
  }

  svg.style.transformOrigin = 'center center'
  svg.style.transformBox = 'fill-box'
  svg.style.transition = 'transform 150ms ease-out'
  svg.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`
}

const MESSAGE_LINE_PATTERN = /-->>|--\>|->>|->|--x|--o/

const buildSequenceTraceMap = (diagram: string) => {
  const map = new Map<number, string>()
  if (!diagram.trim()) {
    return map
  }

  const lines = diagram.split(/\r?\n/)
  let pendingTrace: string | null = null
  let sequence = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    if (line.startsWith('%%')) {
      const traceId = line.slice(2).trim()
      pendingTrace = traceId || null
      continue
    }
    if (!MESSAGE_LINE_PATTERN.test(line)) {
      continue
    }
    sequence += 1
    if (pendingTrace) {
      map.set(sequence, pendingTrace)
      pendingTrace = null
    }
  }

  return map
}

const attachTraceMetadata = (svg: SVGSVGElement | null, sequenceTraceMap: Map<number, string>) => {
  if (!svg) {
    return
  }

  svg.querySelectorAll('[data-trace-id]').forEach((node) => {
    node.removeAttribute('data-trace-id')
    node.removeAttribute('data-trace-selected')
    ;(node as SVGElement).style.removeProperty('--trace-highlight-color')
  })

  if (sequenceTraceMap.size === 0) {
    return
  }

  const sequenceNodes = svg.querySelectorAll<SVGTextElement>('.sequenceNumber')
  sequenceNodes.forEach((sequenceNode) => {
    const sequenceValue = Number(sequenceNode.textContent?.trim())
    const traceId = sequenceTraceMap.get(sequenceValue)
    if (!traceId) {
      return
    }
    const traceIdStr = String(traceId)
    sequenceNode.setAttribute('data-trace-id', traceIdStr)

    let sibling: Element | null = sequenceNode.previousElementSibling
    let foundMessageText = false

    while (sibling) {
      const classList = sibling.getAttribute('class') ?? ''
      const isMessageText = classList.includes('messageText')
      const isLine =
        classList.includes('messageLine0') ||
        classList.includes('messageLine1') ||
        sibling.getAttribute('marker-start')?.includes('sequencenumber')

      if (isMessageText || isLine) {
        sibling.setAttribute('data-trace-id', traceIdStr)
        if (isMessageText) {
          foundMessageText = true
          break
        }
      } else if (foundMessageText) {
        break
      } else if (classList && !isLine) {
        break
      }

      sibling = sibling.previousElementSibling
    }
  })
}

const highlightTraceSelection = (
  svg: SVGSVGElement | null,
  traceId?: string | number | null,
  color?: string | null,
) => {
  if (!svg) {
    return
  }

  svg.querySelectorAll('[data-trace-selected="true"]').forEach((node) => {
    node.removeAttribute('data-trace-selected')
    ;(node as SVGElement).style.removeProperty('--trace-highlight-color')
  })

  if (traceId == null) {
    return
  }

  const traceIdStr = String(traceId)
  const selector = `[data-trace-id="${escapeCssValue(traceIdStr)}"]`
  svg.querySelectorAll(selector).forEach((node) => {
    node.setAttribute('data-trace-selected', 'true')
    if (color) {
      ;(node as SVGElement).style.setProperty('--trace-highlight-color', color)
    }
  })
}

const escapeCssValue = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

const DiagramPanel = ({
  diagram,
  fileName,
  errorMessage,
  activeTraceId,
  activeTraceColor,
}: DiagramPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [transform, setTransform] = useState<ViewTransform>(() => createDefaultTransform())
  const transformRef = useRef<ViewTransform>(createDefaultTransform())
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const copyResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequenceTraceMap = useMemo(() => buildSequenceTraceMap(diagram), [diagram])

  useEffect(() => {
    setRenderError(errorMessage ?? null)
  }, [errorMessage])

  useEffect(() => {
    return () => {
      if (copyResetTimeout.current) {
        clearTimeout(copyResetTimeout.current)
      }
    }
  }, [])

  useEffect(() => {
    setTransform(createDefaultTransform())
  }, [diagram])

  useEffect(() => {
    transformRef.current = transform
    const svg = containerRef.current?.querySelector('svg') ?? null
    applySvgTransform(svg, transform)
  }, [transform])

  useEffect(() => {
    let isMounted = true
    if (!diagram.trim()) {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      return
    }

    const render = async () => {
      try {
        const { svg } = await mermaid.render(
          `journey-diagram-${Date.now()}`,
          diagram,
          containerRef.current ?? undefined,
        )
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgElement = containerRef.current.querySelector('svg')
          attachTraceMetadata(svgElement, sequenceTraceMap)
          applySvgTransform(svgElement, transformRef.current)
          setRenderError(null)
        }
      } catch (error) {
        if (isMounted) {
          setRenderError(error instanceof Error ? error.message : 'Unable to render diagram')
          if (containerRef.current) {
            containerRef.current.innerHTML = ''
          }
        }
      }
    }

    render()

    return () => {
      isMounted = false
    }
  }, [diagram, sequenceTraceMap])

  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!svg) {
      return
    }
    attachTraceMetadata(svg, sequenceTraceMap)
    highlightTraceSelection(svg, activeTraceId, activeTraceColor)
  }, [sequenceTraceMap, activeTraceId, activeTraceColor])

  const handlePan = (xDelta: number, yDelta: number) => {
    setTransform((prev) => ({ ...prev, x: prev.x + xDelta, y: prev.y + yDelta }))
  }

  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom + delta, MIN_ZOOM, MAX_ZOOM),
    }))
  }

  const handleReset = () => {
    setTransform(createDefaultTransform())
  }

  const hasDiagram = diagram.trim().length > 0

  const scheduleCopyReset = () => {
    if (copyResetTimeout.current) {
      clearTimeout(copyResetTimeout.current)
    }
    copyResetTimeout.current = setTimeout(() => setCopyStatus('idle'), 2000)
  }

  const handleOpenFullscreen = () => {
    if (!hasDiagram) {
      return
    }
    setIsFullscreenOpen(true)
  }

  const handleCopyDiagram = async () => {
    if (!hasDiagram) {
      return
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyStatus('error')
      scheduleCopyReset()
      return
    }
    try {
      await navigator.clipboard.writeText(diagram)
      setCopyStatus('copied')
    } catch (error) {
      console.error('Copy Mermaid diagram failed', error)
      setCopyStatus('error')
    } finally {
      scheduleCopyReset()
    }
  }

  return (
    <>
      <section className="panel flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span className="font-medium text-gray-100">Sequence Diagram</span>
        {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
      </div>
      <div className="relative flex-1 overflow-auto rounded-lg border border-borderMuted bg-panelMuted px-4 py-4">
        {renderError && !diagram.trim() && (
          <p className="text-sm text-red-400">Mermaid error: {renderError}</p>
        )}
        {hasDiagram ? (
          <>
            <div
              ref={containerRef}
              className="mermaid text-gray-100 [&>svg]:mx-auto [&>svg]:block [&>svg]:max-w-none"
            />
            {!renderError && (
              <DiagramControls
                onPanLeft={() => handlePan(PAN_STEP, 0)}
                onPanRight={() => handlePan(-PAN_STEP, 0)}
                onPanUp={() => handlePan(0, PAN_STEP)}
                onPanDown={() => handlePan(0, -PAN_STEP)}
                onZoomIn={() => handleZoom(ZOOM_STEP)}
                onZoomOut={() => handleZoom(-ZOOM_STEP)}
                onReset={handleReset}
              />
            )}
            <DiagramActions
              copyStatus={copyStatus}
              onOpenFullscreen={handleOpenFullscreen}
              onCopyDiagram={handleCopyDiagram}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Load a .mmd Mermaid file to render the flow
          </div>
        )}
        {renderError && diagram.trim() && (
          <p className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
            Mermaid error: {renderError}
          </p>
        )}
      </div>
      </section>
      {isFullscreenOpen && (
        <FullscreenDiagramDialog
          diagram={diagram}
          onClose={() => setIsFullscreenOpen(false)}
          activeTraceId={activeTraceId}
          activeTraceColor={activeTraceColor}
        />
      )}
    </>
  )
}

export default DiagramPanel

type ControlButtonProps = {
  label: string
  onClick: () => void
  children: ReactNode
}

const ControlButton = ({ label, onClick, children }: ControlButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="flex h-8 w-8 items-center justify-center rounded-lg border border-borderMuted bg-panelMuted text-gray-100 shadow-md shadow-black/20 transition hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
  >
    {children}
  </button>
)

type DiagramControlsProps = {
  onPanLeft: () => void
  onPanRight: () => void
  onPanUp: () => void
  onPanDown: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

const DiagramControls = ({
  onPanLeft,
  onPanRight,
  onPanUp,
  onPanDown,
  onZoomIn,
  onZoomOut,
  onReset,
}: DiagramControlsProps) => (
  <div className="pointer-events-none absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
    <div className="pointer-events-auto grid grid-cols-3 gap-1.5 rounded-xl border border-borderMuted bg-panel/80 p-1.5 backdrop-blur">
      <ControlSpacer />
      <ControlButton label="Pan up" onClick={onPanUp}>
        <ChevronUp size={14} strokeWidth={2.2} />
      </ControlButton>
      <ControlButton label="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={14} strokeWidth={2.2} />
      </ControlButton>
      <ControlButton label="Pan left" onClick={onPanLeft}>
        <ChevronLeft size={14} strokeWidth={2.2} />
      </ControlButton>
      <ControlButton label="Reset view" onClick={onReset}>
        <RotateCcw size={14} strokeWidth={2.2} />
      </ControlButton>
      <ControlButton label="Pan right" onClick={onPanRight}>
        <ChevronRight size={14} strokeWidth={2.2} />
      </ControlButton>
      <ControlSpacer />
      <ControlButton label="Pan down" onClick={onPanDown}>
        <ChevronDown size={14} strokeWidth={2.2} />
      </ControlButton>
      <ControlButton label="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={14} strokeWidth={2.2} />
      </ControlButton>
    </div>
  </div>
)

const ControlSpacer = () => <div className="h-8 w-8" aria-hidden="true" />

type DiagramActionsProps = {
  onOpenFullscreen: () => void
  onCopyDiagram: () => void
  copyStatus: CopyStatus
}

const DiagramActions = ({ onOpenFullscreen, onCopyDiagram, copyStatus }: DiagramActionsProps) => {
  const copyLabel =
    copyStatus === 'copied'
      ? 'Diagram copied'
      : copyStatus === 'error'
        ? 'Copy failed'
        : 'Copy Mermaid diagram'

  return (
    <div className="pointer-events-none absolute top-4 right-4 sm:right-5">
      <div className="pointer-events-auto flex gap-2 rounded-2xl border border-borderMuted bg-panel/80 p-1 shadow-lg shadow-black/20 backdrop-blur">
        <ActionButton label="Open diagram fullscreen" onClick={onOpenFullscreen}>
          <ArrowLeftRight size={16} strokeWidth={2.2} />
        </ActionButton>
        <ActionButton label={copyLabel} onClick={onCopyDiagram}>
          {copyStatus === 'copied' ? (
            <Check size={16} strokeWidth={2.2} />
          ) : (
            <Copy size={16} strokeWidth={2.2} />
          )}
        </ActionButton>
      </div>
    </div>
  )
}

type ActionButtonProps = {
  label: string
  onClick: () => void
  children: ReactNode
}

const ActionButton = ({ label, onClick, children }: ActionButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="flex h-9 w-9 items-center justify-center rounded-xl border border-borderMuted bg-panelMuted text-gray-100 shadow-sm transition hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
  >
    {children}
  </button>
)

type FullscreenDiagramDialogProps = {
  diagram: string
  onClose: () => void
  activeTraceId?: string | number | null
  activeTraceColor?: string | null
}

const FullscreenDiagramDialog = ({
  diagram,
  onClose,
  activeTraceId,
  activeTraceColor,
}: FullscreenDiagramDialogProps) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [transform, setTransform] = useState<ViewTransform>(() => createDefaultTransform())
  const transformRef = useRef<ViewTransform>(createDefaultTransform())
  const sequenceTraceMap = useMemo(() => buildSequenceTraceMap(diagram), [diagram])
  const hasDiagram = diagram.trim().length > 0

  useEffect(() => {
    setTransform(createDefaultTransform())
  }, [diagram])

  useEffect(() => {
    transformRef.current = transform
    const svg = canvasRef.current?.querySelector('svg') ?? null
    applySvgTransform(svg, transform)
  }, [transform])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = originalOverflow
    }
  }, [onClose])

  useEffect(() => {
    if (!hasDiagram) {
      if (canvasRef.current) {
        canvasRef.current.innerHTML = ''
      }
      return
    }

    let isMounted = true
    const render = async () => {
      try {
        const { svg } = await mermaid.render(`journey-fullscreen-${Date.now()}`, diagram)
        if (isMounted && canvasRef.current) {
          canvasRef.current.innerHTML = svg
          const svgElement = canvasRef.current.querySelector('svg')
          attachTraceMetadata(svgElement, sequenceTraceMap)
          applySvgTransform(svgElement, transformRef.current)
          highlightTraceSelection(svgElement, activeTraceId, activeTraceColor)
          setDialogError(null)
        }
      } catch (error) {
        if (isMounted) {
          setDialogError(error instanceof Error ? error.message : 'Unable to render diagram')
          if (canvasRef.current) {
            canvasRef.current.innerHTML = ''
          }
        }
      }
    }

    render()
    return () => {
      isMounted = false
    }
  }, [diagram, hasDiagram, sequenceTraceMap])

  useEffect(() => {
    const svg = canvasRef.current?.querySelector('svg')
    if (!svg) {
      return
    }
    attachTraceMetadata(svg, sequenceTraceMap)
    highlightTraceSelection(svg, activeTraceId, activeTraceColor)
  }, [sequenceTraceMap, activeTraceId, activeTraceColor])

  if (typeof document === 'undefined') {
    return null
  }

  const handlePan = (xDelta: number, yDelta: number) => {
    setTransform((prev) => ({ ...prev, x: prev.x + xDelta, y: prev.y + yDelta }))
  }

  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom + delta, MIN_ZOOM, MAX_ZOOM),
    }))
  }

  const handleReset = () => {
    setTransform(createDefaultTransform())
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-2 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-[98vw] rounded-3xl border border-borderMuted bg-panel p-6 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close fullscreen diagram"
          title="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-borderMuted bg-panelMuted text-gray-300 shadow hover:bg-panel hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between text-sm font-medium text-gray-100">
            <span>Sequence Diagram Preview</span>
          </div>
          <div className="relative flex-1 overflow-auto rounded-2xl border border-borderMuted bg-panelMuted p-5">
            {hasDiagram ? (
              <>
                <div
                  ref={canvasRef}
                  className="mermaid text-gray-100 [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-none"
                />
                {!dialogError && (
                  <DiagramControls
                    onPanLeft={() => handlePan(PAN_STEP, 0)}
                    onPanRight={() => handlePan(-PAN_STEP, 0)}
                    onPanUp={() => handlePan(0, PAN_STEP)}
                    onPanDown={() => handlePan(0, -PAN_STEP)}
                    onZoomIn={() => handleZoom(ZOOM_STEP)}
                    onZoomOut={() => handleZoom(-ZOOM_STEP)}
                    onReset={handleReset}
                  />
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No diagram loaded
              </div>
            )}
          </div>
          {dialogError && (
            <p className="text-sm text-red-400">Mermaid error: {dialogError}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

