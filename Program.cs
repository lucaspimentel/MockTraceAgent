using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using MockTraceAgent;

const int port = 8126;
var agent = new TraceAgent(port);

var jsonSerializerOptions = new JsonSerializerOptions
                            {
                                WriteIndented = true
                            };

agent.RequestReceived += (_, args) =>
                         {
                             DateTime now = DateTime.Now;
                             int chunkCount = args.TraceChunks.Count;
                             int spanCount = args.TraceChunks.SelectMany(t => t).Count();

                             Console.Write($"{now:yyyy-MM-dd HH:mm:ss.ff} Received {args.Contents.Length:N0} bytes, {chunkCount:N0} trace chunks, {spanCount:N0} total spans.");

                             if (spanCount > 0)
                             {
                                 var filename = $"trace-chunk-{now:yyyy-MM-dd HH-mm-ss-ff}.json";
                                 using var stream = File.OpenWrite(filename);
                                 JsonSerializer.Serialize(stream, args.TraceChunks, jsonSerializerOptions);
                                 Console.Write($" Saved to {filename}.");
                             }

                             Console.WriteLine();
                         };

Console.WriteLine($"Listening for traces on port {port}. Press [ENTER] to exit.");
Console.ReadLine();

agent.Dispose();
