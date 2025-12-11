import { memo } from 'react'

const pulseClass = 'animate-pulse bg-gray-700/50'

/**
 * Skeleton placeholder for the diagram panel while Mermaid renders
 */
export const DiagramSkeleton = memo(() => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
    {/* Fake sequence diagram boxes */}
    <div className="flex w-full max-w-md items-center justify-between gap-8">
      <div className={`h-10 w-20 rounded ${pulseClass}`} />
      <div className={`h-10 w-24 rounded ${pulseClass}`} />
      <div className={`h-10 w-20 rounded ${pulseClass}`} />
    </div>
    {/* Fake arrows/lines */}
    <div className="flex w-full max-w-md flex-col gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-1 flex-1 rounded ${pulseClass}`} style={{ animationDelay: `${i * 100}ms` }} />
          <div className={`h-4 w-16 rounded ${pulseClass}`} style={{ animationDelay: `${i * 100}ms` }} />
        </div>
      ))}
    </div>
    {/* Loading text */}
    <p className="mt-4 text-xs text-gray-500">Rendering diagram...</p>
  </div>
))

DiagramSkeleton.displayName = 'DiagramSkeleton'

/**
 * Skeleton placeholder for a single timeline track
 */
export const TrackSkeleton = memo(({ isPinned = false }: { isPinned?: boolean }) => (
  <div className={isPinned ? '' : 'space-y-1'}>
    {!isPinned && <div className={`h-3 w-20 rounded ${pulseClass}`} />}
    <div
      className={`relative border border-borderMuted bg-panelMuted/80 ${
        isPinned ? 'h-5 px-2 rounded' : 'h-12 px-3 py-3 rounded-lg'
      }`}
    >
      <div className={isPinned ? 'absolute inset-0.5' : 'absolute inset-3'}>
        {/* Fake markers */}
        {[10, 25, 40, 55, 70, 85].map((pos) => (
          <div
            key={pos}
            className="absolute bottom-0"
            style={{ left: `${pos}%` }}
          >
            <div
              className={`${isPinned ? 'h-3 w-[2px]' : 'h-6 w-[3px]'} rounded-full ${pulseClass}`}
              style={{ animationDelay: `${pos * 10}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  </div>
))

TrackSkeleton.displayName = 'TrackSkeleton'

/**
 * Skeleton for the journey panel header area
 */
export const JourneyHeaderSkeleton = memo(() => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <div className={`h-3 w-16 rounded ${pulseClass}`} />
        <div className={`h-3 w-24 rounded ${pulseClass}`} />
      </div>
      <div className={`h-5 w-48 rounded ${pulseClass}`} />
    </div>
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`h-7 w-7 rounded-lg ${pulseClass}`} />
      ))}
    </div>
  </div>
))

JourneyHeaderSkeleton.displayName = 'JourneyHeaderSkeleton'

/**
 * Skeleton for the metadata chips row
 */
export const MetadataChipsSkeleton = memo(() => (
  <div className="flex flex-wrap items-center gap-2 mb-3">
    <div className={`h-5 w-6 rounded-full ${pulseClass}`} />
    <div className={`h-5 w-16 rounded-full ${pulseClass}`} />
    <div className={`h-5 w-20 rounded-full ${pulseClass}`} />
    <div className={`h-5 w-24 rounded-full ${pulseClass}`} />
  </div>
))

MetadataChipsSkeleton.displayName = 'MetadataChipsSkeleton'

/**
 * Full journey panel skeleton combining all elements
 */
export const JourneyPanelSkeleton = memo(({ isPinned = false }: { isPinned?: boolean }) => (
  <div
    className={`rounded-2xl border border-borderMuted bg-panelMuted/90 ${
      isPinned
        ? 'fixed left-0 right-0 z-[10000] w-screen border-t shadow-2xl px-4 py-3'
        : 'px-4 py-4'
    }`}
    style={isPinned ? { bottom: 0 } : undefined}
  >
    <JourneyHeaderSkeleton />
    <MetadataChipsSkeleton />
    <div className="flex gap-3">
      <div className="flex-1 space-y-1.5">
        <TrackSkeleton isPinned={isPinned} />
        <TrackSkeleton isPinned={isPinned} />
      </div>
    </div>
  </div>
))

JourneyPanelSkeleton.displayName = 'JourneyPanelSkeleton'

/**
 * Spinner overlay for use during loading states
 */
export const LoadingSpinner = memo(({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg
    className={`animate-spin text-gray-400 ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
))

LoadingSpinner.displayName = 'LoadingSpinner'

/**
 * Loading overlay that can be placed over any content
 */
export const LoadingOverlay = memo(({ message }: { message?: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-panelMuted/80 backdrop-blur-sm z-10 rounded-lg">
    <LoadingSpinner size={32} />
    {message && <p className="mt-3 text-sm text-gray-400">{message}</p>}
  </div>
))

LoadingOverlay.displayName = 'LoadingOverlay'
