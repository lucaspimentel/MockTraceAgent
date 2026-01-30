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
                // Optional: log or process received traces
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

## Configuration

### TracerPayloadInspectorOptions

- **ListeningPort** (int): The port to listen on for trace requests. Default: `8126`
- **DeserializeContents** (bool): When `true`, automatically deserializes MessagePack payloads and provides parsed span data in the callback. Default: `false`
- **RequestReceivedCallback** (Action<RequestReceivedCallbackArgs>?): Optional callback invoked when traces are received. Provides URL, content length, raw bytes, and optionally deserialized trace chunks (if `DeserializeContents` is enabled).

## Inspecting and Processing Trace Payloads

Enable `DeserializeContents` to automatically deserialize MessagePack payloads and access parsed span data:

```csharp
using Datadog.Apm.TracerPayloadInspector;
using Datadog.Apm.TracerPayloadInspector.Core;

builder.Services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.DeserializeContents = true;
    options.RequestReceivedCallback = args =>
    {
        Console.WriteLine($"Received {args.Length} bytes at {args.Url}");

        if (args.TraceChunks is not null)
        {
            Console.WriteLine($"  {args.ChunkCount} trace chunks with {args.TotalSpanCount} total spans");

            foreach (var chunk in args.TraceChunks)
            {
                foreach (var span in chunk)
                {
                    Console.WriteLine($"  Span: {span.Service}.{span.Name} (trace_id={span.TraceId}, span_id={span.SpanId})");
                }
            }
        }
    };
});
```

### Saving Payloads to Files

You can save received payloads to files for offline analysis:

```csharp
using Datadog.Apm.TracerPayloadInspector;
using MessagePack;

builder.Services.AddTracerPayloadInspector(options =>
{
    options.ListeningPort = 8126;
    options.DeserializeContents = true;
    options.RequestReceivedCallback = args =>
    {
        if (args.Contents.Length > 0 && args.Url == "/v0.4/traces")
        {
            var now = DateTime.Now;
            var filenameUrlPart = args.Url.TrimStart('/').Replace('/', '_');

            // Save raw MessagePack bytes
            var msgpackFilename = $"payload-{filenameUrlPart}-{now:yyyy-MM-dd_HH-mm-ss-ff}.bin";
            using var msgpackFileStream = File.Create(msgpackFilename);
            msgpackFileStream.Write(args.Contents.Span);
            Console.WriteLine($"Saved raw bytes to \"{msgpackFilename}\"");

            // Convert to JSON and save
            var jsonFilename = $"payload-{filenameUrlPart}-{now:yyyy-MM-dd_HH-mm-ss-ff}.json";
            string json = MessagePackSerializer.ConvertToJson(args.Contents);
            File.WriteAllText(jsonFilename, json);
            Console.WriteLine($"Saved JSON to \"{jsonFilename}\"");
        }
    };
});
```

**Note**: JSON conversion requires `MessagePack` NuGet package (version 2.x).

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
