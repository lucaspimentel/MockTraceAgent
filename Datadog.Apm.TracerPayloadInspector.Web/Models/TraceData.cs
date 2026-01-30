using Datadog.Apm.TracerPayloadInspector.Core;

namespace Datadog.Apm.TracerPayloadInspector.Web.Models;

public class TraceData
{
    public required ulong TraceId { get; set; }
    public List<Span> Spans { get; set; } = [];
    public DateTime FirstSeen { get; set; }
    public DateTime LastSeen { get; set; }
    public int SpanCount => Spans.Count;
}
