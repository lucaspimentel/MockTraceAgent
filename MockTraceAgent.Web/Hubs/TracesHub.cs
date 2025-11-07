using Microsoft.AspNetCore.SignalR;

namespace MockTraceAgent.Web.Hubs;

public class TracesHub : Hub
{
    public async Task SendTraceUpdate(string message)
    {
        await Clients.All.SendAsync("ReceiveTraceUpdate", message);
    }
}
