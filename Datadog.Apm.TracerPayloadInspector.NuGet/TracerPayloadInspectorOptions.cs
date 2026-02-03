namespace Datadog.Apm.TracerPayloadInspector;

public class TracerPayloadInspectorOptions
{
    public int ListeningPort { get; set; } = 8126;

    public bool ReadContents { get; set; } = true;

    public bool DeserializeContents { get; set; } = true;

    public bool ConvertToJson { get; set; } = true;

    public Action<RequestReceivedCallbackArgs>? RequestReceivedCallback { get; set; }
}
