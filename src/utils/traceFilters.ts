import type { TraceEvent } from '../types/trace'

type FilterRuleTarget = 'url' | 'method' | 'status'

type FilterRule = {
  target: FilterRuleTarget
  regex: RegExp
}

type CompiledFilterGroup = {
  id: string
  label: string
  rules: FilterRule[]
}

export type TraceFilterCounts = Record<string, number>

export type TraceFilterGroupTemplate = {
  id: string
  label: string
  description: string
  defaultEnabled?: boolean
  patterns: string[]
}

export type TraceFilterGroupSetting = {
  id: string
  label: string
  description: string
  enabled: boolean
  patternsText: string
}

export type TraceFilterSettings = {
  applyFilters: boolean
  customRegexText: string
  groups: TraceFilterGroupSetting[]
}

export const FILTER_GROUP_TEMPLATES: TraceFilterGroupTemplate[] = [
  {
    id: 'static-assets',
    label: 'Static assets',
    description: 'Images, CSS, fonts, and Next.js chunks.',
    defaultEnabled: true,
    patterns: [
      '\\.(png|jpg|jpeg|gif|svg|webp|ico)(\\?.*)?$',
      '\\.(css|scss|woff2?|ttf|otf)(\\?.*)?$',
      '/_next/static/',
      'assets-event-page\\.svc\\.sympla\\.com\\.br/_next/',
    ],
  },
  {
    id: 'tracking',
    label: 'Tracking & analytics',
    description: 'GA, TikTok, Facebook, Bing, etc.',
    defaultEnabled: true,
    patterns: [
      'google-analytics\\.com',
      'googletagmanager\\.com',
      'g\\.doubleclick\\.net',
      'pagead2\\.googlesyndication\\.com',
      'facebook\\.net',
      'analytics\\.tiktok\\.com',
      'clarity\\.ms',
      'bat\\.bing\\.com',
      'topsort',
      'cdn\\.cookielaw\\.org',
    ],
  },
  {
    id: 'extensions',
    label: 'Chrome extensions',
    description: 'Extension self-requests (chrome-extension://).',
    defaultEnabled: true,
    patterns: ['^chrome-extension://'],
  },
  {
    id: 'preflight',
    label: 'CORS preflight & cached',
    description: 'OPTIONS requests and 304 responses.',
    defaultEnabled: true,
    patterns: ['method:^OPTIONS$'],
  },
]

export const createDefaultFilterSettings = (): TraceFilterSettings => ({
  applyFilters: true,
  customRegexText: '',
  groups: FILTER_GROUP_TEMPLATES.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    enabled: group.defaultEnabled !== false,
    patternsText: group.patterns.join('\n'),
  })),
})

const buildRegExp = (pattern: string) => {
  try {
    const literalMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/)
    if (literalMatch) {
      return new RegExp(literalMatch[1], literalMatch[2])
    }
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

const buildRuleFromLine = (line: string): FilterRule | null => {
  let target: FilterRuleTarget = 'url'
  let pattern = line

  if (line.startsWith('method:')) {
    target = 'method'
    pattern = line.slice(7).trim()
  } else if (line.startsWith('status:')) {
    target = 'status'
    pattern = line.slice(7).trim()
  }

  if (!pattern) {
    return null
  }

  const regex = buildRegExp(pattern)
  if (!regex) {
    return null
  }

  return { target, regex }
}

const parseRulesFromText = (text: string) => {
  if (!text) {
    return []
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => buildRuleFromLine(line))
    .filter((rule): rule is FilterRule => Boolean(rule))
}

const compileActiveGroups = (
  settings: TraceFilterSettings,
): CompiledFilterGroup[] => {
  const groups: CompiledFilterGroup[] = []
  settings.groups.forEach((group) => {
    if (!group.enabled) {
      return
    }
    const rules = parseRulesFromText(group.patternsText)
    if (rules.length > 0) {
      groups.push({
        id: group.id,
        label: group.label,
        rules,
      })
    }
  })

  const customRules = parseRulesFromText(settings.customRegexText)
  if (customRules.length > 0) {
    groups.push({ id: 'custom', label: 'Custom', rules: customRules })
  }

  return groups
}

const getEventFieldByTarget = (event: TraceEvent, target: FilterRuleTarget) => {
  if (target === 'method') {
    return event.method || ''
  }
  if (target === 'status') {
    return String(event.status ?? '')
  }
  return event.url || event.path || ''
}

const matchEventAgainstGroups = (
  event: TraceEvent,
  groups: CompiledFilterGroup[],
) => {
  for (const group of groups) {
    for (const rule of group.rules) {
      const value = getEventFieldByTarget(event, rule.target)
      if (value && rule.regex.test(value)) {
        return group.id
      }
    }
  }
  return null
}

export const applyTraceFilters = (
  events: TraceEvent[],
  settings: TraceFilterSettings,
): { filteredEvents: TraceEvent[]; ignoredCounts: TraceFilterCounts } => {
  if (!settings.applyFilters) {
    return { filteredEvents: [...events], ignoredCounts: {} }
  }

  const activeGroups = compileActiveGroups(settings)
  if (activeGroups.length === 0) {
    return { filteredEvents: [...events], ignoredCounts: {} }
  }

  const ignoredCounts: TraceFilterCounts = {}
  const filteredEvents: TraceEvent[] = []

  events.forEach((event) => {
    if (event.kind !== 'request') {
      filteredEvents.push(event)
      return
    }
    const matchedGroupId = matchEventAgainstGroups(event, activeGroups)
    if (matchedGroupId) {
      ignoredCounts[matchedGroupId] = (ignoredCounts[matchedGroupId] || 0) + 1
      return
    }
    filteredEvents.push(event)
  })

  return { filteredEvents, ignoredCounts }
}


