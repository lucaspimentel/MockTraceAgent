using Microsoft.AspNetCore.SignalR;

namespace MockTraceAgent.Web.Hubs;

public class TracesHub : Hub
{
    public async Task SendPayloadUpdate(string message)
    {
        await Clients.All.SendAsync("ReceivePayloadUpdate", message);
    }
}
