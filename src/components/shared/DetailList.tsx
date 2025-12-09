import type { ReactNode } from 'react'

type DetailListProps = {
  entries: Array<[string, ReactNode]>
}

export const DetailList = ({ entries }: DetailListProps) => (
  <dl className="space-y-1 text-sm text-gray-300">
    {entries.map(([label, value]) => (
      <div key={label} className="flex items-start justify-between gap-4">
        <dt className="flex-shrink-0 text-gray-500">{label}</dt>
        <dd className="min-w-0 break-words text-right text-gray-100">{value ?? '—'}</dd>
      </div>
    ))}
  </dl>
)
