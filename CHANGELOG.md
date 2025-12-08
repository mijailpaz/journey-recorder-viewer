# Changelog

All notable changes to the Journey Recorder Viewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.7.0] - 2025-12-08

### Added
- **Quick Filter from Journey Bar**: New filter button on request events to quickly add domain patterns to filter groups
- **Editable Filter Pattern**: Filter pattern input is now editable before adding, allowing custom regex modifications
- **Filter Toast Notifications**: Visual feedback showing how many requests match the newly added filter
- **Export/Import Filters**: Save and load filter configurations as JSON files for sharing or backup
- **Toast Animation**: Smooth fade-in animation for notifications

### Changed
- Filter button appears on all events but is disabled for click events (only enabled for requests)

---

## [0.6.0] - 2025-12-05

### Added
- **Trace Filtering System**: Filter out noisy requests using predefined groups or custom regex patterns
- **Filter Groups**: Preset filters for Static assets, Tracking & analytics, Chrome extensions, and CORS preflight requests
- **Custom Regex Filters**: Add your own patterns with support for method: and status: prefixes
- **Filter Statistics**: Real-time count of filtered events per group
- **JSON Preview**: Preview the filtered trace output before exporting
- **Download Filtered Trace**: Export the filtered trace as a new JSON file

---

## [0.5.0] - 2025-12-01

### Added
- **Event Editing**: Update click/request labels directly from the Journey panel
- **Event Removal**: Remove noisy events from the timeline and diagram
- **Restore Events**: Bring back removed events from the Trace Settings panel
- **Event Details Dialog**: View comprehensive event information including request/response bodies
- **cURL Command Generation**: Copy ready-to-use cURL commands for requests

---

## [0.4.0] - 2025-11-28

### Added
- **Journey Panel Navigation**: Previous/Next buttons to step through events
- **Pin Journey Panel**: Keep the panel fixed at the bottom while scrolling
- **Auto-zoom on Diagram**: Automatically center the diagram on the selected event
- **Event Number Badges**: Visual indicators for event sequence order

---

## [0.3.0] - 2025-11-25

### Added
- **Auto-Generated Sequence Diagrams**: Mermaid diagrams built directly from trace JSON
- **Diagram Export**: Download diagrams as `.mmd` files
- **Diagram Controls**: Pan, zoom, and fullscreen view for diagrams
- **Trace Highlighting**: Selected events highlight in the diagram

---

## [0.2.0] - 2025-11-20

### Added
- **Interactive Timeline**: Click events (yellow) and network requests (blue) on synchronized tracks
- **Playback Sync**: Red indicator line shows current video position
- **Click-to-Seek**: Jump video to any event by clicking timeline markers
- **Hover Details**: Event information tooltips on timeline markers

---

## [0.1.0] - 2025-11-15

### Added
- **Initial MVP Release**
- Video playback for `.webm` session recordings
- Trace JSON file loading and parsing
- Basic file management UI
- Dark theme with Tailwind CSS
- React 19 + TypeScript + Vite setup
- Firebase hosting deployment

---

[0.7.0]: https://github.com/mijailpaz/journey-recorder-viewer/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/mijailpaz/journey-recorder-viewer/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/mijailpaz/journey-recorder-viewer/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/mijailpaz/journey-recorder-viewer/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mijailpaz/journey-recorder-viewer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mijailpaz/journey-recorder-viewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mijailpaz/journey-recorder-viewer/releases/tag/v0.1.0
