using System;
using System.Collections.Generic;

namespace MockTraceAgent;

public class RequestReceivedEventArgs : EventArgs
{
    public byte[] Contents { get; }

    public IList<IList<Span>> TraceChunks { get; }

    public RequestReceivedEventArgs(byte[] contents, IList<IList<Span>> traceChunks)
    {
        Contents = contents;
        TraceChunks = traceChunks;
    }
}
