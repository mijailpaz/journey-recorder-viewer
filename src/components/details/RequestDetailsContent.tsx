import type { ReactNode } from 'react'
import type { TraceEvent } from '../../types/trace'
import { generateCurlCommand } from '../../utils/curlGenerator'
import { formatBytes, formatMs, formatTimestamp, getStatusChipClass } from '../../utils/formatters'
import { buildTimingEntries } from '../../utils/timings'
import { DetailCard } from '../shared/DetailCard'
import { DetailChip } from '../shared/DetailChip'
import { DetailList } from '../shared/DetailList'
import { BodyCard } from './BodyCard'

type RequestDetailsContentProps = {
  event: TraceEvent
  triggeredBy?: TraceEvent | null
}

export const RequestDetailsContent = ({ event, triggeredBy }: RequestDetailsContentProps) => {
  const requestUrlEntries: Array<[string, ReactNode]> = [
    ['URL', event.url ?? '—'],
    ['Host', event.host ?? '—'],
    ['Path', event.path ?? '—'],
    ['Query', event.qs ?? '—'],
    ['Target URL', event.targetUrl ?? '—'],
    ['Target host', event.targetHost ?? '—'],
    ['Target path', event.targetPath ?? '—'],
    ['Content type', event.contentType ?? '—'],
    ['Initiator', event.initiator ?? event.targetUrl ?? '—'],
    ['Frame ID', event.frameId ?? '—'],
    ['Tab ID', event.tabId ?? '—'],
    ['Request ID', event.requestId ?? event.id ?? '—'],
  ]

  const statusEntries: Array<[string, ReactNode]> = [
    ['Method', event.method ?? '—'],
    [
      'Triggered by',
      triggeredBy
        ? `${triggeredBy.kind} #${triggeredBy.id ?? ''} (${triggeredBy.label ?? triggeredBy.text ?? ''})`
        : 'Unknown',
    ],
    ['Timestamp', formatTimestamp(event.ts)],
    ['Protocol', event.protocol ?? event.nextHopProtocol ?? '—'],
    ['Type', event.type ?? 'request'],
  ]

  const performanceEntries: Array<[string, ReactNode]> = [
    ['Start time', formatMs(event.startTime)],
    ['Duration', formatMs(event.duration)],
    ['Response start', formatMs(event.responseStart)],
    ['Response end', formatMs(event.responseEnd)],
    ['Transfer size', formatBytes(event.transferSize)],
    ['Body (encoded)', formatBytes(event.encodedBodySize)],
    ['Body (decoded)', formatBytes(event.decodedBodySize)],
    ['Network type', event.type ?? '—'],
    ['Next hop', event.nextHopProtocol ?? '—'],
  ]

  const showPerformanceCard = performanceEntries.some(([, value]) => value !== '—')
  const timingEntries = buildTimingEntries(event.timings)
  const showTimings = timingEntries.length > 0
  const curlCommand = generateCurlCommand(event)

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <DetailCard title="Request URL">
        <DetailList entries={requestUrlEntries} />
      </DetailCard>
      <DetailCard title="Status">
        <div className="space-y-2 text-sm text-gray-300">
          <DetailChip className={getStatusChipClass(event.status)}>
            {event.status ?? '—'} {event.statusText ? `· ${event.statusText}` : ''}
          </DetailChip>
          <DetailList entries={statusEntries} />
        </div>
      </DetailCard>
      {showPerformanceCard && (
        <DetailCard title="Performance">
          <DetailList entries={performanceEntries} />
        </DetailCard>
      )}
      {showTimings && (
        <DetailCard title="Network Timings">
          <DetailList entries={timingEntries} />
        </DetailCard>
      )}
      {curlCommand && (
        <DetailCard title="cURL Command" className="md:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Copy this command to replay the request</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(curlCommand)
                }}
                className="text-xs text-blue-400 transition hover:text-blue-300 hover:underline"
              >
                Copy
              </button>
            </div>
            <textarea
              readOnly
              value={curlCommand}
              className="w-full resize-none rounded-lg border border-borderMuted bg-black/30 p-3 font-mono text-xs leading-relaxed text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              rows={Math.min(Math.max(curlCommand.split('\n').length, 3), 15)}
              onClick={(e) => {
                e.currentTarget.select()
              }}
            />
          </div>
        </DetailCard>
      )}
      <BodyCard title="Request Body" body={event.requestBody} />
      <BodyCard title="Response Body" body={event.responseBody} />
    </div>
  )
}
