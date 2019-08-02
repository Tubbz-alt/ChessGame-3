﻿using ChessGame.Core.Figures;
using ChessGame.Core.Figures.Helpers;
using ChessGame.Core.Moves;
using System;
using System.Collections.Generic;
using System.Text;

namespace ChessGame.Core.Evaluation
{
    internal sealed class BoardEvaluation
    {
        private int[] whitePawnInColumnCount = new int[8], 
            blackPawnInColumnCount = new int[8];
        internal void EvaluateBoardScore(ChessGameEngine chessGame)
        {
            chessGame.Board.Score = 0;
            // to check Insufficient Material Tie Rule condition
            var insufficientMaterial = true;
            var board = chessGame.Board;

            #region BoardEventsScore

            if (chessGame.IsStaleMate
                || (board.IsThreefoldRepetitionRuleEnabled && board.RepeatedMovesCount >= 3)
                || (board.IsFiftyMovesRuleEnabled && board.FiftyMovesCount >= 50))
            {
                return;
            }

            switch (chessGame.CheckTo)
            {
                case Chess.Common.Helpers.Color.White:
                    {
                        board.Score += 75;
                        if (chessGame.IsEndOfGamePhase)
                        {
                            board.Score += 10;
                        }
                        break;
                    }
                case Chess.Common.Helpers.Color.Black:
                    {
                        board.Score -= 75;
                        if (chessGame.IsEndOfGamePhase)
                        {
                            board.Score -= 10;
                        }
                        break;
                    }
                case Chess.Common.Helpers.Color.None:
                default:
                    break;
            }
            switch (chessGame.MateTo)
            {
                case Chess.Common.Helpers.Color.White:
                    {
                        board.Score = -32767;
                        break;
                    }
                case Chess.Common.Helpers.Color.Black:
                    {
                        board.Score = 32767;
                        break;
                    }
                case Chess.Common.Helpers.Color.None:
                default:
                    break;
            }

            if (board.IsWhiteCastled)
            {
                board.Score += 40;
            }
            if (board.IsBlackCastled)
            {
                board.Score -= 40;
            }
            if (board.MoveColor == Moves.Helpers.Color.White)
            {
                board.Score += 10;
            }
            else
            {
                board.Score -= 10;
            }

            #endregion BoardEventsScore

            #region PiecesScore

            // to add bonus for dubled bishops and if there are 2 knight we cant call unsuffitial materail tie
            // Paradoxically, although the king and two knights cannot force checkmate of the lone king, 
            // there are positions in which the king and two knights can force checkmate against a king and some additional material
            var blackBishopsCount = 0;
            var whiteBishopsCount = 0;
            // to check insuffisient material tie rule
            // king and n * bishop (n > 0) on the same color versus king = draw
            // king and n * bishop (n > 0) versus king and m * bishops (m > 0) with all bishops on same color = draw
            var bishopsOnWhiteSquareCount = 0;
            var knightsCount = 0;
            var allFigures = new Dictionary<Square, FigureOnSquare>();

            MovingFigure movingFigure = null;
            var move = new Move(board);

            foreach (var figureOnSquare in board.YieldFigures())
            {
                if(!allFigures.ContainsKey(figureOnSquare.Square))
                {
                    allFigures.Add(figureOnSquare.Square, figureOnSquare);
                }
                foreach (var squareTo in Square.YieldSquares())
                {
                    movingFigure = new MovingFigure(figureOnSquare, squareTo);
                    // initialize Attacked/Deffended values
                    if (move.CanMove(movingFigure) &&
                        !board.IsCheckAfterMove(movingFigure))
                    {
                        figureOnSquare.ValidMovesCount++;
                    }
                }


            }
            
            foreach (var piece in allFigures.Values)
            {
                board.Score += EvaluatePieceScore(board, piece, chessGame.IsEndOfGamePhase, ref insufficientMaterial, ref (piece.Figure.GetColor() == Moves.Helpers.Color.White ? ref whiteBishopsCount : ref blackBishopsCount), ref bishopsOnWhiteSquareCount, ref knightsCount);
            }

            if(whiteBishopsCount + blackBishopsCount > 1 && (whiteBishopsCount + blackBishopsCount != bishopsOnWhiteSquareCount))
            {
                insufficientMaterial = false;
            }

            #endregion

            #region BoardLevelEventsHandling

            if(insufficientMaterial)
            {
                board.Score = 0;
                chessGame.IsStaleMate = true;
                chessGame.IsInsufficientMaterial = true;
                return;
            }
            if(allFigures.Count < 10)
            {
                chessGame.IsEndOfGamePhase = true;
            }

            #endregion BoardLevelEventsHandling

            #region DoubledIsolatedPawns

            //Black Isolated Pawns
            if (blackPawnInColumnCount[0] >= 1 && blackPawnInColumnCount[1] == 0)
            {
                board.Score += 12;
            }
            if (blackPawnInColumnCount[1] >= 1 && blackPawnInColumnCount[0] == 0 &&
            blackPawnInColumnCount[2] == 0)
            {
                board.Score += 14;
            }
            if (blackPawnInColumnCount[2] >= 1 && blackPawnInColumnCount[1] == 0 &&
            blackPawnInColumnCount[3] == 0)
            {
                board.Score += 16;
            }
            if (blackPawnInColumnCount[3] >= 1 && blackPawnInColumnCount[2] == 0 &&
            blackPawnInColumnCount[4] == 0)
            {
                board.Score += 20;
            }
            if (blackPawnInColumnCount[4] >= 1 && blackPawnInColumnCount[3] == 0 &&
            blackPawnInColumnCount[5] == 0)
            {
                board.Score += 20;
            }
            if (blackPawnInColumnCount[5] >= 1 && blackPawnInColumnCount[4] == 0 &&
            blackPawnInColumnCount[6] == 0)
            {
                board.Score += 16;
            }
            if (blackPawnInColumnCount[6] >= 1 && blackPawnInColumnCount[5] == 0 &&
            blackPawnInColumnCount[7] == 0)
            {
                board.Score += 14;
            }
            if (blackPawnInColumnCount[7] >= 1 && blackPawnInColumnCount[6] == 0)
            {
                board.Score += 12;
            }
            //White Isolated Pawns
            if (whitePawnInColumnCount[0] >= 1 && whitePawnInColumnCount[1] == 0)
            {
                board.Score -= 12;
            }
            if (whitePawnInColumnCount[1] >= 1 && whitePawnInColumnCount[0] == 0 &&
            whitePawnInColumnCount[2] == 0)
{
                board.Score -= 14;
            }
            if (whitePawnInColumnCount[2] >= 1 && whitePawnInColumnCount[1] == 0 &&
            whitePawnInColumnCount[3] == 0)
            {
                board.Score -= 16;
            }
            if (whitePawnInColumnCount[3] >= 1 && whitePawnInColumnCount[2] == 0 &&
            whitePawnInColumnCount[4] == 0)
            {
                board.Score -= 20;
            }
            if (whitePawnInColumnCount[4] >= 1 && whitePawnInColumnCount[3] == 0 &&
            whitePawnInColumnCount[5] == 0)
            {
                board.Score -= 20;
            }
            if (whitePawnInColumnCount[5] >= 1 && whitePawnInColumnCount[4] == 0 &&
            whitePawnInColumnCount[6] == 0)
            {
                board.Score -= 16;
            }
            if (whitePawnInColumnCount[6] >= 1 && whitePawnInColumnCount[5] == 0 &&
            whitePawnInColumnCount[7] == 0)
            {
                board.Score -= 14;
            }
            if (whitePawnInColumnCount[7] >= 1 && whitePawnInColumnCount[6] == 0)
            {
                board.Score -= 12;
            }
            //Black Passed Pawns
            if (blackPawnInColumnCount[0] >= 1 && whitePawnInColumnCount[0] == 0)
            {
                board.Score -= blackPawnInColumnCount[0];
            }
            if (blackPawnInColumnCount[1] >= 1 && whitePawnInColumnCount[1] == 0)
            {
                board.Score -= blackPawnInColumnCount[1];
            }
            if (blackPawnInColumnCount[2] >= 1 && whitePawnInColumnCount[2] == 0)
            {
                board.Score -= blackPawnInColumnCount[2];
            }
            if (blackPawnInColumnCount[3] >= 1 && whitePawnInColumnCount[3] == 0)
            {
                board.Score -= blackPawnInColumnCount[3];
            }
            if (blackPawnInColumnCount[4] >= 1 && whitePawnInColumnCount[4] == 0)
            { 
                board.Score -= blackPawnInColumnCount[4];
            }
            if (blackPawnInColumnCount[5] >= 1 && whitePawnInColumnCount[5] == 0)
            {
                board.Score -= blackPawnInColumnCount[5];
            }
            if (blackPawnInColumnCount[6] >= 1 && whitePawnInColumnCount[6] == 0)
            {
                board.Score -= blackPawnInColumnCount[6];
            }
            if (blackPawnInColumnCount[7] >= 1 && whitePawnInColumnCount[7] == 0)
            {
                board.Score -= blackPawnInColumnCount[7];
            }
            //White Passed Pawns
            if (whitePawnInColumnCount[0] >= 1 && blackPawnInColumnCount[1] == 0)
            {
                board.Score += whitePawnInColumnCount[0];
            }
            if (whitePawnInColumnCount[1] >= 1 && blackPawnInColumnCount[1] == 0)
            {
                board.Score += whitePawnInColumnCount[1];
            }
            if (whitePawnInColumnCount[2] >= 1 && blackPawnInColumnCount[2] == 0)
            {
                board.Score += whitePawnInColumnCount[2];
            }
            if (whitePawnInColumnCount[3] >= 1 && blackPawnInColumnCount[3] == 0)
            {
                board.Score += whitePawnInColumnCount[3];
            }
            if (whitePawnInColumnCount[4] >= 1 && blackPawnInColumnCount[4] == 0)
            {
                board.Score += whitePawnInColumnCount[4];
            }
            if (whitePawnInColumnCount[5] >= 1 && blackPawnInColumnCount[5] == 0)
            {
                board.Score += whitePawnInColumnCount[5];
            }
            if (whitePawnInColumnCount[6] >= 1 && blackPawnInColumnCount[6] == 0)
            {
                board.Score += whitePawnInColumnCount[6];
            }
            if (whitePawnInColumnCount[7] >= 1 && blackPawnInColumnCount[7] == 0)
            {
                board.Score += whitePawnInColumnCount[7];
            }

            #endregion DoubledIsolatedPawns
        }
        /// <summary>
        /// Computes the single piece score.
        /// </summary>
        /// <returns>Score value</returns>
        private int EvaluatePieceScore(Board board, FigureOnSquare piece, bool isEndOfGame, ref bool insufficientMaterial, ref int bishopsCount, ref int bishopsOnWhiteSquareCount, ref int knightsCount)
        {
            var score = 0;
            var posX = piece.Square.X;
            score += piece.Value;
            score += piece.DefendedValue;
            score -= piece.AttackedValue;
            // If the chess piece is getting attacked and it is not protected then will consider we are about to lose it.
            // => double penalty
            if (piece.DefendedValue < piece.AttackedValue)
            {
                score -= ((piece.AttackedValue - piece.DefendedValue) * 10);
            }
            // Add score for mobility.
            score += piece.ValidMovesCount;

            switch (piece.Figure)
            {
                case Figure.BlackPawn:
                case Figure.WhitePawn:
                    {
                        insufficientMaterial = false;
                        score += EvaluatePawnScore(piece);
                        break;
                    }
                case Figure.BlackKnight:
                case Figure.WhiteKnight:
                    {
                        knightsCount++;
                        if (knightsCount > 1)
                        {
                            insufficientMaterial = false;
                        }
                        // knights are worth less in the end game since it is difficult to mate with a knight
                        // hence they lose 10 points during the end game.
                        if (isEndOfGame)
                        {
                            score -= 10;
                        }
                        break;
                    }
                case Figure.BlackBishop:
                case Figure.WhiteBishop:
                    {
                        // to check insuffisient material tie rule
                        // king and n * bishop (n > 0) on the same color versus king = draw
                        // king and n * bishop (n > 0) versus king and m * bishops (m > 0) with all bishops on same color = draw
                        if (piece.Square.GetSquareColor() == Moves.Helpers.Color.White)
                        {
                            bishopsOnWhiteSquareCount++;
                        }
                        // Bishops are worth more in the end game, also we add a small bonus for having 2 bishops
                        // since they complement each other by controlling different ranks.
                        bishopsCount++;
                        if(bishopsCount >= 2)
                        {
                            score += 10;
                        }
                        if(isEndOfGame)
                        {
                            score += 10;
                        }
                        break;
                    }
                    // Rooks shouldnt leave their corner positions before castling has occured
                case Figure.BlackRook:
                    {
                        insufficientMaterial = false;
                        if (!board.IsBlackCastled && !((piece.Square.X == 0 && board.BlackCastlingFenPart.Contains('k')) || (piece.Square.X == 7 && board.BlackCastlingFenPart.Contains('q'))))
                        {
                            score -= 10;
                        }
                        break;
                    }
                case Figure.WhiteRook:
                    {
                        insufficientMaterial = false;
                        if (!board.IsWhiteCastled && !((piece.Square.X == 0 && board.WhiteCastlingFenPart.Contains('K')) || (piece.Square.X == 7 && board.WhiteCastlingFenPart.Contains('Q'))))
                        {
                            score -= 10;
                        }
                        break;
                    }
                case Figure.BlackQueen:
                case Figure.WhiteQueen:
                    {
                        insufficientMaterial = false;
                        break;
                    }
                case Figure.BlackKing:
                    {
                        // If he has less than 2 move, he possibly one move away from mate.
                        if (piece.ValidMovesCount < 2)
                        {
                            score -= 5;
                        }
                        // penalty for losing ability to castle
                        if (!board.IsBlackCastled && string.IsNullOrWhiteSpace(board.BlackCastlingFenPart))
                        {
                            score -= 30;
                        }
                        break;
                    }
                case Figure.WhiteKing:
                    {
                        // If he has less than 2 move, he possibly one move away from mate.
                        if (piece.ValidMovesCount < 2)
                        {
                            score -= 5;
                        }
                        // penalty for losing ability to castle
                        if (!board.IsWhiteCastled && string.IsNullOrWhiteSpace(board.WhiteCastlingFenPart))
                        {
                            score -= 30;
                        }
                        break;
                    }
                case Figure.None:
                default:
                    break;
            }

            // add position value
            score += piece.Figure.GetPieceSquareTableScore(piece.Square.X, piece.Square.Y, isEndOfGame);

            return score;
        }

        /// <summary>
        /// Perform evaluation for pawn: 
        /// Remove some points for pawns on the edge of the board. The idea is that since a pawn of the edge can
        /// only attack one way it is worth 15% less.
        /// Give an extra bonus for pawns that are on the 6th and 7th rank as long as they are not attacked in any way
        /// Add points based on the Pawn Piece Square Table Lookup.
        /// </summary>
        /// <returns></returns>
        private int EvaluatePawnScore(FigureOnSquare piece)
        {
            var score = 0;
            var posX = piece.Square.X;


            if (posX == 0 || posX == 7)
            {
                //Rook Pawns are worth 15% less because they can only attack one way
                score -= 15;
            }

            if (piece.Figure.GetColor() == Moves.Helpers.Color.White)
            {
                if (whitePawnInColumnCount[posX] > 0)
                {
                //Doubled Pawn
                score -= 16;
                }
                if (piece.Square.Y  == 1)
                {
                    if (piece.AttackedValue == 0)
                    {
                        whitePawnInColumnCount[posX] += 200;
                        if (piece.DefendedValue != 0)
                            whitePawnInColumnCount[posX] += 50;
                    }
                }
                else if (piece.Square.Y == 2)
                {
                    if (piece.AttackedValue == 0)
                    {
                        whitePawnInColumnCount[posX] += 100;
                        if (piece.DefendedValue != 0)
                            whitePawnInColumnCount[posX] += 25;
                    }
                }
                whitePawnInColumnCount[posX] += 10;
            }
            else
            {
                if (blackPawnInColumnCount[posX] > 0)
                {
                    //Doubled Pawn
                    score -= 16;
                }
                if (posX == 6)
                {
                    if (piece.AttackedValue == 0)
                    {
                        blackPawnInColumnCount[posX] += 200;
                        if (piece.DefendedValue != 0)
                            blackPawnInColumnCount[posX] += 50;
                    }
                }
                //Pawns in 6th Row that are not attacked are worth more points.
                else if (posX == 5)
                {
                    if (piece.AttackedValue == 0)
                    {
                        blackPawnInColumnCount[posX] += 100;
                        if (piece.DefendedValue != 0)
                            blackPawnInColumnCount[posX] += 25;
                    }
                }
                blackPawnInColumnCount[posX] += 10;
            }

            return score;
        }
    }
}
