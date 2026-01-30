using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MockTraceAgent.Core;

namespace MockTraceAgent;

public sealed class MockTraceAgentService : IHostedService, IDisposable
{
    private readonly MockTraceAgentOptions _options;
    private readonly ILogger<MockTraceAgentService> _logger;
    private TraceAgent? _agent;

    public MockTraceAgentService(
        IOptions<MockTraceAgentOptions> options,
        ILogger<MockTraceAgentService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting MockTraceAgent on port {Port}", _options.Port);

        _agent = new TraceAgent(
            _options.Port,
            _options.RequestReceivedCallback,
            readRequestBytes: _options.RequestReceivedCallback != null);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping MockTraceAgent");
        _agent?.Dispose();
        return Task.CompletedTask;
    }

    public void Dispose() => _agent?.Dispose();
}
