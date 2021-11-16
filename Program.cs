using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using MockTraceAgent;

const int port = 8126;
var agent = new MockTracerAgent(port);

var jsonSerializerOptions = new JsonSerializerOptions
                            {
                                WriteIndented = true
                            };

agent.TracesReceived += (_, args) =>
                        {
                            var now = DateTime.Now;

                            int chunkCount = args.TraceChunks.Count;
                            int spanCount = args.TraceChunks.SelectMany(t => t).Count();
                            Console.Write($"{now:yyyy-MM-dd HH:mm:ss.ff} Received {chunkCount:N0} trace chunks with {spanCount:N0} total spans.");

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
