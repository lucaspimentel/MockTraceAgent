using Datadog.Apm.TracerPayloadInspector.Cli;
using Spectre.Console.Cli;

var app = new CommandApp<ListenCommand>();
return app.Run(args);
