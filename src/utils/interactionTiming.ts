import type { TraceEvent } from '../types/trace'

export interface InteractionTimingAnalysis {
  requestCount: number
  // Time from interaction to first response byte received
  timeToFirstResponse: number | null
  // Time from interaction until all requests complete
  timeToAllComplete: number | null
  // Total time requests spent blocked (network congestion)
  totalBlocked: number
  // Average server wait time (TTFB)
  avgWaitTTFB: number | null
  // The slowest request
  slowestRequest: TraceEvent | null
  // Total data transferred
  totalTransferred: number
  // Number of failed requests (4xx, 5xx)
  failedRequests: number
  // Requests with timing data available
  requestsWithTimings: number
}

/**
 * Analyzes the timing data from requests triggered by an interaction
 * to provide user experience metrics
 */
export const analyzeInteractionTiming = (
  interactionTs: number | undefined,
  requests: TraceEvent[]
): InteractionTimingAnalysis | null => {
  if (requests.length === 0) {
    return null
  }

  const baseTs = interactionTs ?? 0

  // Filter requests that have timing/duration data
  const requestsWithTimings = requests.filter(
    (r) => r.timings || typeof r.duration === 'number'
  )

  // Calculate time to first response (earliest responseStart relative to interaction)
  let timeToFirstResponse: number | null = null
  const responseStarts = requests
    .map((r) => {
      if (typeof r.responseStart === 'number') {
        return r.responseStart - baseTs
      }
      // Fall back to ts + blocked + wait if available
      if (r.ts && r.timings) {
        const blocked = r.timings.blocked ?? 0
        const wait = r.timings.wait ?? 0
        return r.ts - baseTs + blocked + wait
      }
      return null
    })
    .filter((v): v is number => v !== null && v >= 0)

  if (responseStarts.length > 0) {
    timeToFirstResponse = Math.min(...responseStarts)
  }

  // Calculate time to all complete (latest responseEnd relative to interaction)
  let timeToAllComplete: number | null = null
  const responseEnds = requests
    .map((r) => {
      if (typeof r.responseEnd === 'number') {
        return r.responseEnd - baseTs
      }
      // Fall back to ts + duration if available
      if (r.ts && typeof r.duration === 'number') {
        return r.ts - baseTs + r.duration
      }
      return null
    })
    .filter((v): v is number => v !== null && v >= 0)

  if (responseEnds.length > 0) {
    timeToAllComplete = Math.max(...responseEnds)
  }

  // Calculate total blocked time
  const totalBlocked = requestsWithTimings.reduce(
    (sum, r) => sum + (r.timings?.blocked ?? 0) + (r.timings?._blocked_queueing ?? 0),
    0
  )

  // Calculate average wait/TTFB
  const waitTimes = requestsWithTimings
    .map((r) => r.timings?.wait)
    .filter((v): v is number => typeof v === 'number' && v >= 0)
  const avgWaitTTFB = waitTimes.length > 0
    ? waitTimes.reduce((sum, v) => sum + v, 0) / waitTimes.length
    : null

  // Find slowest request
  let slowestRequest: TraceEvent | null = null
  let maxDuration = 0
  for (const req of requests) {
    const duration = req.duration ?? 0
    if (duration > maxDuration) {
      maxDuration = duration
      slowestRequest = req
    }
  }

  // Calculate total transferred
  const totalTransferred = requests.reduce(
    (sum, r) => sum + (r.transferSize ?? 0),
    0
  )

  // Count failed requests
  const failedRequests = requests.filter(
    (r) => typeof r.status === 'number' && r.status >= 400
  ).length

  return {
    requestCount: requests.length,
    timeToFirstResponse,
    timeToAllComplete,
    totalBlocked,
    avgWaitTTFB,
    slowestRequest,
    totalTransferred,
    failedRequests,
    requestsWithTimings: requestsWithTimings.length,
  }
}

/**
 * Returns a performance rating based on time to all complete
 */
export const getPerformanceRating = (
  timeToAllComplete: number | null
): { label: string; colorClass: string } => {
  if (timeToAllComplete === null) {
    return { label: 'Unknown', colorClass: 'text-gray-400' }
  }
  if (timeToAllComplete < 200) {
    return { label: 'Excellent', colorClass: 'text-emerald-400' }
  }
  if (timeToAllComplete < 500) {
    return { label: 'Good', colorClass: 'text-green-400' }
  }
  if (timeToAllComplete < 1000) {
    return { label: 'Acceptable', colorClass: 'text-yellow-400' }
  }
  if (timeToAllComplete < 2000) {
    return { label: 'Slow', colorClass: 'text-orange-400' }
  }
  return { label: 'Very Slow', colorClass: 'text-red-400' }
}

