import type { ReactNode } from 'react'
import type { TraceCapturedBody } from '../../types/trace'
import { decodeBodyContent, formatBodyPreview } from '../../utils/curlGenerator'
import { DetailCard } from '../shared/DetailCard'
import { DetailList } from '../shared/DetailList'

type BodyCardProps = {
  title: string
  body?: TraceCapturedBody | null
}

export const BodyCard = ({ title, body }: BodyCardProps) => {
  const decoded = decodeBodyContent(body)
  if (decoded == null) {
    return null
  }
  const formatted = formatBodyPreview(decoded)
  const metaEntries: Array<[string, ReactNode]> = []
  if (body?.mimeType) {
    metaEntries.push(['MIME Type', body.mimeType])
  }
  if (body?.encoding) {
    metaEntries.push(['Encoding', body.encoding])
  }
  metaEntries.push(['Length', `${decoded.length.toLocaleString()} chars`])

  return (
    <DetailCard title={title} className="md:col-span-2">
      <div className="space-y-3 text-sm text-gray-300">
        <DetailList entries={metaEntries} />
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-3 font-mono text-xs leading-relaxed text-gray-100">
          {formatted}
        </pre>
      </div>
    </DetailCard>
  )
}
