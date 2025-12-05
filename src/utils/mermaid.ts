import type { TraceEvent } from '../types/trace'

const TELEMETRY_HOST_PATTERNS = ['online-metrix', 'doubleclick', 'pixel']
const TELEMETRY_PATH_PATTERNS = ['pixel', 'clear', 'beacon', 'collect']
const MAX_LABEL_LENGTH = 140

type RequestLine = {
  host: string
  description: string
  skipResponse?: boolean
}

const truncate = (text: string, length: number) => {
  if (text.length <= length) {
    return text
  }
  return `${text.slice(0, length - 1)}…`
}

const sanitize = (text: string) => String(text ?? '').replace(/"/g, '\\"')

const stripMatrixParams = (pathname: string) =>
  pathname
    .split('/')
    .map((segment) => segment.split(';')[0] ?? '')
    .join('/')

const normalizePath = (pathname: string | null | undefined) => {
  if (!pathname) {
    return '/'
  }
  const withoutMatrix = stripMatrixParams(pathname)
  const normalized = withoutMatrix.replace(/\/+/g, '/')
  return normalized || '/'
}

const stripQueryAndFragment = (value: string) => {
  if (!value) {
    return ''
  }
  const index = value.search(/[?#]/)
  const base = index === -1 ? value : value.slice(0, index)
  return stripMatrixParams(base)
}

const getDefaultClickLabel = (event: TraceEvent) => {
  const base = (event.text || event.selector || event.label || 'Click').replace(/\s+/g, ' ').trim()
  return base || 'Click'
}

const getClickLabel = (event: TraceEvent) => {
  const explicit = typeof event.label === 'string' ? event.label.trim() : ''
  if (explicit) {
    return explicit
  }
  return getDefaultClickLabel(event)
}

const safeUrl = (value: string | undefined) => {
  if (!value) {
    return null
  }
  try {
    return new URL(value)
  } catch {
    try {
      return new URL(`https://${value}`)
    } catch {
      return null
    }
  }
}

const isTelemetryRequest = (url: URL) => {
  const host = (url.host || '').toLowerCase()
  const path = (url.pathname || '').toLowerCase()
  if (!host && !path) {
    return false
  }
  return (
    TELEMETRY_HOST_PATTERNS.some((pattern) => host.includes(pattern)) ||
    TELEMETRY_PATH_PATTERNS.some((pattern) => path.includes(pattern))
  )
}

const formatPathWithParams = (url: URL, { isTelemetry = false } = {}) => {
  const pathname = normalizePath(url.pathname || '/')
  const label = isTelemetry ? `Beacon ${pathname}` : pathname
  return truncate(label, MAX_LABEL_LENGTH)
}

const normalizeHost = (host: string | null | undefined) => {
  if (!host) {
    return 'server'
  }
  return host.replace(/^www\./i, '')
}

const isDataUrl = (value: string | undefined) =>
  typeof value === 'string' && value.startsWith('data:')

const summarizeDataUrl = (value: string) => {
  const match = /^data:([^;,]+)/.exec(value)
  const mime = match ? match[1] : 'embedded asset'
  return mime.length > 40 ? `${mime.slice(0, 39)}…` : `data:${mime}`
}

const formatRequestForMermaid = (event: TraceEvent): RequestLine | null => {
  const method = event.method || 'GET'
  const urlString = event.url || event.targetUrl || event.path || ''

  if (!urlString) {
    return { host: 'server', description: `${method} request` }
  }

  if (isDataUrl(urlString)) {
    return {
      host: 'embedded_asset',
      description: `${method} ${summarizeDataUrl(urlString)}`,
      skipResponse: true,
    }
  }

  const url = safeUrl(urlString)
  if (!url) {
    return {
      host: 'server',
      description: `${method} ${truncate(stripQueryAndFragment(urlString), MAX_LABEL_LENGTH)}`,
    }
  }

  const host = normalizeHost(url.host)
  const description = `${method} ${formatPathWithParams(url, { isTelemetry: isTelemetryRequest(url) })}`
  return {
    host,
    description,
    skipResponse: false,
  }
}

const extractSiteHost = (events?: TraceEvent[] | null): string => {
  if (!events || events.length === 0) {
    return 'WebApp'
  }
  const firstClickWithHost = events.find((e) => e.kind === 'click' && e.host)
  if (!firstClickWithHost?.host) {
    return 'WebApp'
  }
  return normalizeHost(firstClickWithHost.host)
}

export const generateMermaidFromTrace = (events?: TraceEvent[] | null): string => {
  const siteHost = extractSiteHost(events)
  const lines = ['sequenceDiagram', '  autonumber']
  if (!events || events.length === 0) {
    lines.push(`  Note over User,${siteHost}: No events recorded`)
    return lines.join('\n')
  }

  let hasOutput = false
  let hasActiveClick = false

  events.forEach((event) => {
    if (event.kind === 'click') {
      const label = getClickLabel(event)
      if (event.id !== undefined) {
        lines.push(`  %%${event.id}`)
      }
      lines.push(`  User->>${siteHost}: Click "${sanitize(label)}"`)
      hasOutput = true
      hasActiveClick = true
      return
    }

    if (event.kind === 'request') {
      if (!hasActiveClick) {
        return
      }
      const requestLine = formatRequestForMermaid(event)
      if (!requestLine) {
        return
      }
      if (event.id !== undefined) {
        lines.push(`  %%${event.id}`)
      }
      lines.push(`  ${siteHost}->>${requestLine.host}: ${requestLine.description}`)
      if (!requestLine.skipResponse) {
        const status = event.status ?? 'unknown'
        const statusText = (event.statusText || '').trim()
        lines.push(`  ${requestLine.host}-->>${siteHost}: ${status}${statusText ? ` ${statusText}` : ''}`)
      }
      hasOutput = true
    }
  })

  if (!hasOutput) {
    lines.push(`  Note over User,${siteHost}: No click-driven events recorded`)
  }

  return lines.join('\n')
}

export default generateMermaidFromTrace

