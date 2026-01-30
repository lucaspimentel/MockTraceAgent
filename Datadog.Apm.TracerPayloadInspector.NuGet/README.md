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
