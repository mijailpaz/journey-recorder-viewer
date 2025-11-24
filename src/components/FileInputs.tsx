import type { ChangeEvent } from 'react'

type FileInputProps = {
  id: string
  label: string
  accept: string
  onSelect: (file: File | null) => void
  fileName?: string
}

const FilePicker = ({ id, label, accept, onSelect, fileName }: FileInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    onSelect(file)
    // allow picking the same file twice
    event.target.value = ''
  }

  return (
    <label
      htmlFor={id}
      className="flex flex-1 min-w-[180px] cursor-pointer flex-col gap-1 rounded-lg border border-borderMuted bg-panelMuted/60 px-4 py-3 text-xs text-gray-400 transition hover:border-accent/60"
    >
      <span className="uppercase tracking-[0.2em]">{label}</span>
      <span className="text-sm text-gray-200">{fileName ?? 'No file selected'}</span>
      <span className="mt-1 inline-flex w-max items-center gap-2 rounded-md border border-borderMuted bg-panel px-2 py-1 text-[11px] uppercase tracking-wide text-gray-200">
        Choose file
      </span>
      <input id={id} type="file" accept={accept} onChange={handleChange} className="hidden" />
    </label>
  )
}

type FileInputsProps = {
  onVideoSelect: (file: File | null) => void
  onTraceSelect: (file: File | null) => void
  loadedNames: {
    video?: string
    trace?: string
  }
  errorMessage?: string | null
}

const FileInputs = ({ onVideoSelect, onTraceSelect, loadedNames, errorMessage }: FileInputsProps) => {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <FilePicker
          id="video-input"
          label="Session Video (.webm)"
          accept="video/webm,video/mp4"
          onSelect={onVideoSelect}
          fileName={loadedNames.video}
        />
        <FilePicker
          id="trace-input"
          label="Trace JSON"
          accept="application/json"
          onSelect={onTraceSelect}
          fileName={loadedNames.trace}
        />
      </div>
      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
    </div>
  )
}

export default FileInputs

