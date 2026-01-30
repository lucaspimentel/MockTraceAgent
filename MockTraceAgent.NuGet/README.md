# LucasP.MockTraceAgent

Embeddable mock Datadog trace agent for .NET applications.

## Overview

MockTraceAgent allows you to embed a mock Datadog trace agent directly in your .NET applications for in-process trace inspection. Perfect for local development, testing, and debugging of Datadog APM instrumentation.

## Features

- **Easy Integration**: Simple `IHostedService` integration using Microsoft.Extensions.Hosting
- **Flexible Configuration**: Configure port and optional request callbacks
- **Multi-Framework Support**: Targets .NET 8.0 and .NET 9.0
- **Zero Dependencies**: Uses only core Microsoft.Extensions abstractions

## Installation

```bash
dotnet add package LucasP.MockTraceAgent
```

## Usage

### Azure Functions (Isolated Worker)

```csharp
using MockTraceAgent;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        services.AddMockTraceAgent(options =>
        {
            options.Port = 8126;
        });
    })
    .Build();

host.Run();
```

### Generic Host / Console App

```csharp
using MockTraceAgent;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices(services =>
    {
        services.AddMockTraceAgent(options =>
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
using MockTraceAgent;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMockTraceAgent(options =>
{
    options.Port = 8126;
});

var app = builder.Build();
app.Run();
```

## Configuration

### MockTraceAgentOptions

- **Port** (int): The port to listen on for trace requests. Default: `8126`
- **RequestReceivedCallback** (Action<string, int, ReadOnlyMemory<byte>>?): Optional callback invoked when traces are received. Parameters are URL, content length, and request body bytes.

## How It Works

MockTraceAgent starts an HTTP listener on the configured port that accepts Datadog trace payloads in MessagePack format. It responds with a simple JSON acknowledgment, allowing your Datadog tracer to continue sending traces without errors.

## Related Tools

This package is part of the MockTraceAgent toolkit:
- **MockTraceAgent.Cli**: Command-line tool for trace inspection
- **MockTraceAgent.Web**: Web UI with real-time trace visualization and flamegraphs

## License

MIT License - see repository for full license text.

## Repository

https://github.com/lucaspimentel/MockTraceAgent
