using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Datadog.Apm.TracerPayloadInspector.Core;

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
        _logger.LogInformation("Starting TracerPayloadInspector on port {Port}", _options.Port);

        _agent = new TraceAgent(
            _options.Port,
            _options.RequestReceivedCallback,
            readRequestBytes: _options.RequestReceivedCallback != null);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping TracerPayloadInspector");
        _agent?.Dispose();
        return Task.CompletedTask;
    }

    public void Dispose() => _agent?.Dispose();
}
