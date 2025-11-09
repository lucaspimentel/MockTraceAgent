# MockTraceAgent.Core

Shared library containing core trace processing logic for the MockTraceAgent solution.

## Description

This library provides the fundamental components for receiving and deserializing Datadog trace payloads. It includes an HTTP listener implementation and MessagePack data models for Datadog spans.

## Key Components

- `TraceAgent` - HTTP listener that receives trace payloads on configurable port
- `Span` - MessagePack data model representing Datadog trace spans

## Dependencies

### External NuGet Packages
- **MessagePack** (2.5.198) - MessagePack serialization for Datadog trace payloads

### Project References
None - this is a foundational library with no project dependencies.

## Dependents

This library is referenced by:
- **MockTraceAgent.Cli** - CLI application for command-line trace inspection
- **MockTraceAgent.Web** - Web application with real-time trace visualization
