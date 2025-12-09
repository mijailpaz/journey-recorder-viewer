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

const getClickHost = (event: TraceEvent): string => {
  if (event.host) {
    return normalizeHost(event.host)
  }
  return 'WebApp'
}

const getClickTargetHost = (event: TraceEvent): string | null => {
  if (event.targetHost && event.host) {
    const normalized = normalizeHost(event.targetHost)
    const currentNormalized = normalizeHost(event.host)
    // Only return targetHost if it's different from current host
    if (normalized !== currentNormalized) {
      return normalized
    }
  }
  return null
}

const getNavigationLabel = (event: TraceEvent): string => {
  const transitionType = event.transitionType || 'navigate'
  const path = normalizePath(event.path)
  
  const transitionLabels: Record<string, string> = {
    typed: 'Navigate (typed)',
    reload: 'Reload',
    link: 'Navigate',
    auto_bookmark: 'Navigate (bookmark)',
    form_submit: 'Form Submit',
    back_forward: 'Back/Forward',
  }
  
  const label = transitionLabels[transitionType] || 'Navigate'
  return `${label} ${truncate(path, MAX_LABEL_LENGTH - label.length - 1)}`
}

const getSpaNavigationLabel = (event: TraceEvent): string => {
  const navType = event.navigationType || 'navigate'
  const path = normalizePath(event.path)
  
  const navLabels: Record<string, string> = {
    pushState: 'Route to',
    replaceState: 'Replace route',
    popstate: 'Back/Forward',
    hashchange: 'Hash change',
  }
  
  const label = navLabels[navType] || 'Navigate'
  return `${label} ${truncate(path, MAX_LABEL_LENGTH - label.length - 1)}`
}

export const generateMermaidFromTrace = (events?: TraceEvent[] | null): string => {
  const lines = ['sequenceDiagram', '  autonumber']
  if (!events || events.length === 0) {
    lines.push('  Note over User,WebApp: No events recorded')
    return lines.join('\n')
  }

  let hasOutput = false
  let hasActiveInteraction = false
  let currentHost = 'WebApp'

  events.forEach((event) => {
    if (event.kind === 'click') {
      const clickHost = getClickHost(event)
      const targetHost = getClickTargetHost(event)
      const label = getClickLabel(event)
      
      if (event.id !== undefined) {
        lines.push(`  %%${event.id}`)
      }
      lines.push(`  User->>${clickHost}: Click "${sanitize(label)}"`)
      hasOutput = true
      hasActiveInteraction = true
      
      // If click navigates to a different host, show the navigation
      if (targetHost) {
        lines.push(`  ${clickHost}->>${targetHost}: Navigate`)
        currentHost = targetHost
      } else {
        currentHost = clickHost
      }
      return
    }

    if (event.kind === 'navigation') {
      const navHost = event.host ? normalizeHost(event.host) : 'WebApp'
      const label = getNavigationLabel(event)
      
      if (event.id !== undefined) {
        lines.push(`  %%${event.id}`)
      }
      
      // Navigation is a user-initiated page load
      if (currentHost !== navHost) {
        lines.push(`  User->>${navHost}: ${sanitize(label)}`)
      } else {
        lines.push(`  User->>${currentHost}: ${sanitize(label)}`)
      }
      
      hasOutput = true
      hasActiveInteraction = true
      currentHost = navHost
      return
    }

    if (event.kind === 'spa-navigation') {
      const targetHost = event.host ? normalizeHost(event.host) : currentHost
      const label = getSpaNavigationLabel(event)
      
      if (event.id !== undefined) {
        lines.push(`  %%${event.id}`)
      }
      
      // SPA navigation is typically within the same app
      if (currentHost !== targetHost) {
        lines.push(`  ${currentHost}->>${targetHost}: ${sanitize(label)}`)
      } else {
        lines.push(`  ${currentHost}->>${currentHost}: ${sanitize(label)}`)
      }
      
      hasOutput = true
      hasActiveInteraction = true
      currentHost = targetHost
      return
    }

    if (event.kind === 'request') {
      if (!hasActiveInteraction) {
        return
      }
      const requestLine = formatRequestForMermaid(event)
      if (!requestLine) {
        return
      }
      if (event.id !== undefined) {
        lines.push(`  %%${event.id}`)
      }
      lines.push(`  ${currentHost}->>${requestLine.host}: ${requestLine.description}`)
      if (!requestLine.skipResponse) {
        const status = event.status ?? 'unknown'
        const statusText = (event.statusText || '').trim()
        lines.push(`  ${requestLine.host}-->>${currentHost}: ${status}${statusText ? ` ${statusText}` : ''}`)
      }
      hasOutput = true
    }
  })

  if (!hasOutput) {
    lines.push('  Note over User,WebApp: No interaction events recorded')
  }

  return lines.join('\n')
}

export default generateMermaidFromTrace

