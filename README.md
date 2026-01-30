# Datadog APM Tracer Payload Inspector

A diagnostic tool for inspecting and debugging Datadog tracer payloads. This tool listens for trace payloads from Datadog tracers and provides visibility into trace data without requiring a full Datadog Agent installation.

**Available in three flavors:**
- **CLI Application**: Command-line tool for quick trace inspection and file saving
- **Web Application**: Browser-based UI with real-time trace visualization and flamegraphs
- **NuGet Package**: Embeddable library for integrating into your .NET applications

## Features

### CLI Application
- **HTTP Listener**: Listens on a configurable port (default: 8126) for Datadog trace payloads
- **Trace Inspection**: Display real-time statistics on received trace chunks and spans
- **Payload Persistence**: Save trace payloads in raw MessagePack format or converted to JSON
- **URL Filtering**: Filter which endpoints to process and save
- **Minimal Dependencies**: Simple .NET console application with minimal overhead

### Web Application
- **Dual-View Interface**: Switch between Payloads view (raw data) and Traces view (aggregated by trace ID)
- **Real-time Visualization**: Browser-based UI with live updates via SignalR
- **Payloads View (4-pane)**: Drill down from payloads (20%) → trace chunks (18%) → spans (18%) → details (44%)
- **Traces View (3-pane)**: Explore traces (18%) → SVG flamegraph (flexible) → span details (flexible)
- **SVG Flamegraph**: Interactive visualization with:
  - Horizontal bars showing span duration and hierarchy
  - Time axis with duration markers
  - Color-coded by service (errors in red)
  - Hover effects and click to view details
- **Smart Filtering**: URL filtering with non-empty toggle (Payloads), always non-empty (Traces)
- **Span Details**: View IDs, basic info, meta (tags), and metrics - all alphabetically sorted
- **Monospace Fonts**: IDs, URLs, meta/metrics keys and values displayed in fixed-width font
- **Data Export**: Download raw MessagePack or JSON for any received payload
- **Statistics Dashboard**: Live metrics showing total traces, spans, and bytes received
- **Error Highlighting**: Visual indicators for spans with errors
- **Clear All Data**: One-click button to clear all stored traces and payloads (with confirmation)

## Requirements

- .NET 9.0 SDK or later

## Installation

Clone the repository and build the projects:

```bash
git clone https://github.com/lucaspimentel/MockTraceAgent.git
cd MockTraceAgent
dotnet build
```

## Project Structure

The solution consists of four projects:
- **Datadog.Apm.TracerPayloadInspector.Cli** - CLI application (command-line tool)
- **Datadog.Apm.TracerPayloadInspector.Web** - Web application (browser UI + REST API)
- **Datadog.Apm.TracerPayloadInspector.Core** - Shared library (trace processing logic)
- **Datadog.Apm.TracerPayloadInspector.NuGet** - NuGet package (embeddable library)

**Important**: CLI and Web applications listen on the same port by default (8126) and cannot run simultaneously. Configure different ports if you need to run both.

## Usage

### NuGet Package (Recommended for Applications)

Add the package to your project:

```bash
dotnet add package LucasP.Datadog.Apm.TracerPayloadInspector
```

Integrate into your application:

```csharp
using Datadog.Apm.TracerPayloadInspector;

// Azure Functions, Generic Host, or ASP.NET Core
services.AddTracerPayloadInspector(options =>
{
    options.Port = 8126;
    options.RequestReceivedCallback = (url, length, bytes) =>
    {
        Console.WriteLine($"Received {length} bytes at {url}");
    };
});
```

See [NuGet package README](Datadog.Apm.TracerPayloadInspector.NuGet/README.md) for detailed integration examples.

### Web Application (Recommended for Debugging)

Start the web application for a rich, browser-based trace visualization experience:

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Web/Datadog.Apm.TracerPayloadInspector.Web.csproj
```

The web UI will be available at http://localhost:5000. The trace agent listens on port 8126 by default (configurable in `appsettings.json`).

**Features:**
- **Payloads View**: Inspect raw payloads with 4-pane drill-down (payloads → chunks → spans → details)
- **Traces View**: Explore aggregated traces with 3-pane layout (traces → flamegraph → details)
- **SVG Flamegraph**: Interactive visualization showing span duration, hierarchy, and timing
- Real-time updates as payloads arrive via SignalR
- Span details with IDs, meta (tags), and metrics - all alphabetically sorted
- Monospace fonts for IDs, URLs, and meta/metrics keys/values
- URL filtering (Payloads view) and automatic non-empty filtering (Traces view)
- Download raw MessagePack or JSON data
- Live statistics dashboard
- Clear All button to reset all stored data with confirmation dialog

### CLI Application

Start the CLI application for command-line trace inspection:

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj
```

The inspector will listen for traces and display received requests. Press ENTER to exit.

### CLI Command-Line Options

All CLI commands require the `--project` flag to specify the CLI project.

#### Port Configuration

Listen on a custom port:

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --port 8080
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- -p 8080
```

#### Display Trace Statistics

Show trace chunk and span counts for received payloads:

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --show-counts
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- -c
```

This will deserialize `/v0.4/traces` payloads and display:
- Number of trace chunks received
- Total number of spans across all chunks

#### Save Payloads

Save received payloads to files with timestamped filenames:

```bash
# Save raw MessagePack bytes
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --save RawBytes

# Save as converted JSON
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --save ConvertToJson

# Save both formats
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --save All

# Short form
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- -s All
```

Saved files use the format: `payload-{endpoint}-{timestamp}.{bin|json}`

Example: `payload-v0.4_traces-2025-11-06_14-23-45-12.json`

#### URL Filtering

Filter which URLs are processed and saved (default: `/traces`):

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --url-filter /v0.4/traces
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- -f /v0.4/traces
```

### CLI Combined Examples

Show counts and save JSON payloads on port 9000:

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- -p 9000 -c -s ConvertToJson
```

Full monitoring with all features:

```bash
dotnet run --project Datadog.Apm.TracerPayloadInspector.Cli/Datadog.Apm.TracerPayloadInspector.Cli.csproj -- --port 8126 --show-counts --save All --url-filter /v0.4/traces
```

## Configuration for Datadog Tracers

Configure your Datadog tracer to send traces to MockTraceAgent:

### Environment Variables

```bash
DD_TRACE_AGENT_URL=http://localhost:8126
```

Or for specific port:

```bash
DD_TRACE_AGENT_URL=http://localhost:8080
```

### Code Configuration (C#)

```csharp
var settings = TracerSettings.FromDefaultSources();
settings.Exporter.AgentUri = new Uri("http://localhost:8126");
```

## Output Examples

### Basic Request Logging

```
2025-11-06 14:23:45.12 Received 1,024 bytes at /v0.4/traces.
```

### With Trace Counts

```
2025-11-06 14:23:45.12 Received 1,024 bytes at /v0.4/traces. 5 trace chunks, 23 total spans.
```

### With File Saving

```
2025-11-06 14:23:45.12 Received 1,024 bytes at /v0.4/traces. 5 trace chunks, 23 total spans. Saved json to "payload-v0.4_traces-2025-11-06_14-23-45-12.json".
```

## REST API (Web Application)

The web application provides a REST API for programmatic access to payload and trace data:

### Payload Endpoints

- **GET /api/payloads** - List all received payloads (summary)
- **GET /api/payloads/{id}** - Get full payload details with trace chunks and spans
- **GET /api/payloads/{id}/messagepack** - Download raw MessagePack bytes
- **GET /api/payloads/{id}/json** - Download payload as JSON
- **GET /api/stats** - Get aggregate statistics

### Aggregated Trace Endpoints

- **GET /api/traces** - List all aggregated traces (grouped by trace ID)
- **GET /api/traces/{traceId}** - Get all spans for a specific trace ID

### Data Management Endpoints

- **POST /api/clear** - Clear all stored payloads and traces (broadcasts to all connected clients)

### Example Usage

```bash
# Get all payloads
curl http://localhost:5000/api/payloads

# Get specific payload
curl http://localhost:5000/api/payloads/abc123def456

# Download raw MessagePack
curl -O http://localhost:5000/api/payloads/abc123def456/messagepack

# Get all aggregated traces
curl http://localhost:5000/api/traces

# Get spans for a specific trace ID
curl http://localhost:5000/api/traces/12345678901234567890

# Get statistics
curl http://localhost:5000/api/stats

# Clear all data
curl -X POST http://localhost:5000/api/clear
```

### SignalR Hub

Connect to `/hubs/traces` for real-time updates via SignalR:
- **ReceiveTrace** - Fired when a new payload arrives
- **DataCleared** - Fired when all data is cleared

## Trace Payload Format

TracerPayloadInspector expects MessagePack-encoded trace payloads in the Datadog APM format:

- Endpoint: `/v0.4/traces`
- Encoding: MessagePack
- Structure: `IList<IList<Span>>` where:
  - Outer list: Collection of trace chunks
  - Inner list: Spans belonging to the same trace
  - Span: Datadog span with attributes (trace_id, span_id, service, name, resource, etc.)

## Use Cases

- **Local Development**: Inspect trace generation without a full Datadog Agent
- **Debugging**: Examine trace payloads to verify tracer behavior and instrumentation
- **CI/CD**: Validate trace format and content in automated tests
- **Performance Testing**: Analyze trace payload sizes and structure
- **Tracer Development**: Aid in developing and testing Datadog tracer integrations
- **Embedded Diagnostics**: Integrate into applications for runtime trace inspection

## License

See [LICENSE](LICENSE) file for details.
