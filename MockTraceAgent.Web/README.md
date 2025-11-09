# MockTraceAgent.Web

Web application with real-time visualization of Datadog trace payloads.

## Description

ASP.NET Core web application that provides a browser-based UI for inspecting trace payloads in real-time. Features dual-view interface (Payloads and Traces views), SignalR-based live updates, and REST API for programmatic access.

## Features

- Real-time trace payload visualization
- Dual-view interface: payload-centric and trace-aggregated views
- Hierarchical span tree with parent-child relationships
- Download payloads as raw MessagePack or JSON
- REST API for integration

## Usage

```bash
# Run web application
dotnet run

# Access web UI at http://localhost:5000
# Trace agent listens on port 8126 (configurable in appsettings.json)
```

## Dependencies

### External NuGet Packages
- **MessagePack** (2.5.198) - MessagePack deserialization
- ASP.NET Core framework (included in .NET 9.0 SDK) - Web hosting, SignalR

### Project References
- **MockTraceAgent.Core** - Core trace processing logic

## Dependents

None - this is an executable application.
