import type { TraceEvent } from '../../types/trace'
import { formatTimestamp } from '../../utils/formatters'
import { DetailCard } from '../shared/DetailCard'
import { DetailChip } from '../shared/DetailChip'
import { DetailList } from '../shared/DetailList'

type ClickDetailsContentProps = {
  event: TraceEvent
  related: TraceEvent[]
}

export const ClickDetailsContent = ({ event, related }: ClickDetailsContentProps) => {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <DetailCard title="Interaction">
        <DetailList
          entries={[
            ['Label', event.label ?? '—'],
            ['Selector', event.selector ?? '—'],
            ['Path', event.path ?? '—'],
            ['Query', event.qs ?? '—'],
            ['Timestamp', formatTimestamp(event.ts)],
            ['ID', event.id != null ? String(event.id) : '—'],
          ]}
        />
      </DetailCard>
      <DetailCard title="Requests Triggered">
        {related.length === 0 ? (
          <p className="text-sm text-gray-400">No matching requests captured for this click.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-300">
            <DetailChip>
              {related.length} matching request{related.length > 1 ? 's' : ''}
            </DetailChip>
            <ol className="list-inside list-decimal space-y-1">
              {related.map((req) => (
                <li key={`related-${req.id ?? req.ts}`} className="break-words">
                  <span className="font-medium text-gray-100">{req.method ?? 'GET'}</span>{' '}
                  <span className="text-gray-400">{req.path ?? req.url}</span>
                  {typeof req.status === 'number' && (
                    <span className="text-gray-500"> · {req.status}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </DetailCard>
    </div>
  )
}
