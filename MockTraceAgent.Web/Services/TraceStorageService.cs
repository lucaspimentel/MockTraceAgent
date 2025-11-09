using System.Collections.Concurrent;
using MessagePack;
using Microsoft.AspNetCore.SignalR;
using MockTraceAgent.Core;
using MockTraceAgent.Web.Hubs;
using MockTraceAgent.Web.Models;

namespace MockTraceAgent.Web.Services;

public class TraceStorageService
{
    private readonly ConcurrentDictionary<string, PayloadData> _tracePayloads = new();
    private readonly ConcurrentDictionary<ulong, TraceData> _traces = new();
    private readonly IHubContext<TracesHub> _hubContext;
    private readonly ILogger<TraceStorageService> _logger;
    private long _totalBytes;

    public TraceStorageService(IHubContext<TracesHub> hubContext, ILogger<TraceStorageService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task AddTrace(string url, int contentLength, ReadOnlyMemory<byte> contents)
    {
        try
        {
            var id = Guid.NewGuid().ToString("N");
            var receivedAt = DateTime.Now;
            var rawBytes = contents.ToArray();

            // Try to deserialize the trace
            IList<IList<Span>>? traceChunks = null;
            int traceChunkCount = 0;
            int totalSpanCount = 0;

            try
            {
                if (contents.Length > 0 && url == "/v0.4/traces")
                {
                    traceChunks = MessagePackSerializer.Deserialize<IList<IList<Span>>>(contents);
                    traceChunkCount = traceChunks.Count;
                    totalSpanCount = traceChunks.Sum(t => t.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to deserialize trace data for URL {Url}", url);
            }

            var traceData = new PayloadData
            {
                Id = id,
                ReceivedAt = receivedAt,
                Url = url,
                ContentLength = contentLength,
                RawBytes = rawBytes,
                TraceChunks = traceChunks,
                TraceChunkCount = traceChunkCount,
                TotalSpanCount = totalSpanCount
            };

            _tracePayloads[id] = traceData;
            Interlocked.Add(ref _totalBytes, contentLength);

            // Aggregate spans by trace ID
            if (traceChunks != null && url == "/v0.4/traces")
            {
                foreach (var chunk in traceChunks)
                {
                    foreach (var span in chunk)
                    {
                        _traces.AddOrUpdate(
                            span.TraceId,
                            _ => new TraceData
                            {
                                TraceId = span.TraceId,
                                Spans = [span],
                                FirstSeen = receivedAt,
                                LastSeen = receivedAt
                            },
                            (_, existingTrace) =>
                            {
                                existingTrace.Spans.Add(span);
                                if (receivedAt < existingTrace.FirstSeen)
                                    existingTrace.FirstSeen = receivedAt;
                                if (receivedAt > existingTrace.LastSeen)
                                    existingTrace.LastSeen = receivedAt;
                                return existingTrace;
                            });
                    }
                }
            }

            // Broadcast to all connected clients
            await _hubContext.Clients.All.SendAsync("ReceiveTrace", new
            {
                id,
                receivedAt = receivedAt.ToString("yyyy-MM-dd HH:mm:ss.ff"),
                url,
                contentLength,
                traceChunkCount,
                totalSpanCount
            });

            _logger.LogInformation(
                "Trace {Id} received: {ContentLength} bytes at {Url}, {ChunkCount} chunks, {SpanCount} spans",
                id, contentLength, url, traceChunkCount, totalSpanCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding trace");
        }
    }

    public IEnumerable<object> GetAllTraces()
    {
        return _tracePayloads.Values
            .OrderByDescending(t => t.ReceivedAt)
            .Select(t => new
            {
                t.Id,
                receivedAt = t.ReceivedAt.ToString("yyyy-MM-dd HH:mm:ss.ff"),
                t.Url,
                t.ContentLength,
                t.TraceChunkCount,
                t.TotalSpanCount
            });
    }

    public PayloadData? GetTracePayload(string id)
    {
        _tracePayloads.TryGetValue(id, out var trace);
        return trace;
    }

    public byte[]? GetRawBytes(string id)
    {
        return _tracePayloads.TryGetValue(id, out var trace) ? trace.RawBytes : null;
    }

    public string? GetJson(string id)
    {
        if (_tracePayloads.TryGetValue(id, out var trace) && trace.RawBytes.Length > 0)
        {
            try
            {
                return MessagePackSerializer.ConvertToJson(trace.RawBytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to convert trace {Id} to JSON", id);
                return null;
            }
        }
        return null;
    }

    public PayloadStatistics GetStatistics()
    {
        var traces = _tracePayloads.Values.ToList();
        return new PayloadStatistics
        {
            TotalTraces = traces.Count,
            TotalSpans = traces.Sum(t => t.TotalSpanCount),
            TotalBytes = Interlocked.Read(ref _totalBytes),
            FirstTraceAt = traces.MinBy(t => t.ReceivedAt)?.ReceivedAt,
            LastTraceAt = traces.MaxBy(t => t.ReceivedAt)?.ReceivedAt
        };
    }

    public IEnumerable<object> GetAllAggregatedTraces()
    {
        return _traces.Values
            .OrderByDescending(t => t.LastSeen)
            .Select(t => new
            {
                traceId = t.TraceId.ToString(),
                spanCount = t.SpanCount,
                firstSeen = t.FirstSeen.ToString("yyyy-MM-dd HH:mm:ss.ff"),
                lastSeen = t.LastSeen.ToString("yyyy-MM-dd HH:mm:ss.ff")
            });
    }

    public TraceData? GetAggregatedTrace(ulong traceId)
    {
        _traces.TryGetValue(traceId, out var trace);
        return trace;
    }
}
