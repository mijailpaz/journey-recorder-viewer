import type { TraceEvent } from '../../types/trace'
import type { TimelineMarker } from '../../types/timeline'
import { formatTimestamp } from '../../utils/formatters'
import { DetailCard } from '../shared/DetailCard'
import { DetailList } from '../shared/DetailList'
import { InteractionTimingAnalysis } from './InteractionTimingAnalysis'
import { RequestWaterfall } from './RequestWaterfall'

type ClickDetailsContentProps = {
  event: TraceEvent
  related: TraceEvent[]
  allMarkers?: TimelineMarker[]
  onNavigateToMarker?: (marker: TimelineMarker) => void
}

export const ClickDetailsContent = ({ event, related, allMarkers, onNavigateToMarker }: ClickDetailsContentProps) => {
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
        <DetailCard title="Click Target">
          <DetailList
            entries={[
              ['Target URL', event.targetUrl ?? '—'],
              ['Target Host', event.targetHost ?? '—'],
              ['Target Path', event.targetPath ?? '—'],
              ['Text', event.text ?? '—'],
            ]}
          />
        </DetailCard>
      </div>
    </div>
  )
}
