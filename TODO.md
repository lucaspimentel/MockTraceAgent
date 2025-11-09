# TODO - Future Improvements

This file tracks ideas for future enhancements to MockTraceAgent. See CLAUDE.md for current project documentation.

## Features

### 1. ~~Restore Payload Download Buttons~~ ✓ COMPLETED
- **Priority**: High
- **Description**: Add download buttons back to payload list items in Payloads view
- **Details**:
  - Lost during UI refactor
  - Add "Download Raw" button (calls `/api/payloads/{id}/raw`)
  - Add "Download JSON" button (calls `/api/payloads/{id}/json`)
  - Place buttons within each payload list item for easy access
  - Backend endpoints already exist, just need UI buttons
- **Completed**: 2025-11-09
  - Added "Raw" and "JSON" download buttons to each payload in the Payloads view
  - Buttons styled consistently with blue theme
  - Click handler updated to prevent selecting payload when clicking download buttons

### 2. Show Span Details Under Flamegraph
- **Priority**: High
- **Description**: Display span details below the flamegraph in Traces view
- **Details**:
  - Currently span details are in the right pane
  - Move/copy span details to appear under the flamegraph
  - This provides better context when viewing the flamegraph
  - Consider layout: flamegraph on top, span details below within the same pane

### 3. Support 128-bit Trace IDs
- **Priority**: High
- **Description**: Add support for 128-bit trace IDs (currently only 64-bit)
- **Details**:
  - Need explanation from user on how this works
  - Likely involves handling trace IDs as strings or separate high/low parts
  - Update Span.cs model
  - Update display formatting for larger IDs
  - Ensure backwards compatibility with 64-bit trace IDs

### 4. Load Traces from Files
- **Priority**: High
- **Description**: Allow loading traces from previously saved MessagePack or JSON files
- **Details**:
  - Add file upload UI in web interface
  - Support drag-and-drop for .bin (MessagePack) and .json files
  - Parse files and inject into TraceStorageService as if they were received via HTTP
  - CLI: Add `--load <file>` option to load and display saved payloads
  - Validate file format before loading

### 5. Flamegraph Enhancements
- **Priority**: Medium
- **Description**: Improve flamegraph visualization
- **Ideas**:
  - Add zoom/pan functionality using SVG viewBox
  - Minimap for long traces
  - Color coding options (by service, by resource, by span type)
  - Export flamegraph as SVG/PNG image
  - Show concurrent spans side-by-side instead of stacked
  - Add search/filter to highlight specific spans

### 6. Trace Comparison
- **Priority**: Medium
- **Description**: Compare two traces side-by-side
- **Details**:
  - Select two traces from the list
  - Show dual flamegraphs for comparison
  - Highlight differences in span structure
  - Compare metrics (duration, span count, etc.)

### 7. Persistent Storage
- **Priority**: Low
- **Description**: Persist received traces across restarts
- **Options**:
  - SQLite database for web app
  - File-based storage with indexing
  - Optional: Redis for distributed scenarios

### 8. Real-time Statistics
- **Priority**: Low
- **Description**: Enhanced statistics and analytics
- **Ideas**:
  - Service breakdown (spans per service)
  - Error rate over time
  - Duration percentiles (p50, p95, p99)
  - Throughput chart (traces/sec)
  - Top slowest spans

### 9. Advanced Filtering
- **Priority**: Medium
- **Description**: Filter traces by various criteria
- **Ideas**:
  - Filter by service name
  - Filter by minimum/maximum duration
  - Filter by error status
  - Filter by tags/metadata
  - Save filter presets

### 10. Trace Export
- **Priority**: Low
- **Description**: Export traces in various formats
- **Formats**:
  - Datadog JSON format
  - OpenTelemetry format
  - Jaeger format
  - Chrome Trace Viewer format

### 11. CLI Improvements
- **Priority**: Medium
- **Description**: Enhance CLI functionality
- **Ideas**:
  - Interactive mode with keyboard navigation
  - Watch mode that auto-refreshes display
  - Export statistics to CSV/JSON
  - Filter by service/operation name

### 12. Span Search
- **Priority**: High
- **Description**: Search spans across all traces
- **Details**:
  - Search by span ID, trace ID
  - Search by service, resource, or operation name
  - Search by tag key/value
  - Full-text search in metadata

### 13. Performance Optimization
- **Priority**: Low
- **Description**: Optimize for large traces
- **Ideas**:
  - Lazy load spans in UI
  - Virtualized lists for large span counts
  - Pagination for trace list
  - Web workers for MessagePack parsing
  - Consider switching flamegraph to Canvas for >1000 spans

## Infrastructure

### Documentation
- Add API documentation with examples
- Add architecture diagrams
- Create user guide with screenshots

### Testing
- Add unit tests for Core library
- Add integration tests for Web API
- Add browser tests for UI

### CI/CD
- GitHub Actions workflow for build/test
- Automated releases
- Docker image for web app

## Notes

- See CLAUDE.md for current architecture and usage
- Mark items as completed by moving to CHANGELOG.md
