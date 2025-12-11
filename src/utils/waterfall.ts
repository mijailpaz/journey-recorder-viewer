import type { TraceEvent } from '../types/trace'

export interface WaterfallBar {
  request: TraceEvent
  // Percentages relative to total timeline (0-100)
  startPercent: number
  blockedPercent: number
  waitingPercent: number
  receivingPercent: number
  totalPercent: number
  // Absolute times in ms
  startMs: number
  durationMs: number
  // Display info
  label: string
  method: string
  status: number | null
  isSlowRequest: boolean
  isFailed: boolean
}

export interface WaterfallData {
  bars: WaterfallBar[]
  totalDurationMs: number
  requestCount: number
}

/**
 * Computes waterfall visualization data from an array of requests
 * relative to an interaction timestamp
 */
export const computeWaterfallData = (
  interactionTs: number | undefined,
  requests: TraceEvent[]
): WaterfallData | null => {
  if (requests.length === 0 || interactionTs === undefined) {
    return null
  }

  const baseTs = interactionTs

  // First pass: compute start and end times for each request
  const requestTimes = requests.map((req) => {
    const startMs = (req.ts ?? baseTs) - baseTs
    const duration = req.duration ?? 0
    const endMs = startMs + duration

    return {
      request: req,
      startMs: Math.max(0, startMs),
      endMs: Math.max(0, endMs),
      duration,
    }
  })

  // Find the total timeline duration
  const totalDurationMs = Math.max(
    ...requestTimes.map((r) => r.endMs),
    1 // Avoid division by zero
  )

  // Compute average duration to determine "slow" requests
  const avgDuration =
    requestTimes.reduce((sum, r) => sum + r.duration, 0) / requestTimes.length

  // Second pass: compute bar data with percentages
  const bars: WaterfallBar[] = requestTimes.map(({ request, startMs, duration }) => {
    const timings = request.timings
    
    // Calculate phase durations
    const blocked = (timings?.blocked ?? 0) + (timings?._blocked_queueing ?? 0)
    const waiting = timings?.wait ?? 0
    const receiving = timings?.receive ?? 0
    
    // If we have detailed timings, use them; otherwise estimate
    let blockedMs = blocked
    let waitingMs = waiting
    let receivingMs = receiving
    
    // If timings don't add up to duration, distribute remaining time
    const timedTotal = blockedMs + waitingMs + receivingMs
    if (timedTotal < duration && duration > 0) {
      // Distribute remaining time proportionally, favoring waiting
      const remaining = duration - timedTotal
      if (timedTotal === 0) {
        // No timing data, assume mostly waiting
        waitingMs = duration * 0.7
        receivingMs = duration * 0.3
      } else {
        // Add remaining to waiting (server time)
        waitingMs += remaining
      }
    }

    // Convert to percentages of total timeline
    const startPercent = (startMs / totalDurationMs) * 100
    const blockedPercent = (blockedMs / totalDurationMs) * 100
    const waitingPercent = (waitingMs / totalDurationMs) * 100
    const receivingPercent = (receivingMs / totalDurationMs) * 100
    const totalPercent = (duration / totalDurationMs) * 100

    // Generate label (path or URL, truncated)
    const fullPath = request.path ?? request.url ?? 'Unknown'
    const label = fullPath.length > 50 ? `${fullPath.slice(0, 47)}...` : fullPath

    return {
      request,
      startPercent,
      blockedPercent,
      waitingPercent,
      receivingPercent,
      totalPercent,
      startMs,
      durationMs: duration,
      label,
      method: request.method ?? 'GET',
      status: typeof request.status === 'number' ? request.status : null,
      isSlowRequest: duration > avgDuration * 1.5,
      isFailed: typeof request.status === 'number' && request.status >= 400,
    }
  })

  // Sort by start time
  bars.sort((a, b) => a.startMs - b.startMs)

  return {
    bars,
    totalDurationMs,
    requestCount: requests.length,
  }
}

/**
 * Formats duration for display in waterfall
 */
export const formatWaterfallDuration = (ms: number): string => {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

