export type TraceKind = 'click' | 'request' | string

export interface TraceEvent {
  id?: number | string
  kind: TraceKind
  selector?: string
  text?: string
  label?: string
  path?: string
  url?: string
  targetUrl?: string
  method?: string
  status?: number
  statusText?: string
  ts?: number
}

export interface TraceFile {
  videoStartedAt?: number
  videoAvailable?: boolean
  events?: TraceEvent[]
}

