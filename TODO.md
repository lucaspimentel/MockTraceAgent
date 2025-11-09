# TODO - Future Improvements

This file tracks ideas for future enhancements to MockTraceAgent. See CLAUDE.md for current project documentation.

## Features

### 1. Load Traces from Files
- **Priority**: High
- **Description**: Allow loading traces from previously saved MessagePack or JSON files
- **Details**:
  - Add file upload UI in web interface
  - Support drag-and-drop for .bin (MessagePack) and .json files
  - Parse files and inject into TraceStorageService as if they were received via HTTP
  - CLI: Add `--load <file>` option to load and display saved payloads
  - Validate file format before loading

### 2. Flamegraph Enhancements
- **Priority**: Medium
- **Description**: Improve flamegraph visualization
- **Ideas**:
  - Add zoom/pan functionality using SVG viewBox
  - Minimap for long traces
  - Color coding options (by service, by resource, by span type)
  - Export flamegraph as SVG/PNG image
  - Show concurrent spans side-by-side instead of stacked
  - Add search/filter to highlight specific spans

### 3. Trace Comparison
- **Priority**: Medium
- **Description**: Compare two traces side-by-side
- **Details**:
  - Select two traces from the list
  - Show dual flamegraphs for comparison
  - Highlight differences in span structure
  - Compare metrics (duration, span count, etc.)

### 4. Persistent Storage
- **Priority**: Low
- **Description**: Persist received traces across restarts
- **Options**:
  - SQLite database for web app
  - File-based storage with indexing
  - Optional: Redis for distributed scenarios

### 5. Real-time Statistics
- **Priority**: Low
- **Description**: Enhanced statistics and analytics
- **Ideas**:
  - Service breakdown (spans per service)
  - Error rate over time
  - Duration percentiles (p50, p95, p99)
  - Throughput chart (traces/sec)
  - Top slowest spans

### 6. Advanced Filtering
- **Priority**: Medium
- **Description**: Filter traces by various criteria
- **Ideas**:
  - Filter by service name
  - Filter by minimum/maximum duration
  - Filter by error status
  - Filter by tags/metadata
  - Save filter presets

### 7. Trace Export
- **Priority**: Low
- **Description**: Export traces in various formats
- **Formats**:
  - Datadog JSON format
  - OpenTelemetry format
  - Jaeger format
  - Chrome Trace Viewer format

### 8. CLI Improvements
- **Priority**: Medium
- **Description**: Enhance CLI functionality
- **Ideas**:
  - Interactive mode with keyboard navigation
  - Watch mode that auto-refreshes display
  - Export statistics to CSV/JSON
  - Filter by service/operation name

### 9. Span Search
- **Priority**: High
- **Description**: Search spans across all traces
- **Details**:
  - Search by span ID, trace ID
  - Search by service, resource, or operation name
  - Search by tag key/value
  - Full-text search in metadata

### 10. Performance Optimization
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
