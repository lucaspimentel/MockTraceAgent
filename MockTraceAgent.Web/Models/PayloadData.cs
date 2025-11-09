using MockTraceAgent.Core;

namespace MockTraceAgent.Web.Models;

public class PayloadData
{
    public string Id { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; }
    public string Url { get; set; } = string.Empty;
    public int ContentLength { get; set; }
    public byte[] RawBytes { get; set; } = [];
    public IList<IList<Span>>? TraceChunks { get; set; }
    public int TraceChunkCount { get; set; }
    public int TotalSpanCount { get; set; }
}
