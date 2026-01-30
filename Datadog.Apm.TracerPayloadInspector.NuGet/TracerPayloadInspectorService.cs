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
            requestReceivedCallback =
                (url, length, contents) => RequestReceivedCallback(_options, _logger, url, length, contents);
            readRequestBytes = true;
        }

        _agent = new TraceAgent(_options.ListeningPort, requestReceivedCallback, readRequestBytes);
        return Task.CompletedTask;
    }

    private static void RequestReceivedCallback(
        TracerPayloadInspectorOptions options,
        ILogger<TracerPayloadInspectorService> logger,
        string url,
        int length,
        ReadOnlyMemory<byte> contents)
    {
        IReadOnlyList<IReadOnlyList<Span>>? traceChunks = null;
        int? chunkCount = null;
        int? totalSpanCount = null;

        if (options.DeserializeContents && contents.Length > 0 && url == "/v0.4/traces")
        {
            traceChunks = MessagePackSerializer.Deserialize<IReadOnlyList<IReadOnlyList<Span>>>(contents);
            chunkCount = traceChunks.Count;
            totalSpanCount = traceChunks.Sum(t => t.Count);
        }

        var callbackArgs = new RequestReceivedCallbackArgs(url, length, contents, traceChunks, chunkCount, totalSpanCount);
        options.RequestReceivedCallback?.Invoke(callbackArgs);
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
