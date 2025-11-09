using MockTraceAgent.Web.Hubs;
using MockTraceAgent.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddSignalR();
builder.Services.AddSingleton<TraceStorageService>();
builder.Services.AddHostedService<TraceAgentHostedService>();

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapHub<TracesHub>("/hubs/traces");

// API endpoints
app.MapGet("/api/payloads", (TraceStorageService storage) => storage.GetAllTraces());
app.MapGet("/api/payloads/{id}", (string id, TraceStorageService storage) =>
{
    var trace = storage.GetTracePayload(id);
    if (trace == null)
    {
        return Results.NotFound();
    }

    // Return trace without raw bytes (those are available via /api/payloads/{id}/raw)
    return Results.Ok(new
    {
        trace.Id,
        trace.ReceivedAt,
        trace.Url,
        trace.ContentLength,
        trace.TraceChunks,
        trace.TraceChunkCount,
        trace.TotalSpanCount
    });
});
app.MapGet("/api/payloads/{id}/raw", (string id, TraceStorageService storage) =>
{
    var rawBytes = storage.GetRawBytes(id);
    return rawBytes != null ? Results.File(rawBytes, "application/octet-stream", $"payload-{id}.bin") : Results.NotFound();
});
app.MapGet("/api/payloads/{id}/json", (string id, TraceStorageService storage) =>
{
    var json = storage.GetJson(id);
    return json != null ? Results.Content(json, "application/json") : Results.NotFound();
});
app.MapGet("/api/stats", (TraceStorageService storage) => storage.GetStatistics());

// Aggregated traces endpoints
app.MapGet("/api/traces", (TraceStorageService storage) => storage.GetAllAggregatedTraces());
app.MapGet("/api/traces/{traceId}", (string traceId, TraceStorageService storage) =>
{
    if (!ulong.TryParse(traceId, out var id))
    {
        return Results.BadRequest("Invalid trace ID format");
    }

    var trace = storage.GetAggregatedTrace(id);
    if (trace == null)
    {
        return Results.NotFound();
    }

    return Results.Ok(new
    {
        traceId = trace.TraceId.ToString(),
        spans = trace.Spans,
        spanCount = trace.SpanCount,
        firstSeen = trace.FirstSeen.ToString("yyyy-MM-dd HH:mm:ss.ff"),
        lastSeen = trace.LastSeen.ToString("yyyy-MM-dd HH:mm:ss.ff")
    });
});

app.Run();
