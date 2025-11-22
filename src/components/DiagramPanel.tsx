import { useEffect, useRef, useState } from 'react'
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
}

const DiagramPanel = ({ diagram, fileName, errorMessage }: DiagramPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    setRenderError(errorMessage ?? null)
  }, [errorMessage])

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
  }, [diagram])

  return (
    <section className="panel flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span className="font-medium text-gray-100">Sequence Diagram</span>
        {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-borderMuted bg-panelMuted px-4 py-4">
        {renderError && !diagram.trim() && (
          <p className="text-sm text-red-400">Mermaid error: {renderError}</p>
        )}
        {diagram.trim() ? (
          <div ref={containerRef} className="mermaid text-gray-100" />
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
  )
}

export default DiagramPanel

