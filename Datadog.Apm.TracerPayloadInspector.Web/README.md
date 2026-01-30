# Datadog.Apm.TracerPayloadInspector.Web

Web application with real-time visualization of Datadog tracer payloads.

## Description

ASP.NET Core web application that provides a browser-based UI for inspecting tracer payloads in real-time. Features dual-view interface (Payloads and Traces views), SignalR-based live updates, and REST API for programmatic access.

## Features

- **Real-time tracer payload visualization** with SignalR push updates
- **Dual-view interface**:
  - Payloads View (4-pane): Drill down through payloads → chunks → spans → details
  - Traces View (3-pane): Aggregated traces with SVG flamegraph visualization
- **SVG flamegraph** with time axis, color-coding by service, interactive hover/click
- **Span details** with IDs, basic info, meta (tags), and metrics - all alphabetically sorted
- **Monospace fonts** for IDs, URLs, meta keys/values, metrics keys/values
- **Smart filtering**: URL filtering with non-empty toggle (Payloads), auto-filter (Traces)
- **Download payloads** as raw MessagePack (.bin) or JSON (.json)
- **REST API** for programmatic access to payloads and traces

## Usage

```bash
# Run web application
dotnet run --project Datadog.Apm.TracerPayloadInspector.Web.csproj

# Access web UI at http://localhost:5000
# Payload inspector listens on port 8126 (configurable in appsettings.json)
```

## Dependencies

### External NuGet Packages
- **MessagePack** (2.5.198) - MessagePack deserialization
- ASP.NET Core framework (included in .NET 9.0 SDK) - Web hosting, SignalR

### Project References
- **Datadog.Apm.TracerPayloadInspector.Core** - Core trace processing logic

## Dependents

None - this is an executable application.
