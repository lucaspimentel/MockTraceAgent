using MockTraceAgent.Core;

namespace MockTraceAgent.Web.Models;

public class TraceData
{
    public string Id { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; }
    public string Url { get; set; } = string.Empty;
    public int ContentLength { get; set; }
    public byte[] RawBytes { get; set; } = Array.Empty<byte>();
    public IList<IList<Span>>? TraceChunks { get; set; }
    public int TraceChunkCount { get; set; }
    public int TotalSpanCount { get; set; }
}

public class TraceStatistics
{
    public int TotalTraces { get; set; }
    public int TotalSpans { get; set; }
    public long TotalBytes { get; set; }
    public DateTime? FirstTraceAt { get; set; }
    public DateTime? LastTraceAt { get; set; }
}
