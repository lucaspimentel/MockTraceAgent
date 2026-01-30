# LucasP.Datadog.Apm.TracerPayloadInspector

Embeddable Datadog tracer payload inspector for .NET applications.

## Overview

TracerPayloadInspector allows you to embed a payload inspector directly in your .NET applications to capture and inspect Datadog APM trace payloads. Perfect for local development, troubleshooting, and debugging of Datadog tracer instrumentation.

## Features

- **Easy Integration**: Simple `IHostedService` integration using Microsoft.Extensions.Hosting
- **Flexible Configuration**: Configure port and optional request callbacks
- **Multi-Framework Support**: Targets .NET 8.0 and .NET 9.0
- **Zero Dependencies**: Uses only core Microsoft.Extensions abstractions

## Installation

```bash
dotnet add package LucasP.Datadog.Apm.TracerPayloadInspector
```

## Usage

### Azure Functions (Isolated Worker)

```csharp
using Datadog.Apm.TracerPayloadInspector;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        services.AddTracerPayloadInspector(options =>
        {
            options.Port = 8126;
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
            options.Port = 8126;
            options.RequestReceivedCallback = (url, length, bytes) =>
            {
                // Optional: log or process received traces
                Console.WriteLine($"Received {length} bytes at {url}");
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
    options.Port = 8126;
});

var app = builder.Build();
app.Run();
```

## Configuration

### TracerPayloadInspectorOptions

- **Port** (int): The port to listen on for trace requests. Default: `8126`
- **RequestReceivedCallback** (Action<string, int, ReadOnlyMemory<byte>>?): Optional callback invoked when traces are received. Parameters are URL, content length, and request body bytes.

## Deserializing Trace Payloads

If you want to inspect the trace data in your callback, you can deserialize the MessagePack payload:

```csharp
using Datadog.Apm.TracerPayloadInspector;
using Datadog.Apm.TracerPayloadInspector.Core;
using MessagePack;

builder.Services.AddTracerPayloadInspector(options =>
{
    options.Port = 8126;
    options.RequestReceivedCallback = (url, length, bytes) =>
    {
        try
        {
            if (bytes.Length > 0 && url == "/v0.4/traces")
            {
                var now = DateTime.Now;
                var filenameUrlPart = url.TrimStart('/').Replace('/', '_');

                // Deserialize and inspect the trace data
                var traceChunks = MessagePackSerializer.Deserialize<IList<IList<Span>>>(bytes);
                var traceChunkCount = traceChunks.Count;
                var totalSpanCount = traceChunks.Sum(t => t.Count);

                Console.WriteLine($"Received {traceChunkCount} trace chunks with {totalSpanCount} total spans");

                foreach (var chunk in traceChunks)
                {
                    foreach (var span in chunk)
                    {
                        Console.WriteLine($"  Span: {span.Service}.{span.Name} (trace_id={span.TraceId}, span_id={span.SpanId})");
                    }
                }

                // Save raw MessagePack bytes to file
                var msgpackFilename = $"payload-{filenameUrlPart}-{now:yyyy-MM-dd_HH-mm-ss-ff}.bin";
                using var msgpackFileStream = File.Create(msgpackFilename);
                msgpackFileStream.Write(bytes.Span);
                Console.WriteLine($"Saved raw bytes to \"{msgpackFilename}\"");

                // Convert to JSON and save to file
                var jsonFilename = $"payload-{filenameUrlPart}-{now:yyyy-MM-dd_HH-mm-ss-ff}.json";
                string json = MessagePackSerializer.ConvertToJson(bytes);
                File.WriteAllText(jsonFilename, json);
                Console.WriteLine($"Saved JSON to \"{jsonFilename}\"");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to process payload: {ex.Message}");
        }
    };
});
```

**Note**: Requires `MessagePack` NuGet package (version 2.x).

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
