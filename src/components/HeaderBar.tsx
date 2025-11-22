import type { ReactNode } from 'react'

type HeaderBarProps = {
  mode?: string
  children?: ReactNode
}

const HeaderBar = ({ mode = 'Prototype', children }: HeaderBarProps) => {
  return (
    <header className="border-b border-borderMuted bg-panel/80 px-6 py-5 backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Journey Viewer</p>
            <h1 className="text-2xl font-semibold text-gray-50">Session Explorer</h1>
          </div>
          <span className="rounded-full border border-borderMuted px-3 py-1 text-xs uppercase tracking-[0.4em] text-gray-400">
            {mode}
          </span>
        </div>
        {children}
      </div>
    </header>
  )
}

export default HeaderBar

