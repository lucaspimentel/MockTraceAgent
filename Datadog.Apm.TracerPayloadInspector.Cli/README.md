# Datadog.Apm.TracerPayloadInspector.Cli

Command-line application for inspecting Datadog tracer payloads.

## Description

CLI tool that listens for HTTP requests containing MessagePack-encoded tracer payloads. It can display trace statistics, save raw payloads, and convert them to JSON for inspection.

## Usage

```
USAGE:
    Datadog.Apm.TracerPayloadInspector.Cli.dll [OPTIONS]

OPTIONS:
                         DEFAULT
    -h, --help                      Prints help information
    -p, --port           8126       Port number to listen on
    -c, --show-counts               Deserialize and display trace chunk/span counts
    -s, --save           None       Valid options: None, RawBytes, ConvertToJson, All
    -f, --filter         /traces    URL filter for processing payloads
```

## Examples

```bash
# Listen on default port (8126)
dotnet run

# Custom port with trace counts and saving
dotnet run -- --port 8080 --show-counts --save All

# Save only JSON files with URL filtering
dotnet run -- --save ConvertToJson --filter /v0.4/traces

# Complete monitoring setup
dotnet run -- --port 8126 --show-counts --save All --filter /v0.4/traces
```

## Command-Line Options Details

### `-p, --port <PORT>` (Default: 8126)
Port number to listen on for incoming trace requests.

### `-c, --show-counts` (Default: false)
Deserialize payloads and display the number of trace chunks and spans. Only applies to `/v0.4/traces` endpoint.

### `-s, --save <OPTIONS>` (Default: None)
Save received payloads to files:
- `None` - Don't save payloads
- `RawBytes` - Save raw MessagePack bytes (.bin files)
- `ConvertToJson` - Save payloads as JSON (.json files)
- `All` - Save both raw and JSON formats

Saved files use the format: `payload-{url_part}-{timestamp}.{bin|json}`

### `-f, --filter <URL_FILTER>` (Default: /traces)
URL filter for processing payloads. Only payloads with URLs containing this string (case-insensitive) will be deserialized and/or saved.

## Dependencies

### External NuGet Packages
- **Spectre.Console.Cli** (0.53.0) - CLI argument parsing and formatting

### Project References
- **Datadog.Apm.TracerPayloadInspector.Core** - Core trace processing logic (includes MessagePack deserialization)

## Dependents

None - this is an executable application.
