export type TraceKind = 'click' | 'request' | 'navigation' | 'spa-navigation' | string

// Navigation transition types from chrome.webNavigation API
export type NavigationTransitionType =
  | 'link'
  | 'typed'
  | 'auto_bookmark'
  | 'auto_subframe'
  | 'manual_subframe'
  | 'generated'
  | 'start_page'
  | 'form_submit'
  | 'reload'
  | 'keyword'
  | 'keyword_generated'

// SPA navigation types from history API
export type SpaNavigationType = 'pushState' | 'replaceState' | 'popstate' | 'hashchange'

export interface TraceCapturedBody {
  mimeType?: string
  encoding?: string
  text?: string
  content?: string
}

export interface TraceNetworkTimings {
  blocked?: number
  dns?: number
  ssl?: number
  connect?: number
  send?: number
  wait?: number
  receive?: number
  _blocked_queueing?: number
  _workerStart?: number
  _workerReady?: number
  _workerFetchStart?: number
  _workerRespondWithSettled?: number
}

export interface TraceEvent {
  id?: number | string
  kind: TraceKind
  jrInternalId?: string
  selector?: string
  text?: string
  label?: string
  path?: string
  url?: string
  host?: string
  qs?: string | null
  targetUrl?: string
  targetHost?: string
  targetPath?: string
  targetQs?: string | null
  initiator?: string
  method?: string
  status?: number
  statusText?: string
  ts?: number
  frameId?: number
  tabId?: number
  requestId?: number | string
  type?: string
  protocol?: string
  nextHopProtocol?: string
  startTime?: number
  responseStart?: number
  responseEnd?: number
  duration?: number
  transferSize?: number
  encodedBodySize?: number
  decodedBodySize?: number
  contentType?: string
  requestBody?: TraceCapturedBody | null
  responseBody?: TraceCapturedBody | null
  timings?: TraceNetworkTimings
  // Navigation event fields (from webNavigation.onCommitted)
  transitionType?: NavigationTransitionType
  transitionQualifiers?: string[]
  // SPA navigation event fields (from history API)
  navigationType?: SpaNavigationType
  previousUrl?: string
  previousHost?: string
  previousPath?: string
  previousQs?: string | null
}

export interface TraceFile {
  videoStartedAt?: number
  videoAvailable?: boolean
  events?: TraceEvent[]
}

