import type { ReactNode } from 'react'

type DetailCardProps = {
  title: string
  children: ReactNode
  className?: string
}

export const DetailCard = ({ title, children, className = '' }: DetailCardProps) => (
  <div
    className={`min-w-0 overflow-hidden rounded-2xl border border-borderMuted bg-panelMuted px-4 py-3 ${className}`}
  >
    <p className="mb-2 text-xs uppercase tracking-[0.3em] text-gray-500">{title}</p>
    <div className="min-w-0">{children}</div>
  </div>
)
