using Microsoft.Extensions.DependencyInjection;

namespace Datadog.Apm.TracerPayloadInspector;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTracerPayloadInspector(
        this IServiceCollection services,
        Action<TracerPayloadInspectorOptions>? configure = null)
    {
        if (configure != null)
        {
            services.Configure(configure);
        }
        else
        {
            services.Configure<TracerPayloadInspectorOptions>(_ => { });
        }

        services.AddHostedService<TracerPayloadInspectorService>();
        return services;
    }
}
