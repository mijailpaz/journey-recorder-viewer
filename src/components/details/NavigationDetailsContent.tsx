import type { TraceEvent } from '../../types/trace'
import type { TimelineMarker } from '../../types/timeline'
import { formatTimestamp } from '../../utils/formatters'
import { DetailCard } from '../shared/DetailCard'
import { DetailChip } from '../shared/DetailChip'
import { DetailList } from '../shared/DetailList'
import { InteractionTimingAnalysis } from './InteractionTimingAnalysis'
import { RequestWaterfall } from './RequestWaterfall'

type NavigationDetailsContentProps = {
  event: TraceEvent
  related: TraceEvent[]
  allMarkers?: TimelineMarker[]
  onNavigateToMarker?: (marker: TimelineMarker) => void
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

export const NavigationDetailsContent = ({ event, related, allMarkers, onNavigateToMarker }: NavigationDetailsContentProps) => {
  const isFullNavigation = event.kind === 'navigation'
  const isSpaNavigation = event.kind === 'spa-navigation'

  return (
    <div className="space-y-4">
      {/* Timing Analysis - User Experience Metrics */}
      {related.length > 0 && (
        <InteractionTimingAnalysis interactionTs={event.ts} requests={related} />
      )}

      {/* Request Waterfall Timeline */}
      {related.length > 0 && (
        <RequestWaterfall
          interactionTs={event.ts}
          requests={related}
          allMarkers={allMarkers}
          onNavigateToMarker={onNavigateToMarker}
        />
      )}

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
          <DetailCard title="Navigation Info">
            <p className="text-sm text-gray-400">
              This navigation triggered {related.length} request{related.length !== 1 ? 's' : ''}.
              See the waterfall above for timing details.
            </p>
          </DetailCard>
        )}
      </div>
    </div>
  )
}
