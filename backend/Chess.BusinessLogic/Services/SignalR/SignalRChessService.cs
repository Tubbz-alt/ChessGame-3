﻿using Chess.BusinessLogic.Hubs;
using Chess.BusinessLogic.Interfaces.SignalR;
using Chess.Common.Interfaces;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Chess.Common.Helpers;

namespace Chess.BusinessLogic.Services.SignalR
{
    public class SignalRChessService : SignalRAbsService<ChessGameHub>, ISignalRChessService
    {
        public SignalRChessService(IHubContext<ChessGameHub> hubContext, ICurrentUser currentUserProvider)
            : base(hubContext, currentUserProvider)
        {

        }

        public async Task CommitMove(int gameId)
        {
            await _hubContext
                .Clients
                .Group($"{HubGroup.Game.GetStringValue()}{gameId}")
                .SendAsync(ClientEvent.MoveCommitted.GetStringValue());
        }
    }
}
