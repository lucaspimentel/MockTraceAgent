namespace Datadog.Apm.TracerPayloadInspector;

public class TracerPayloadInspectorOptions
{
    public int Port { get; set; } = 8126;
    public Action<string, int, ReadOnlyMemory<byte>>? RequestReceivedCallback { get; set; }
}
