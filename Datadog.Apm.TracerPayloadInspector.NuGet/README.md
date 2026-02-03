# LucasP.Datadog.Apm.TracerPayloadInspector

Embeddable Datadog tracer payload inspector for .NET applications.

## Overview

TracerPayloadInspector allows you to embed a payload inspector directly in your .NET applications to capture and inspect Datadog APM trace payloads. Perfect for local development, troubleshooting, and debugging of Datadog tracer instrumentation.

## Features

- **Easy Integration**: Simple `IHostedService` integration using Microsoft.Extensions.Hosting
- **Flexible Configuration**: Configure port and granular content processing options
- **Multi-Framework Support**: Targets .NET 8.0 and .NET 9.0
- **Zero Dependencies**: Uses only core Microsoft.Extensions abstractions
- **Built-in Logging**: Debug and error logging via `ILogger<TracerPayloadInspectorService>`
- **Exception Handling**: Gracefully handles deserialization and callback errors without crashing

## Installation

```bash
dotnet add package LucasP.Datadog.Apm.TracerPayloadInspector
```

## Quick Start

### Azure Functions (Isolated Worker)

```csharp
using Datadog.Apm.TracerPayloadInspector;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        services.AddTracerPayloadInspector(options =>
        {
            options.ListeningPort = 8126;
        });
    })
    .Build();

host.Run();
```

### Generic Host / Console App

```csharp
using Datadog.Apm.TracerPayloadInspector;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices(services =>
    {
        services.AddTracerPayloadInspector(options =>
        {
            options.ListeningPort = 8126;
            options.RequestReceivedCallback = args =>
            {
                Console.WriteLine($"Received {args.Length} bytes at {args.Url}");
            };
        });
    })
    .Build();

await host.RunAsync();
```

### ASP.NET Core

```csharp
using Datadog.Apm.TracerPayloadInspector;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
});

var app = builder.Build();
app.Run();
```

## Configuration Options

### TracerPayloadInspectorOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ListeningPort` | int | `8126` | Port to listen on for incoming trace requests |
| `ReadContents` | bool | `true` | Read the raw bytes of the request body into memory |
| `DeserializeContents` | bool | `true` | Deserialize MessagePack payloads into `Span` objects |
| `ConvertToJson` | bool | `true` | Convert MessagePack payloads to JSON string |
| `RequestReceivedCallback` | Action | `null` | Callback invoked when a request is received |

### RequestReceivedCallbackArgs

The callback receives an `RequestReceivedCallbackArgs` object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `Url` | string | The request URL (e.g., `/v0.4/traces`) |
| `Length` | int | Content length in bytes |
| `Contents` | ReadOnlyMemory\<byte\> | Raw MessagePack bytes (if `ReadContents` is enabled) |
| `TraceChunks` | IReadOnlyList\<IReadOnlyList\<Span\>\>? | Deserialized spans (if `DeserializeContents` is enabled) |
| `ChunkCount` | int? | Number of trace chunks (if deserialized) |
| `TotalSpanCount` | int? | Total number of spans (if deserialized) |
| `Json` | string? | JSON representation (if `ConvertToJson` is enabled) |

## Usage Examples

### Minimal Setup (Just Listen)

Accept trace requests without any processing - useful for preventing tracer errors:

```csharp
services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.ReadContents = false;      // Don't read request body
    options.DeserializeContents = false;
    options.ConvertToJson = false;
});
```

### Log Request Metadata Only

Log basic request info without deserializing content:

```csharp
services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.ReadContents = true;
    options.DeserializeContents = false;
    options.ConvertToJson = false;
    options.RequestReceivedCallback = args =>
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {args.Url}: {args.Length:N0} bytes");
    };
});
```

### Inspect Deserialized Spans

Parse spans and inspect their properties:

```csharp
using Datadog.Apm.TracerPayloadInspector;
using Datadog.Apm.TracerPayloadInspector.Core;

services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.DeserializeContents = true;
    options.ConvertToJson = false;      // Skip JSON conversion if not needed
    options.RequestReceivedCallback = args =>
    {
        Console.WriteLine($"Received {args.Length} bytes at {args.Url}");

        if (args.TraceChunks is not null)
        {
            Console.WriteLine($"  {args.ChunkCount} trace chunks, {args.TotalSpanCount} total spans");

            foreach (var chunk in args.TraceChunks)
            {
                foreach (var span in chunk)
                {
                    Console.WriteLine($"  - {span.Service}.{span.Name} [{span.Resource}]");
                    Console.WriteLine($"    trace_id={span.TraceId}, span_id={span.SpanId}");
                    Console.WriteLine($"    duration={span.Duration / 1_000_000.0:F2}ms, error={span.Error}");
                }
            }
        }
    };
});
```

### Get JSON for Logging or Storage

Use automatic JSON conversion for easy logging:

```csharp
services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.DeserializeContents = false;  // Skip span parsing
    options.ConvertToJson = true;
    options.RequestReceivedCallback = args =>
    {
        if (args.Json is not null)
        {
            // Log the JSON representation
            Console.WriteLine(args.Json);

            // Or save to file
            File.WriteAllText($"trace-{DateTime.Now:yyyyMMdd-HHmmss}.json", args.Json);
        }
    };
});
```

### Full Processing (All Options Enabled)

Enable all processing options for maximum flexibility:

```csharp
services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.ReadContents = true;
    options.DeserializeContents = true;
    options.ConvertToJson = true;
    options.RequestReceivedCallback = args =>
    {
        Console.WriteLine($"Received {args.Length} bytes at {args.Url}");

        // Access deserialized spans
        if (args.TraceChunks is not null)
        {
            Console.WriteLine($"  {args.ChunkCount} chunks, {args.TotalSpanCount} spans");
        }

        // Access JSON representation
        if (args.Json is not null)
        {
            Console.WriteLine($"  JSON length: {args.Json.Length} chars");
        }

        // Access raw bytes for custom processing
        if (args.Contents.Length > 0)
        {
            Console.WriteLine($"  Raw bytes: {args.Contents.Length}");
        }
    };
});
```

### Save Payloads to Files

Save both raw MessagePack and JSON formats for offline analysis:

```csharp
services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.ReadContents = true;
    options.ConvertToJson = true;
    options.RequestReceivedCallback = args =>
    {
        if (args.Contents.Length > 0 && args.Url == "/v0.4/traces")
        {
            var timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-ff");

            // Save raw MessagePack bytes
            var binFilename = $"payload-{timestamp}.bin";
            using (var fs = File.Create(binFilename))
            {
                fs.Write(args.Contents.Span);
            }
            Console.WriteLine($"Saved raw bytes to {binFilename}");

            // Save JSON (already converted by the service)
            if (args.Json is not null)
            {
                var jsonFilename = $"payload-{timestamp}.json";
                File.WriteAllText(jsonFilename, args.Json);
                Console.WriteLine($"Saved JSON to {jsonFilename}");
            }
        }
    };
});
```

### Filter by Service Name

Inspect only specific services:

```csharp
services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.DeserializeContents = true;
    options.ConvertToJson = false;
    options.RequestReceivedCallback = args =>
    {
        if (args.TraceChunks is null) return;

        var targetService = "my-api";
        var matchingSpans = args.TraceChunks
            .SelectMany(chunk => chunk)
            .Where(span => span.Service == targetService)
            .ToList();

        if (matchingSpans.Count > 0)
        {
            Console.WriteLine($"Found {matchingSpans.Count} spans for service '{targetService}':");
            foreach (var span in matchingSpans)
            {
                Console.WriteLine($"  - {span.Name}: {span.Duration / 1_000_000.0:F2}ms");
            }
        }
    };
});
```

## Logging and Diagnostics

TracerPayloadInspector uses `ILogger<TracerPayloadInspectorService>` for comprehensive logging:

### Debug Logging

Enable debug logging to see detailed operation information:

```json
{
  "Logging": {
    "LogLevel": {
      "Datadog.Apm.TracerPayloadInspector.TracerPayloadInspectorService": "Debug"
    }
  }
}
```

Debug logs include:
- Request received (URL, content length)
- Deserialization attempts and results
- Callback invocations
- Skipped operations (empty payloads, non-matching URLs)

### Error Logging

Error logs are always enabled and capture:
- **Deserialization failures**: MessagePack parsing errors with URL and byte count for context
- **Callback exceptions**: Errors thrown by user-provided `RequestReceivedCallback`

All exceptions are caught and logged without crashing the service, ensuring continuous operation.

### Performance

Debug logs use `logger.IsEnabled(LogLevel.Debug)` checks to avoid string formatting overhead when debug logging is disabled.

## How It Works

TracerPayloadInspector starts an HTTP listener on the configured port that accepts Datadog trace payloads in MessagePack format. It responds with a simple JSON acknowledgment, allowing your Datadog tracer to continue sending traces without errors.

## Related Tools

This package is part of the TracerPayloadInspector toolkit:
- **TracerPayloadInspector.Cli**: Command-line tool for trace inspection
- **TracerPayloadInspector.Web**: Web UI with real-time trace visualization and flamegraphs

## License

MIT License - see repository for full license text.

## Repository

https://github.com/lucaspimentel/MockTraceAgent
