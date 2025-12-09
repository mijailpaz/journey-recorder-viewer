/**
 * Formatting utility functions for displaying timestamps, durations, and sizes
 */

export const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

export const formatTimestamp = (ts: number | null | undefined) => {
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

export const formatMs = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }
  return `${value.toFixed(2)} ms`
}

export const formatBytes = (value?: number | null) => {
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

export const getStatusChipClass = (status?: number | null) => {
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
