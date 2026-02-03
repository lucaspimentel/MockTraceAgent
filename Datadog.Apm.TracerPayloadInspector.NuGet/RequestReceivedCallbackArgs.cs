using Datadog.Apm.TracerPayloadInspector.Core;

namespace Datadog.Apm.TracerPayloadInspector;

public class RequestReceivedCallbackArgs(
    string url,
    int length,
    ReadOnlyMemory<byte> contents,
    IReadOnlyList<IReadOnlyList<Span>>? traceChunks,
    int? chunkCount,
    int? totalSpanCount,
    string? json)
{
    public string Url { get; } = url;

    public int Length { get; } = length;

    public ReadOnlyMemory<byte> Contents { get; } = contents;

    public IReadOnlyList<IReadOnlyList<Span>>? TraceChunks { get; } = traceChunks;

    public int? ChunkCount { get; } = chunkCount;

    public int? TotalSpanCount { get; } = totalSpanCount;

    public string? Json { get; } = json;
}
