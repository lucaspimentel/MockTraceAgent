using System;
using System.Buffers.Text;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Collections.Specialized;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using MessagePack;

namespace MockTraceAgent
{
    public sealed class MockTracerAgent : IDisposable
    {
        private readonly HttpListener _listener;
        private readonly Thread _listenerThread;
        private readonly byte[] _responseBytes = Encoding.UTF8.GetBytes("{}");

        public event EventHandler<TracesReceivedEventArgs>? TracesReceived;

        public MockTracerAgent(int port)
        {
            var listener = new HttpListener();
            string portString = port.ToString();

            listener.Prefixes.Add($"http://127.0.0.1:{portString}/");
            listener.Prefixes.Add($"http://localhost:{portString}/");

            try
            {
                listener.Start();
                _listener = listener;

                _listenerThread = new Thread(HandleHttpRequests);
                _listenerThread.Start();
            }
            catch (Exception)
            {
                listener.Close();
                throw;
            }
        }

        public void Dispose()
        {
            if (_listener != null)
            {
                _listener.Stop();
                _listener.Close();
            }
        }

        private void OnTracesReceived(IList<IList<Span>> traces)
        {
            TracesReceived?.Invoke(this, new TracesReceivedEventArgs(traces));
        }

        private void HandleHttpRequests()
        {
            while (_listener.IsListening)
            {
                try
                {
                    var ctx = _listener.GetContext();
                    var spans = MessagePackSerializer.Deserialize<IList<IList<Span>>>(ctx.Request.InputStream);
                    OnTracesReceived(spans);

                    // NOTE: HttpStreamRequest doesn't support Transfer-Encoding: Chunked
                    // (Setting content-length avoids that)
                    ctx.Response.ContentType = "application/json";
                    ctx.Response.ContentLength64 = _responseBytes.LongLength;
                    ctx.Response.OutputStream.Write(_responseBytes, 0, _responseBytes.Length);
                    ctx.Response.Close();
                }
                catch (HttpListenerException)
                {
                    // listener was stopped,
                    // ignore to let the loop end and the method return
                }
                catch (ObjectDisposedException)
                {
                    // the response has been already disposed.
                }
                catch (InvalidOperationException)
                {
                    // this can occur when setting Response.ContentLength64, with the framework claiming that the response has already been submitted
                    // for now ignore, and we'll see if this introduces downstream issues
                }
                catch (Exception) when (!_listener.IsListening)
                {
                    // we don't care about any exception when listener is stopped
                }
            }
        }
    }
}
