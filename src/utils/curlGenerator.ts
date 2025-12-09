import type { TraceCapturedBody, TraceEvent } from '../types/trace'

export const decodeBodyContent = (body?: TraceCapturedBody | null): string | null => {
  if (!body) {
    return null
  }
  const raw = body.text ?? body.content
  if (raw == null || typeof raw !== 'string') {
    return null
  }
  if (body.encoding?.toLowerCase() === 'base64') {
    try {
      if (typeof atob === 'function') {
        return atob(raw)
      }
    } catch {
      return raw
    }
  }
  return raw
}

export const formatBodyPreview = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return 'Body captured but empty.'
  }
  const firstChar = trimmed[0]
  if (firstChar === '{' || firstChar === '[') {
    try {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // ignore malformed JSON, show raw payload instead
    }
  }
  return raw
}

export const generateCurlCommand = (event: TraceEvent): string | null => {
  if (!event.url || !event.method) {
    return null
  }

  const parts: string[] = []
  parts.push('curl')
  parts.push('-v')

  const method = event.method.toUpperCase()
  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }

  let fullUrl = event.url
  if (event.qs && event.qs !== 'null') {
    const qs = event.qs.startsWith('?') ? event.qs.slice(1) : event.qs
    fullUrl = fullUrl.includes('?') ? `${fullUrl}&${qs}` : `${fullUrl}?${qs}`
  }

  parts.push(`'${fullUrl.replace(/'/g, "'\\''")}'`)

  const headers: string[] = []

  if (event.requestBody) {
    const mimeType = event.requestBody.mimeType || event.contentType || 'application/json'
    headers.push(`'Content-Type: ${mimeType}'`)
  } else if (event.contentType) {
    headers.push(`'Content-Type: ${event.contentType}'`)
  }

  if (event.contentType?.includes('json') || event.responseBody?.mimeType?.includes('json')) {
    headers.push("'Accept: application/json'")
  }

  headers.push(
    "'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'",
  )

  if (headers.length > 0) {
    headers.forEach((header) => {
      parts.push(`-H ${header}`)
    })
  }

  if (event.requestBody) {
    const bodyContent = decodeBodyContent(event.requestBody)
    if (bodyContent) {
      let formattedBody = bodyContent.trim()
      if (formattedBody.startsWith('{') || formattedBody.startsWith('[')) {
        try {
          const parsed = JSON.parse(formattedBody)
          formattedBody = JSON.stringify(parsed)
        } catch {
          // If parsing fails, use original
        }
      }
      const escapedBody = formattedBody.replace(/'/g, "'\\''")
      parts.push(`-d '${escapedBody}'`)
    }
  }

  return parts.join(' \\\n  ')
}
