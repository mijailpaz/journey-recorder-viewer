type EventNumberBadgeProps = {
  number: number
  size?: 'sm' | 'md'
}

export const EventNumberBadge = ({ number, size = 'md' }: EventNumberBadgeProps) => {
  const sizeClasses = size === 'sm' ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]'
  const colorClasses = size === 'sm' ? 'border-gray-600 text-gray-500' : 'border-gray-500 text-gray-400'

  return (
    <span
      className={`flex items-center justify-center rounded-full border font-medium ${sizeClasses} ${colorClasses}`}
      title="Event trace number"
    >
      {number}
    </span>
  )
}
