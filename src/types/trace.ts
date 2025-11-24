export type TraceKind = 'click' | 'request' | string

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
}

export interface TraceFile {
  videoStartedAt?: number
  videoAvailable?: boolean
  events?: TraceEvent[]
}

