using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using MessagePack;
using Spectre.Console.Cli;

namespace MockTraceAgent;

internal sealed class ListenCommand : Command<ListenCommand.Settings>
{
    [Flags]
    public enum SaveOptions
    {
        None = 0,
        RawBytes = 1,
        ConvertToJson = 2,
        All = RawBytes | ConvertToJson
    }

    public sealed class Settings : CommandSettings
    {
        [CommandOption("-p|--port")]
        [DefaultValue(8126)]
        public int Port { get; init; }

        [CommandOption("-c|--show-counts")]
        [DefaultValue(false)]
        public bool ShowCounts { get; init; }

        [CommandOption("-s|--save")]
        [DefaultValue(SaveOptions.None)]
        [Description($"Valid options: {nameof(SaveOptions.None)}, {nameof(SaveOptions.RawBytes)}, {nameof(SaveOptions.ConvertToJson)}, {nameof(SaveOptions.All)}")]
        public SaveOptions SaveFileOptions { get; init; }

        [CommandOption("-f|--url-filter")]
        [DefaultValue("/traces")]
        public string? UrlFilter { get; init; }
    }

    public override int Execute([NotNull] CommandContext context, [NotNull] Settings settings)
    {
        var readRequestBytes = settings.ShowCounts || settings.SaveFileOptions != SaveOptions.None;

        var agent = new TraceAgent(
            settings.Port,
            (url, length, contents) => RequestReceived(
                url,
                length,
                contents,
                settings),
            readRequestBytes: readRequestBytes);

        if (settings.ShowCounts)
        {
            Console.WriteLine("Deserializing payload to show trace chunk and span counts.");
        }
        else
        {
            Console.WriteLine("Not deserializing payload to show trace chunk and span counts.");
        }

        switch (settings.SaveFileOptions)
        {
            case SaveOptions.None:
                Console.WriteLine("Not saving payloads to file.");
                break;
            case SaveOptions.RawBytes:
                Console.WriteLine("Saving raw payloads to file.");
                break;
            case SaveOptions.ConvertToJson:
                Console.WriteLine("Saving json payloads to file after conversion.");
                break;
            case SaveOptions.RawBytes | SaveOptions.ConvertToJson:
                Console.WriteLine("Saving both raw and json payloads to file after conversion.");
                break;
            default:
                Console.WriteLine("Invalid SaveOptions setting.");
                return 1;
        }

        Console.WriteLine($"Listening for traces on port {settings.Port}. Press [ENTER] to exit.");
        Console.ReadLine();

        agent.Dispose();
        return 0;
    }

    private static void RequestReceived(
        string url,
        int contentsLength,
        ReadOnlyMemory<byte> contents,
        Settings settings)
    {
        try
        {
            DateTime now = DateTime.Now;
            Console.Write($"{now:yyyy-MM-dd HH:mm:ss.ff} Received {contentsLength:N0} bytes at {url}. ");

            if (contents.Length > 0 && (settings.UrlFilter == null || url.Contains(settings.UrlFilter, StringComparison.OrdinalIgnoreCase)))
            {
                if (settings.ShowCounts && url == "/v0.4/traces")
                {
                    var traceChunks = MessagePackSerializer.Deserialize<IList<IList<Span>>>(contents);
                    int chunkCount = traceChunks.Count;
                    int spanCount = traceChunks.Sum(t => t.Count);

                    Console.Write($"{chunkCount:N0} trace chunks, {spanCount:N0} total spans. ");
                }

                if (settings.SaveFileOptions != SaveOptions.None)
                {
                    var filenameUrlPart = url.TrimStart('/').Replace('/', '_');

                    if ((settings.SaveFileOptions & SaveOptions.RawBytes) == SaveOptions.RawBytes)
                    {
                        var msgpackFilename = $"payload-{filenameUrlPart}-{now:yyyy-MM-dd_HH-mm-ss-ff}.bin";
                        using var msgpackFileStream = File.Create(msgpackFilename);
                        msgpackFileStream.Write(contents.Span);
                        Console.Write($"Saved raw bytes to \"{msgpackFilename}\". ");
                    }

                    if ((settings.SaveFileOptions & SaveOptions.ConvertToJson) == SaveOptions.ConvertToJson)
                    {
                        var jsonFilename = $"payload-{filenameUrlPart}-{now:yyyy-MM-dd_HH-mm-ss-ff}.json";
                        string json = MessagePackSerializer.ConvertToJson(contents);
                        File.WriteAllText(jsonFilename, json);
                        Console.Write($"Saved json to \"{jsonFilename}\". ");
                    }
                }
            }

            Console.WriteLine();
        }
        catch (Exception e)
        {
            Console.WriteLine(e.ToString());
        }
    }
}
