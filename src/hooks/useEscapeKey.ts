import { useEffect } from 'react'

/**
 * Hook to handle Escape key press for closing dialogs/modals
 */
export const useEscapeKey = (onClose: () => void) => {
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
}
