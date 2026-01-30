namespace Datadog.Apm.TracerPayloadInspector.Web.Models;

public class PayloadStatistics
{
    public int TotalTraces { get; set; }
    public int TotalSpans { get; set; }
    public long TotalBytes { get; set; }
    public DateTime? FirstTraceAt { get; set; }
    public DateTime? LastTraceAt { get; set; }
}