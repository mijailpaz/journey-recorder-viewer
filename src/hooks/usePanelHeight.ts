import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Hook to measure and track panel height changes
 */
export const usePanelHeight = (
  panelRef: RefObject<HTMLDivElement | null>,
  onHeightChange?: (height: number) => void
) => {
  const [measuredHeight, setMeasuredHeight] = useState(0)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const node = panelRef.current
    if (!node) {
      return
    }
    const updateHeight = () => {
      const height = node.getBoundingClientRect().height
      setMeasuredHeight(height)
      if (onHeightChange) {
        onHeightChange(height)
      }
    }
    updateHeight()
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateHeight()
      })
      observer.observe(node)
    } else {
      window.addEventListener('resize', updateHeight)
    }
    return () => {
      if (observer) {
        observer.disconnect()
      } else {
        window.removeEventListener('resize', updateHeight)
      }
    }
  }, [panelRef, onHeightChange])

  return measuredHeight
}
