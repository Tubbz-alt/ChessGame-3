﻿namespace Chess.Common.DTOs
{
    public class CommitedMoveDTO
    {
        public int Id { get; set; }
        public GameDTO Game { get; set; }
        public int? GameId { get; set; }
        public PlayerDTO Player { get; set; }
        public int? PlayerId { get; set; }
        public int Ply { get; set; } // номер полухода (ход * 2)
        public string FenBeforeMove { get; set; } // состояние до хода 
        public string FenAfterMove { get; set; }
        public string MoveNext { get; set; }  // сам ход
    }
}