import { ArrowRight, Globe, Mouse, User } from 'lucide-react'
import { EventNumberBadge } from './EventNumberBadge'

type FlowBadgeProps = {
  origin?: string | null
  message: string
  destination?: string | null
  isClick?: boolean
  eventNumber?: number
}

export const FlowBadge = ({
  origin,
  message,
  destination,
  isClick = false,
  eventNumber,
}: FlowBadgeProps) => (
  <div className="flex items-center gap-2.5 flex-wrap mt-2">
    {typeof eventNumber === 'number' && <EventNumberBadge number={eventNumber} size="md" />}
    {origin && (
      <>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-borderMuted bg-panel px-3 py-1 text-base font-medium text-gray-100">
          {isClick ? <User size={14} /> : <Globe size={14} />}
          {origin}
        </span>
        <ArrowRight size={16} className="text-gray-500" />
      </>
    )}
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-base font-medium text-blue-300">
      {isClick && <Mouse size={14} />}
      {message}
    </span>
    {destination && (
      <>
        <ArrowRight size={16} className="text-gray-500" />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-borderMuted bg-panel px-3 py-1 text-base font-medium text-gray-100">
          <Globe size={14} />
          {destination}
        </span>
      </>
    )}
  </div>
)
