using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Datadog.Apm.TracerPayloadInspector.Core;
using MessagePack;

namespace Datadog.Apm.TracerPayloadInspector;

public sealed class TracerPayloadInspectorService : IHostedService, IDisposable
{
    private readonly TracerPayloadInspectorOptions _options;
    private readonly ILogger<TracerPayloadInspectorService> _logger;

    private TraceAgent? _agent;

    public TracerPayloadInspectorService(
        IOptions<TracerPayloadInspectorOptions> options,
        ILogger<TracerPayloadInspectorService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (_logger.IsEnabled(LogLevel.Information))
        {
            _logger.LogInformation("Starting TracerPayloadInspector listener on port {Port}", _options.ListeningPort);
        }

        Action<string, int, ReadOnlyMemory<byte>>? requestReceivedCallback;
        bool readRequestBytes;

        if (_options.RequestReceivedCallback is null)
        {
            requestReceivedCallback = null;
            readRequestBytes = false;
        }
        else
        {
            requestReceivedCallback = (url, length, contents) =>
                                          RequestReceivedCallback(
                                              _options.DeserializeContents,
                                              _options.RequestReceivedCallback,
                                              _logger,
                                              url,
                                              length,
                                              contents);
            readRequestBytes = true;
        }

        _agent = new TraceAgent(_options.ListeningPort, requestReceivedCallback, readRequestBytes);
        return Task.CompletedTask;
    }

    private static void RequestReceivedCallback(
        bool deserializeContents,
        Action<RequestReceivedCallbackArgs> optionsRequestReceivedCallback,
        ILogger<TracerPayloadInspectorService> logger,
        string url,
        int length,
        ReadOnlyMemory<byte> contents)
    {
        if (logger.IsEnabled(LogLevel.Debug))
        {
            logger.LogDebug("Received request: {Url}, Length: {Length} bytes", url, length);
        }

        IReadOnlyList<IReadOnlyList<Span>>? traceChunks = null;
        int? chunkCount = null;
        int? totalSpanCount = null;

        if (deserializeContents && contents.Length > 0 && url == "/v0.4/traces")
        {
            if (logger.IsEnabled(LogLevel.Debug))
            {
                logger.LogDebug("Attempting to deserialize MessagePack payload from tracer ({Length:N0} bytes)", contents.Length);
            }

            try
            {
                traceChunks = MessagePackSerializer.Deserialize<IReadOnlyList<IReadOnlyList<Span>>>(contents);
                chunkCount = traceChunks.Count;
                totalSpanCount = traceChunks.Sum(t => t.Count);

                if (logger.IsEnabled(LogLevel.Debug))
                {
                    logger.LogDebug("Successfully deserialized {ChunkCount} trace chunks with {SpanCount} total spans", chunkCount, totalSpanCount);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to deserialize MessagePack payload from tracer ({Length} bytes)", length);
            }
        }

        try
        {
            logger.LogDebug("Invoking RequestReceivedCallback");
            var callbackArgs = new RequestReceivedCallbackArgs(url, length, contents, traceChunks, chunkCount, totalSpanCount);
            optionsRequestReceivedCallback(callbackArgs);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception in RequestReceivedCallback for {Url}", url);
        }
    }


    public Task StopAsync(CancellationToken cancellationToken)
    {
        Stop();
        return Task.CompletedTask;
    }

    private void Stop()
    {
        if (_agent is not null)
        {
            _logger.LogInformation("Stopping TracerPayloadInspector listener");
            _agent.Dispose();
        }
    }

    public void Dispose() => Stop();
}
