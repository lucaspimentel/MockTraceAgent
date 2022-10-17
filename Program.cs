using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using MessagePack;
using MockTraceAgent;

const int port = 8126;
var agent = new TraceAgent(port);

var jsonSerializerOptions = new JsonSerializerOptions
                            {
                                WriteIndented = true
                            };

agent.RequestReceived += (_, args) =>
                         {
                             try
                             {
                                 DateTime now = DateTime.Now;
                                 Console.Write($"{now:yyyy-MM-dd HH:mm:ss.ff} Received from {args.Url}");

                                 if (args.Url == "/v0.4/traces")
                                 {
                                     var traceChunks = MessagePackSerializer.Deserialize<IList<IList<Span>>>(args.Contents);
                                     int chunkCount = traceChunks.Count;
                                     int spanCount = traceChunks.Sum(t => t.Count);

                                     Console.Write($" {args.Contents.Length:N0} bytes, {chunkCount:N0} trace chunks, {spanCount:N0} total spans.");

                                     if (spanCount > 0)
                                     {
                                         var filename = $"trace-chunk-{now:yyyy-MM-dd HH-mm-ss-ff}.json";
                                         using var stream = File.OpenWrite(filename);
                                         JsonSerializer.Serialize(stream, traceChunks, jsonSerializerOptions);
                                         Console.Write($" Saved to {filename}.");
                                     }
                                 }

                                 Console.WriteLine();
                             }
                             catch(Exception e)
                             {
                                 Console.WriteLine(e.ToString());
                             }
                         };

Console.WriteLine($"Listening for traces on port {port}. Press [ENTER] to exit.");
Console.ReadLine();

agent.Dispose();
