using Datadog.Apm.TracerPayloadInspector.Core;

namespace Datadog.Apm.TracerPayloadInspector.Web.Models;

public class PayloadData
{
    public string Id { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; }
    public string Url { get; set; } = string.Empty;
    public int ContentLength { get; set; }
    public byte[] RawBytes { get; set; } = [];
    public IReadOnlyList<IReadOnlyList<Span>>? TraceChunks { get; set; }
    public int TraceChunkCount { get; set; }
    public int TotalSpanCount { get; set; }
}
