using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading;
using MessagePack;

namespace MockTraceAgent;

public sealed class TraceAgent : IDisposable
{
    private readonly HttpListener _listener;
    private readonly Thread _listenerThread;
    private readonly ReadOnlyMemory<byte> _responseBytes = Encoding.UTF8.GetBytes("{}");

    public event EventHandler<RequestReceivedEventArgs>? RequestReceived;

    public TraceAgent(int port)
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

    private void OnRequestReceived(byte[] buffer, IList<IList<Span>> traceChunks)
    {
        RequestReceived?.Invoke(this, new RequestReceivedEventArgs(buffer, traceChunks));
    }

    private void HandleHttpRequests()
    {
        while (_listener.IsListening)
        {
            try
            {
                // this call blocks until we received a request
                var ctx = _listener.GetContext();

                var requestReceivedHandler = RequestReceived;

                if (requestReceivedHandler != null)
                {
                    var buffer = new byte[(int)ctx.Request.ContentLength64];
                    ctx.Request.InputStream.Read(buffer);
                    var traceChunks = MessagePackSerializer.Deserialize<IList<IList<Span>>>(buffer);
                    OnRequestReceived(buffer, traceChunks);
                }

                // Set content-length to prevent Transfer-Encoding: Chunked
                ctx.Response.ContentType = "application/json";
                ctx.Response.ContentLength64 = _responseBytes.Length;
                ctx.Response.OutputStream.Write(_responseBytes.Span);
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
