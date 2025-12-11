import type { TraceEvent } from '../types/trace'
import { decodeBodyContent } from './curlGenerator'

interface PostmanHeader {
  key: string
  value: string
}

interface PostmanQueryParam {
  key: string
  value: string
}

interface PostmanUrl {
  raw: string
  protocol?: string
  host?: string[]
  path?: string[]
  query?: PostmanQueryParam[]
}

interface PostmanBody {
  mode: 'raw'
  raw: string
  options?: {
    raw: {
      language: string
    }
  }
}

interface PostmanRequest {
  method: string
  header: PostmanHeader[]
  url: PostmanUrl
  body?: PostmanBody
}

interface PostmanItem {
  name: string
  request: PostmanRequest
  response: never[]
}

interface PostmanCollection {
  info: {
    _postman_id: string
    name: string
    schema: string
    description?: string
  }
  item: PostmanItem[]
}

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const parseUrl = (url: string): PostmanUrl => {
  const result: PostmanUrl = { raw: url }

  try {
    const parsed = new URL(url)
    result.protocol = parsed.protocol.replace(':', '')
    result.host = parsed.hostname.split('.')
    result.path = parsed.pathname.split('/').filter(Boolean)

    if (parsed.search) {
      const queryParams: PostmanQueryParam[] = []
      parsed.searchParams.forEach((value, key) => {
        queryParams.push({ key, value })
      })
      if (queryParams.length > 0) {
        result.query = queryParams
      }
    }
  } catch {
    // If URL parsing fails, just use the raw URL
  }

  return result
}

const getLanguageFromContentType = (contentType?: string): string => {
  if (!contentType) return 'text'
  if (contentType.includes('json')) return 'json'
  if (contentType.includes('xml')) return 'xml'
  if (contentType.includes('html')) return 'html'
  if (contentType.includes('javascript')) return 'javascript'
  return 'text'
}

const convertEventToPostmanItem = (event: TraceEvent, index: number): PostmanItem | null => {
  if (!event.url || !event.method) {
    return null
  }

  const headers: PostmanHeader[] = []

  // Add content type header
  if (event.contentType) {
    headers.push({ key: 'Content-Type', value: event.contentType })
  } else if (event.requestBody?.mimeType) {
    headers.push({ key: 'Content-Type', value: event.requestBody.mimeType })
  }

  // Add Accept header for JSON responses
  if (event.contentType?.includes('json') || event.responseBody?.mimeType?.includes('json')) {
    headers.push({ key: 'Accept', value: 'application/json' })
  }

  const request: PostmanRequest = {
    method: event.method.toUpperCase(),
    header: headers,
    url: parseUrl(event.url),
  }

  // Add request body if present
  if (event.requestBody) {
    const bodyContent = decodeBodyContent(event.requestBody)
    if (bodyContent) {
      const mimeType = event.requestBody.mimeType || event.contentType || 'application/json'
      request.body = {
        mode: 'raw',
        raw: bodyContent,
        options: {
          raw: {
            language: getLanguageFromContentType(mimeType),
          },
        },
      }
    }
  }

  // Generate a descriptive name for the request
  const method = event.method.toUpperCase()
  const path = event.path || event.targetPath || new URL(event.url).pathname
  const status = event.status ? ` (${event.status})` : ''
  const name = `${method} ${path}${status}`

  return {
    name: name || `Request ${index + 1}`,
    request,
    response: [],
  }
}

export const generatePostmanCollection = (
  events: TraceEvent[],
  collectionName?: string,
): PostmanCollection => {
  // Filter only request events
  const requestEvents = events.filter((event) => event.kind === 'request')

  const items: PostmanItem[] = []
  requestEvents.forEach((event, index) => {
    const item = convertEventToPostmanItem(event, index)
    if (item) {
      items.push(item)
    }
  })

  return {
    info: {
      _postman_id: generateUUID(),
      name: collectionName || `Journey Recorder Export - ${new Date().toISOString().split('T')[0]}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: `Exported from Journey Recorder Viewer on ${new Date().toLocaleString()}`,
    },
    item: items,
  }
}

export const downloadPostmanCollection = (events: TraceEvent[], collectionName?: string): void => {
  const collection = generatePostmanCollection(events, collectionName)
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${collection.info.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.postman_collection.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
