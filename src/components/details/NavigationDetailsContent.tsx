import type { TraceEvent } from '../../types/trace'
import { formatTimestamp } from '../../utils/formatters'
import { DetailCard } from '../shared/DetailCard'
import { DetailChip } from '../shared/DetailChip'
import { DetailList } from '../shared/DetailList'

type NavigationDetailsContentProps = {
  event: TraceEvent
  related: TraceEvent[]
}

const getTransitionLabel = (transitionType?: string): string => {
  const labels: Record<string, string> = {
    link: 'Link Click',
    typed: 'Typed URL',
    auto_bookmark: 'Bookmark',
    auto_subframe: 'Auto Subframe',
    manual_subframe: 'Manual Subframe',
    generated: 'Generated',
    start_page: 'Start Page',
    form_submit: 'Form Submit',
    reload: 'Page Reload',
    keyword: 'Keyword',
    keyword_generated: 'Keyword Generated',
  }
  return labels[transitionType ?? ''] || transitionType || 'Unknown'
}

const getSpaNavigationLabel = (navigationType?: string): string => {
  const labels: Record<string, string> = {
    pushState: 'Push State (New Route)',
    replaceState: 'Replace State',
    popstate: 'Back/Forward Navigation',
    hashchange: 'Hash Change',
  }
  return labels[navigationType ?? ''] || navigationType || 'Unknown'
}

export const NavigationDetailsContent = ({ event, related }: NavigationDetailsContentProps) => {
  const isFullNavigation = event.kind === 'navigation'
  const isSpaNavigation = event.kind === 'spa-navigation'

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <DetailCard title={isFullNavigation ? 'Page Navigation' : 'SPA Navigation'}>
        <DetailList
          entries={[
            isFullNavigation
              ? ['Transition Type', getTransitionLabel(event.transitionType)]
              : ['Navigation Type', getSpaNavigationLabel(event.navigationType)],
            ['URL', event.url ?? '—'],
            ['Host', event.host ?? '—'],
            ['Path', event.path ?? '—'],
            ['Query', event.qs ?? '—'],
            ['Timestamp', formatTimestamp(event.ts)],
            ['ID', event.id != null ? String(event.id) : '—'],
          ]}
        />
        {isFullNavigation && event.transitionQualifiers && event.transitionQualifiers.length > 0 && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Qualifiers</p>
            <div className="flex flex-wrap gap-1">
              {event.transitionQualifiers.map((qualifier) => (
                <DetailChip key={qualifier}>{qualifier}</DetailChip>
              ))}
            </div>
          </div>
        )}
      </DetailCard>

      {isSpaNavigation && event.previousUrl && (
        <DetailCard title="Previous Location">
          <DetailList
            entries={[
              ['URL', event.previousUrl ?? '—'],
              ['Host', event.previousHost ?? '—'],
              ['Path', event.previousPath ?? '—'],
              ['Query', event.previousQs ?? '—'],
            ]}
          />
        </DetailCard>
      )}

      {!isSpaNavigation && (
        <DetailCard title="Requests Triggered">
          {related.length === 0 ? (
            <p className="text-sm text-gray-400">No matching requests captured for this navigation.</p>
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
      )}

      {isSpaNavigation && (
        <DetailCard title="Requests Triggered">
          {related.length === 0 ? (
            <p className="text-sm text-gray-400">No matching requests captured for this navigation.</p>
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
      )}
    </div>
  )
}
