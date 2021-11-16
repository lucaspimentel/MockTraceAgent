using System;
using System.Collections.Generic;

namespace MockTraceAgent
{
    public class TracesReceivedEventArgs : EventArgs
    {
        public IList<IList<Span>> TraceChunks { get; }

        public TracesReceivedEventArgs(IList<IList<Span>> traceChunks)
        {
            TraceChunks = traceChunks;
        }
    }
}
