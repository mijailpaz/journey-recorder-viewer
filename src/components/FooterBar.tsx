type FooterBarProps = {
  version?: string
  status: string
}

const FooterBar = ({ version = 'v0.5 – Polished Layout', status }: FooterBarProps) => {
  return (
    <footer className="border-t border-borderMuted bg-panel/80 px-6 py-3 text-sm text-gray-400">
      <div className="flex items-center justify-between">
        <span>{version}</span>
        <span>Status: {status}</span>
      </div>
    </footer>
  )
}

export default FooterBar

