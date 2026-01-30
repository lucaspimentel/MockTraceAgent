using Datadog.Apm.TracerPayloadInspector.Web.Hubs;
using Datadog.Apm.TracerPayloadInspector.Web.Services;
using Datadog.Apm.TracerPayloadInspector.Web.Serialization;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Configure JSON serialization to handle large integers as strings
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new ULongToStringConverter());
    options.SerializerOptions.Converters.Add(new NullableULongToStringConverter());
});

// Add services to the container
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.Converters.Add(new ULongToStringConverter());
        options.PayloadSerializerOptions.Converters.Add(new NullableULongToStringConverter());
    });
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
app.MapGet("/api/payloads/{id}/messagepack", (string id, TraceStorageService storage) =>
{
    var rawBytes = storage.GetRawBytes(id);
    return rawBytes != null ? Results.File(rawBytes, "application/octet-stream", $"payload-{id}.bin") : Results.NotFound();
});
app.MapGet("/api/payloads/{id}/json", (string id, TraceStorageService storage, HttpContext context) =>
{
    var json = storage.GetJson(id);
    if (json == null)
    {
        return Results.NotFound();
    }

    context.Response.Headers.ContentDisposition = $"attachment; filename=\"payload-{id}.json\"";
    return Results.Content(json, "application/json");
});
app.MapGet("/api/stats", (TraceStorageService storage) => storage.GetStatistics());
app.MapPost("/api/clear", async (TraceStorageService storage) =>
{
    await storage.ClearAll();
    return Results.Ok(new { message = "All data cleared successfully" });
});

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
        traceId = trace.TraceId,
        spans = trace.Spans,
        spanCount = trace.SpanCount,
        firstSeen = trace.FirstSeen.ToString("yyyy-MM-dd HH:mm:ss.ff"),
        lastSeen = trace.LastSeen.ToString("yyyy-MM-dd HH:mm:ss.ff")
    });
});

app.Run();
