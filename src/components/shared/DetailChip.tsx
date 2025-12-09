import type { ReactNode } from 'react'

type DetailChipProps = {
  children: ReactNode
  color?: string
  className?: string
}

export const DetailChip = ({ children, color, className = '' }: DetailChipProps) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border border-borderMuted bg-panel px-2.5 py-0.5 text-sm font-medium text-gray-100 ${className}`}
    style={color ? { color, borderColor: color + '4d', backgroundColor: color + '1a' } : undefined}
  >
    {children}
  </span>
)
