using System;
using System.Buffers;
using System.Net;
using System.Threading;

namespace MockTraceAgent.Core;

public sealed class TraceAgent : IDisposable
{
    private static readonly byte[] ResponseBytes = "{}"u8.ToArray();

    private readonly HttpListener _listener;
    private readonly Thread _listenerThread;
    private readonly Action<string, int, ReadOnlyMemory<byte>>? _requestReceivedCallback;
    private readonly bool _readRequestBytes;
    private bool _disposed;

    public TraceAgent(int port, Action<string, int, ReadOnlyMemory<byte>>? requestReceivedCallback, bool readRequestBytes)
    {
        _requestReceivedCallback = requestReceivedCallback;
        _readRequestBytes = readRequestBytes;

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
        if (_disposed)
        {
            return;
        }

        _disposed = true;

        try
        {
            if (_listener != null! && _listener.IsListening)
            {
                _listener.Stop();
            }
        }
        catch (ObjectDisposedException)
        {
            // Listener already disposed, ignore
        }

        try
        {
            _listener?.Close();
        }
        catch (ObjectDisposedException)
        {
            // Listener already disposed, ignore
        }
    }

    private void HandleHttpRequests()
    {
        while (_listener.IsListening)
        {
            try
            {
                // this call blocks until we receive a request
                var ctx = _listener.GetContext();

                if (_requestReceivedCallback != null)
                {
                    var contentLength = (int)ctx.Request.ContentLength64;
                    byte[]? rentedBuffer;
                    ReadOnlyMemory<byte> memory;

                    if (_readRequestBytes)
                    {
                        rentedBuffer = ArrayPool<byte>.Shared.Rent(contentLength);
                        var bytesRead = ctx.Request.InputStream.Read(rentedBuffer, 0, contentLength);
                        memory = new ReadOnlyMemory<byte>(rentedBuffer, 0, bytesRead);
                    }
                    else
                    {
                        rentedBuffer = null;
                        memory = null;
                    }

                    _requestReceivedCallback(ctx.Request.RawUrl ?? "no-url", contentLength, memory);

                    if (rentedBuffer != null)
                    {
                        ArrayPool<byte>.Shared.Return(rentedBuffer);
                    }
                }

                // Set content-length to prevent Transfer-Encoding: Chunked
                ctx.Response.ContentType = "application/json";
                ctx.Response.ContentLength64 = ResponseBytes.Length;
                ctx.Response.OutputStream.Write(ResponseBytes);
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
