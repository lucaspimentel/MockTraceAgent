namespace Datadog.Apm.TracerPayloadInspector;

public class TracerPayloadInspectorOptions
{
    public int ListeningPort { get; set; } = 8126;

    public bool DeserializeContents { get; set; }

    public Action<RequestReceivedCallbackArgs>? RequestReceivedCallback { get; set; }
}
