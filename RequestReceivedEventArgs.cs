using System;

namespace MockTraceAgent;

public class RequestReceivedEventArgs : EventArgs
{
    public string? Url { get; }
    public byte[] Contents { get; }

    public RequestReceivedEventArgs(string? url, byte[] contents)
    {
        Url = url;
        Contents = contents;
    }
}
