import { Clock, Zap, Server, AlertTriangle, Download, Activity } from 'lucide-react'
import type { TraceEvent } from '../../types/trace'
import { formatMs, formatBytes } from '../../utils/formatters'
import {
  analyzeInteractionTiming,
  getPerformanceRating,
} from '../../utils/interactionTiming'

type InteractionTimingAnalysisProps = {
  interactionTs: number | undefined
  requests: TraceEvent[]
}

export const InteractionTimingAnalysis = ({
  interactionTs,
  requests,
}: InteractionTimingAnalysisProps) => {
  const analysis = analyzeInteractionTiming(interactionTs, requests)

  if (!analysis || analysis.requestCount === 0) {
    return null
  }

  const rating = getPerformanceRating(analysis.timeToAllComplete)

  return (
    <div className="rounded-lg border border-borderMuted bg-panel/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <Activity size={14} />
          User Experience Analysis
        </h4>
        {analysis.timeToAllComplete !== null && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${rating.colorClass} border-current/30`}
          >
            {rating.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Time to First Response */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Zap size={12} />
            <span className="text-[10px] uppercase tracking-wider">First Response</span>
          </div>
          <p className="text-sm font-medium text-gray-200">
            {analysis.timeToFirstResponse !== null
              ? formatMs(analysis.timeToFirstResponse)
              : '—'}
          </p>
          <p className="text-[10px] text-gray-500">When data starts arriving</p>
        </div>

        {/* Time to All Complete */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Clock size={12} />
            <span className="text-[10px] uppercase tracking-wider">All Complete</span>
          </div>
          <p className={`text-sm font-medium ${rating.colorClass}`}>
            {analysis.timeToAllComplete !== null
              ? formatMs(analysis.timeToAllComplete)
              : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Total wait time</p>
        </div>

        {/* Average TTFB */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Server size={12} />
            <span className="text-[10px] uppercase tracking-wider">Avg Server Wait</span>
          </div>
          <p className="text-sm font-medium text-gray-200">
            {analysis.avgWaitTTFB !== null ? formatMs(analysis.avgWaitTTFB) : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Backend response time</p>
        </div>

        {/* Total Blocked */}
        {analysis.totalBlocked > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-amber-500">
              <AlertTriangle size={12} />
              <span className="text-[10px] uppercase tracking-wider">Blocked Time</span>
            </div>
            <p className="text-sm font-medium text-amber-300">
              {formatMs(analysis.totalBlocked)}
            </p>
            <p className="text-[10px] text-gray-500">Network congestion</p>
          </div>
        )}

        {/* Total Transferred */}
        {analysis.totalTransferred > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Download size={12} />
              <span className="text-[10px] uppercase tracking-wider">Data Transferred</span>
            </div>
            <p className="text-sm font-medium text-gray-200">
              {formatBytes(analysis.totalTransferred)}
            </p>
            <p className="text-[10px] text-gray-500">
              {analysis.requestCount} request{analysis.requestCount > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Failed Requests */}
        {analysis.failedRequests > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertTriangle size={12} />
              <span className="text-[10px] uppercase tracking-wider">Failed</span>
            </div>
            <p className="text-sm font-medium text-red-400">
              {analysis.failedRequests} request{analysis.failedRequests > 1 ? 's' : ''}
            </p>
            <p className="text-[10px] text-gray-500">Errors occurred</p>
          </div>
        )}
      </div>

      {/* Slowest Request */}
      {analysis.slowestRequest && typeof analysis.slowestRequest.duration === 'number' && (
        <div className="mt-3 pt-3 border-t border-borderMuted">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            Slowest Request
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-100">
              {analysis.slowestRequest.method ?? 'GET'}
            </span>
            <span className="text-gray-400 truncate flex-1">
              {analysis.slowestRequest.path ?? analysis.slowestRequest.url}
            </span>
            <span className="text-orange-400 font-medium whitespace-nowrap">
              {formatMs(analysis.slowestRequest.duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

