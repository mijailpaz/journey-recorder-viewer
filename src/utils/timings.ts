import type { ReactNode } from 'react'
import type { TraceNetworkTimings } from '../types/trace'
import { formatMs } from './formatters'

export const TIMING_ORDER: Array<keyof TraceNetworkTimings> = [
  'blocked',
  'dns',
  'connect',
  'ssl',
  'send',
  'wait',
  'receive',
  '_blocked_queueing',
  '_workerStart',
  '_workerReady',
  '_workerFetchStart',
  '_workerRespondWithSettled',
]

export const TIMING_LABELS: Record<keyof TraceNetworkTimings, string> = {
  blocked: 'Blocked',
  dns: 'DNS',
  connect: 'Connect',
  ssl: 'SSL',
  send: 'Send',
  wait: 'Wait / TTFB',
  receive: 'Receive',
  _blocked_queueing: 'Queueing',
  _workerStart: 'Worker start',
  _workerReady: 'Worker ready',
  _workerFetchStart: 'Worker fetch',
  _workerRespondWithSettled: 'Worker respond',
}

export const buildTimingEntries = (timings?: TraceNetworkTimings): Array<[string, ReactNode]> => {
  if (!timings) {
    return []
  }
  return TIMING_ORDER.reduce<Array<[string, ReactNode]>>((entries, key) => {
    const value = timings[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      entries.push([TIMING_LABELS[key] ?? key, formatMs(value)])
    }
    return entries
  }, [])
}
