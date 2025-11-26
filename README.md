# Journey Recorder Viewer

A React-based web application for viewing and analyzing recorded user journey sessions. This viewer is a companion tool for the [Journey Flow Recorder](https://github.com/mijailpaz/journey-recorder) Chrome extension, providing an interactive interface to replay and analyze recorded sessions.

## Overview

The Journey Recorder Viewer loads two files exported by the Chrome extension:
- **Session Video** (`.webm`) - Recorded screen capture of the user session
- **Trace JSON** (`.json`) - Timestamped events including clicks and network requests
- **Sequence Diagram** – Generated automatically from the trace JSON (no separate `.mmd` upload required)

Video playback stays synchronized with event markers on an interactive timeline so you can navigate through recorded sessions and understand the relationship between user interactions and network activity.

## Features

- **Video Playback** - Play recorded session videos with standard video controls
- **Interactive Timeline** - Visualize click events and network requests on synchronized timeline tracks
- **Playback Sync** - Red indicator line shows current video position across timeline tracks
- **Click-to-Seek** - Click any timeline marker to jump the video to that moment
- **Sequence Diagram** - View Mermaid sequence diagrams rendered with dark theme
- **Auto-Generated Diagrams** - Build Mermaid sequence diagrams directly from the trace JSON—always in sync with the timeline data
- **Mouse Navigation** - Drag to pan and hold Ctrl (or ⌘ on macOS) while scrolling to zoom in/out in both the panel and fullscreen preview
- **Mermaid Export** - Download the generated `.mmd` file to share or tweak the diagram elsewhere
- **Event Editing** - Update click/request labels or remove noisy events right from the Current Journey Item panel
- **Trace Filtering** - Apply the Chrome extension’s preset/custom regex filters and preview the JSON output before exporting
- **File Management** - Load files individually or together, with clear status indicators
- **Modern UI** - Dark theme with polished design using Tailwind CSS

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Mermaid** - Diagram rendering

## Project Structure

```
journey-recorder-viewer/
├── src/
│   ├── components/
│   │   ├── DiagramPanel.tsx    # Mermaid diagram renderer
│   │   ├── FileInputs.tsx       # File picker components
│   │   ├── FooterBar.tsx        # Status footer
│   │   ├── HeaderBar.tsx        # App header
│   │   ├── Timeline.tsx        # Interactive timeline tracks
│   │   └── VideoPanel.tsx       # Video player component
│   ├── types/
│   │   └── trace.ts             # TypeScript types for trace data
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── public/                       # Static assets
├── dist/                         # Build output
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Prerequisites

- **Node.js** 20.19+ or 22.12+ (recommended)
- **npm** or **yarn**

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd journey-recorder-viewer
```

2. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in the terminal).

### Development Workflow

1. Start the dev server
2. Open the app in your browser
3. Use the file pickers in the header to load:
   - A `.webm` video file
   - A `.json` trace file
4. Once all files are loaded, you can:
   - Play the video and watch the red sync line move across the timeline
   - Click timeline markers to seek the video to specific events
   - Hover over markers to see event details

## Building for Production

Build the application:
```bash
npm run build
```

The production build will be output to the `dist/` directory.

Preview the production build:
```bash
npm run preview
```

## Usage

### Loading Files

1. **Load Session Video**: Click "Choose file" under "Session Video (.webm)" and select your exported video file
2. **Load Trace JSON**: Click "Choose file" under "Trace JSON" and select your exported trace file
Files can be loaded in any order. The status bar at the bottom shows the current state:
- "Waiting for files" - No files loaded
- "Waiting for remaining files" - Some files loaded
- "Files loaded – ready to replay" - All files loaded

### Exporting the Sequence Diagram

- Open the sequence diagram panel and use the download button in the top-right controls to save the current diagram as a `.mmd` file.
- Use the copy button to send the Mermaid source to your clipboard if you want to paste it elsewhere.
- The fullscreen button expands the diagram for easier inspection before exporting.

### Navigating the Sequence Diagram

- Drag anywhere on the diagram to pan the view. This works in both the in-panel view and the fullscreen preview.
- Hold Ctrl on Windows/Linux or ⌘ on macOS while using the scroll wheel (or two-finger trackpad scroll) to zoom in or out without touching the on-screen controls.
- Hit the reset control at any time to recenter the canvas if you lose track of the original framing.

### Interacting with the Timeline

- **Playback Sync**: As the video plays, a thin red line moves across both timeline tracks showing the current playback position
- **Click to Seek**: Click any yellow (click event) or blue (network request) marker on the timeline to jump the video to that moment
- **Hover for Details**: Hover over any marker to see detailed information about that event

### Timeline Tracks

- **Click Events** (Yellow markers): User interactions like button clicks, link clicks, etc.
- **Network Requests** (Blue markers): HTTP requests made during the session

## File Format Reference

### Trace JSON Format

The trace JSON file should follow this structure:

```json
{
  "videoStartedAt": 1234567890,
  "videoAvailable": true,
  "events": [
    {
      "id": 1,
      "kind": "click",
      "selector": "button.submit",
      "text": "Submit",
      "label": "Submit Button",
      "ts": 1234567891
    },
    {
      "id": 2,
      "kind": "request",
      "method": "POST",
      "path": "/api/submit",
      "status": 200,
      "ts": 1234567892
    }
  ]
}
```

## Relationship to Chrome Extension

This viewer is designed to work with the **Journey Flow Recorder** Chrome extension. The extension records user sessions and exports:

1. `journey.webm` - Screen recording
2. `trace.json` - Event timeline data
3. `flow.mmd` - Mermaid sequence diagram (not required by the viewer, which generates its own diagram from the trace)

After recording a session with the extension, use this viewer to:
- Review the recorded session
- Analyze the timing of user interactions
- Understand the relationship between clicks and network requests
- Share recorded sessions with team members

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Troubleshooting

### Video doesn't sync with timeline
- Ensure the trace JSON includes `videoStartedAt` field
- Verify the video file matches the trace file from the same recording session

### Mermaid diagram doesn't render
- Verify that the trace JSON includes click events followed by network requests—the viewer generates diagrams from this data
- Reload the trace file if it was edited manually

### Timeline markers don't appear
- Verify the trace JSON has an `events` array with valid event objects
- Check that events have `ts` (timestamp) fields

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Related Projects

- [Journey Flow Recorder](https://github.com/your-org/journey-recorder) - Chrome extension for recording user sessions
