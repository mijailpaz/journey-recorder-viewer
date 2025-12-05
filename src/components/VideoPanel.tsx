import { forwardRef, type SyntheticEvent } from 'react'

type VideoPanelProps = {
  src?: string | null
  fileName?: string
  onTimeUpdate?: (currentTimeMs: number) => void
  onDuration?: (durationMs: number) => void
}

const VideoPanel = forwardRef<HTMLVideoElement, VideoPanelProps>(
  ({ src, fileName, onTimeUpdate, onDuration }, ref) => {
    const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement, Event>) => {
      onTimeUpdate?.(event.currentTarget.currentTime * 1000)
    }

    const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement, Event>) => {
      onDuration?.(event.currentTarget.duration * 1000)
    }

    return (
      <section className="panel flex h-full max-h-[70vh] flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span className="font-medium text-gray-100">Session Video</span>
          {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border border-borderMuted bg-black">
          {src ? (
            <video
              ref={ref}
              key={src}
              controls
              className="h-full w-full bg-black object-contain"
              src={src}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Load a .webm file to start playback
            </div>
          )}
        </div>
      </section>
    )
  },
)

VideoPanel.displayName = 'VideoPanel'

export default VideoPanel

