import { ExternalLink } from 'lucide-react'

type FooterBarProps = {
  version?: string
  status: string
}

const CHANGELOG_URL = 'https://github.com/mijailpaz/journey-recorder-viewer/blob/main/CHANGELOG.md'

const FooterBar = ({ version = 'v0.7.0 - Quick Filters & Export/Import', status }: FooterBarProps) => {
  return (
    <footer className="border-t border-borderMuted bg-panel/80 px-6 py-3 text-sm text-gray-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>{version}</span>
          <a
            href={CHANGELOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-gray-500 transition hover:text-gray-300"
            title="View changelog"
          >
            <ExternalLink size={12} />
            <span className="text-xs">Changelog</span>
          </a>
        </div>
        <span>Status: {status}</span>
      </div>
    </footer>
  )
}

export default FooterBar

