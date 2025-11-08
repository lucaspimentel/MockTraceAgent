using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using MockTraceAgent.Core;

namespace MockTraceAgent.Web.Services;

public class TraceAgentHostedService : IHostedService, IDisposable
{
    private readonly TraceStorageService _storage;
    private readonly ILogger<TraceAgentHostedService> _logger;
    private readonly IConfiguration _configuration;
    private TraceAgent? _agent;

    public TraceAgentHostedService(
        TraceStorageService storage,
        ILogger<TraceAgentHostedService> logger,
        IConfiguration configuration)
    {
        _storage = storage;
        _logger = logger;
        _configuration = configuration;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var port = _configuration.GetValue<int>("TraceAgentPort", 8126);

        _logger.LogInformation("Starting TraceAgent on port {Port}", port);

        _agent = new TraceAgent(
            port,
            async (url, length, contents) => await _storage.AddTrace(url, length, contents),
            readRequestBytes: true);

        _logger.LogInformation("TraceAgent started successfully on port {Port}", port);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping TraceAgent");
        _agent?.Dispose();
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _agent?.Dispose();
    }
}
