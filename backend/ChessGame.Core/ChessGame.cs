﻿using Chess.Common.Helpers;
using Chess.Common.Interfaces;
using ChessGame.Core.Figures;
using ChessGame.Core.Figures.Helpers;
using ChessGame.Core.Moves;
using ChessGame.Core.Moves.Helpers;
using System.Collections.Generic;

namespace ChessGame.Core
{
    public class ChessGameEngine : IChessGame
    {
        private Move _currentMove;
        public const string DefaultFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        public string Fen { get; private set; }
        public Chess.Common.Helpers.Color MateTo { get; private set; } = Chess.Common.Helpers.Color.None;
        public Chess.Common.Helpers.Color CheckTo { get; private set; } = Chess.Common.Helpers.Color.None;
        public bool IsStaleMate { get; internal set; } = false;
        public bool IsInsufficientMaterial { get; internal set; } = false;
        internal Board Board { get; private set; }
        // Defined by the amount of pieces remaining on the board in the evaluation function.If the chess board is in an end game
        // state certain behaviors will be modified to increase king safety and mate opportunities.
        internal bool IsEndOfGamePhase { get; internal set; }
        /// <summary>
        /// Forsyth–Edwards Notation (FEN) is a standard notation for describing a particular board position of a chess game. The purpose of FEN is to provide all the necessary information to restart a game from a particular position.
        /// </summary>
        /// <param name="fen">Forsyth–Edwards Notation</param>
        /// <remarks>https://en.wikipedia.org/wiki/Forsyth–Edwards_Notation</remarks>
        public ChessGameEngine()
        {
        }

        private ChessGameEngine(Board board)
        {
            Board = board;
            Fen = board.Fen;
            _currentMove = new Move(board);
        }

        public IChessGame InitGame(string fen = DefaultFen)
        {
            //"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            // 0-позиция фигур                             1 2    3 4 5
            // 0 - позиция фигур,  1 - чей ход, 2 - флаги рокировки
            // 3 - правило битого поля, 4 - колич. ходов для правила 50 ходов
            // 5 - номер хода
            Fen = fen;
            Board = new Board(fen);
            _currentMove = new Move(Board);
            return this;
        }

        public IChessGame InitGame(ChessGameInitSettings initialSettings)
        {
            Fen = initialSettings.Fen;
            Board = new Board(Fen)
            {
                IsBlackCastled = initialSettings.IsBlackCastled,
                IsWhiteCastled = initialSettings.IsWhiteCastled,
                IsEnpassantRuleEnabled = initialSettings.IsEnpassantRuleEnabled,
                IsFiftyMovesRuleEnabled = initialSettings.IsFiftyMovesRuleEnabled,
                IsThreefoldRepetitionRuleEnabled = initialSettings.IsThreefoldRepetitionRuleEnabled
            };
            _currentMove = new Move(Board);
            return this;
        }

        public IChessGame Move(string move) // Pe2e4  Pe7e8Q
        {
            var movingFigure = new MovingFigure(move);
            if (Board.GetFigureAt(movingFigure.From) == Figure.None)
                return this;
            if((movingFigure.Figure == Figure.BlackKing || movingFigure.Figure == Figure.WhiteKing)
                && (movingFigure.AbsDeltaX == 2 && movingFigure.AbsDeltaY == 0)) // its castling
            {
                var targetColor = movingFigure.Figure.GetColor();
                if (targetColor != Board.MoveColor)
                    return this;
                var isToKingside = movingFigure.SignX > 0;
                if (CanKingCastle(isToKingside))
                {
                    return Castle(isToKingside);
                }
                else
                {
                    return this;
                }
            }
            if (!_currentMove.CanMove(movingFigure))
                return this;
            if (Board.IsCheckAfterMove(movingFigure))
            {
                return this;
            }
            var nextBoard = Board.Move(movingFigure);
            var nextChessPosition = new ChessGameEngine(nextBoard);

            if (nextBoard.IsCheckAfterMove(movingFigure))
            {
                CheckTo = (Chess.Common.Helpers.Color)nextBoard.MoveColor;
#warning is not requared to compute all moves, only one enought 
                if (nextChessPosition.ComputeAllMoves().Count < 1)
                    MateTo = (Chess.Common.Helpers.Color)nextBoard.MoveColor;
            } else
            {
                CheckTo = Chess.Common.Helpers.Color.None;
            }
            return nextChessPosition;
        }

        private IChessGame Castle(bool isToKingside)
        {
            var isWhiteSide = Board.MoveColor == Moves.Helpers.Color.White;
            var king = (isWhiteSide) ? Figure.WhiteKing : Figure.BlackKing;
            var rookFigure = (isWhiteSide) ? Figure.WhiteRook : Figure.BlackRook;
            var y = (isWhiteSide) ? 0 : 7;
            var stepX = (isToKingside) ? 1 : -1;
            FigureOnSquare rook;

            if(stepX == -1)
            {
                rook = new FigureOnSquare(rookFigure, new Square(0, y));
            } else
            {
                rook = new FigureOnSquare(rookFigure, new Square(7, y));
            }
            var firstKingDestSquare = new Square(4 + stepX, y);
            var finalKingDestSquare = new Square(firstKingDestSquare.X + stepX, y);

            var nextBoard = Board.Castle(new MovingFigure(new FigureOnSquare(king, new Square(4, y)), finalKingDestSquare), new MovingFigure(rook, firstKingDestSquare));
#warning if castle is done => change castle bool property
            return new ChessGameEngine(nextBoard);
        }

        private bool CanKingCastle(bool isToKingside)
        {
            if (Board.MoveColor == Moves.Helpers.Color.White && Board.IsWhiteCastled 
                || Board.MoveColor == Moves.Helpers.Color.Black && Board.IsBlackCastled)
                return false;
            Board.MoveColor = Board.MoveColor.FlipColor();
            if (Board.IsCheckTo())
            {
                Board.MoveColor = Board.MoveColor.FlipColor();
                return false;
            }
            Board.MoveColor = Board.MoveColor.FlipColor();
            var isWhiteSide = Board.MoveColor == Moves.Helpers.Color.White;
            var king = (isWhiteSide) ? Figure.WhiteKing : Figure.BlackKing;
            var rookFigure = (isWhiteSide) ? Figure.WhiteRook : Figure.BlackRook;
            var y = (isWhiteSide) ? 0 : 7;
            var stepX = (isToKingside) ? 1 : -1;
            if (!IsCastlingPossible(stepX > 0, king.GetColor()))
            {
                return false;
            }
            MovingFigure mf;

            if (stepX == -1)
            {
                if (Board.GetFigureAt(1, y) != Figure.None ||
                    Board.GetFigureAt(2, y) != Figure.None ||
                    Board.GetFigureAt(3, y) != Figure.None)
                {
                    return false;
                }
            }
            else
            {
                if(Board.GetFigureAt(6, y) != Figure.None ||
                    Board.GetFigureAt(5, y) != Figure.None)
                {
                    return false;
                }
            }
            var firstKingDestSquare = new Square(4 + stepX, y);
            mf = new MovingFigure(new FigureOnSquare(king, new Square(4, y)), firstKingDestSquare);
            if (!_currentMove.CanMove(mf))
                return false;
            if (Board.IsCheckAfterMove(mf))
                return false;

            var boardAfterFirstMove = Board.GetBoardAfterFirstKingCastlingMove(mf);
            var moveAfterFirstKingMove = new Move(boardAfterFirstMove);
            var finalKingDestSquare = new Square(firstKingDestSquare.X + stepX, y);
            mf = new MovingFigure(new FigureOnSquare(king, firstKingDestSquare), finalKingDestSquare);
            if (!moveAfterFirstKingMove.CanMove(mf))
                return false;
            if (boardAfterFirstMove.IsCheckAfterMove(mf))
                return false;

            return true;
        }

        public char GetFigureAt(int x, int y)
        {
            var targetSquare = new Square(x, y);
            var figure = Board.GetFigureAt(targetSquare);
            return figure == Figure.None ? '.' : (char)figure;
        }

        public List<string> GetAllValidMovesForFigureAt(int x, int y)
        {
            var validMoves = new List<string>();
            var targetSquare = new Square(x, y);
            if (!targetSquare.IsOnBoard())
                return validMoves;

            var targetFigure = Board.GetFigureAt(targetSquare);
            if (targetFigure == Figure.None || targetFigure.GetColor() != Board.MoveColor)
                return validMoves;

            var figureOnSquare = new FigureOnSquare(targetFigure, targetSquare);
            MovingFigure movingFigure;
            foreach (var squareTo in Square.YieldSquares())
            {
                movingFigure = new MovingFigure(figureOnSquare, squareTo);
                if (_currentMove.CanMove(movingFigure) &&
                    !Board.IsCheckAfterMove(movingFigure))
                    validMoves.Add(((char)('a' + squareTo.X)).ToString() + (squareTo.Y + 1));
            }

            if(targetFigure == Figure.BlackKing || targetFigure == Figure.WhiteKing)
            {
                if (CanKingCastle(true))
                {
                    validMoves.Add($"g{y + 1}");
                }
                if (CanKingCastle(false))
                {
                    validMoves.Add($"c{y + 1}");
                }
            }

            return validMoves;
        }

#warning перенести в board
        private List<MovingFigure> ComputeAllMoves()
        {
            var allMoves = new List<MovingFigure>();
            MovingFigure movingFigure;
            foreach (var figureOnSquare in Board.YieldFigures())
            {
                foreach (var squareTo in Square.YieldSquares())
                {
                    movingFigure = new MovingFigure(figureOnSquare, squareTo);
                    if (_currentMove.CanMove(movingFigure) &&
                        !Board.IsCheckAfterMove(movingFigure))
                        allMoves.Add(movingFigure);
                }
            }

            return allMoves;
        }
    
        private bool IsCastlingPossible(bool isKingside, Moves.Helpers.Color color)
        {
            var currentCastrlingFenPart = ((color == Moves.Helpers.Color.White) ? Board.WhiteCastlingFenPart : Board.BlackCastlingFenPart).ToLower();
            return (isKingside) ? currentCastrlingFenPart.Contains('k') : currentCastrlingFenPart.Contains('q');
        }

        public bool Equals(IChessGame other)
        {
            if (other == null || !string.Equals(this.Fen, other.Fen))
                return false;
            else
                return true;
        }
    }
}
