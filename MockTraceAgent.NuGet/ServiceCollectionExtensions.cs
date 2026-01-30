using Microsoft.Extensions.DependencyInjection;

namespace MockTraceAgent;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddMockTraceAgent(
        this IServiceCollection services,
        Action<MockTraceAgentOptions>? configure = null)
    {
        if (configure != null)
        {
            services.Configure(configure);
        }
        else
        {
            services.Configure<MockTraceAgentOptions>(_ => { });
        }

        services.AddHostedService<MockTraceAgentService>();
        return services;
    }
}
