import { Component, OnInit, Input, Output, SimpleChange, EventEmitter, OnDestroy } from '@angular/core';
import { PieceType, BoardTextureType, Square, Move, GameSettings, GameSide, MoveRequest } from '../../../core';
import { BehaviorSubject } from 'rxjs';

@Component({
	selector: 'app-chess-board',
	templateUrl: './chess-board.component.html',
	styleUrls: ['./chess-board.component.less']
})
export class ChessBoardComponent implements OnInit {
	@Input() gameSettings: GameSettings;// = new GameSettings();
	@Input() fen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	@Output() error: EventEmitter<Error> = new EventEmitter<Error>(null);
	@Output() moveRequest: EventEmitter<MoveRequest> = new EventEmitter<MoveRequest>(null);
	private previousFen: string;
	private baseBoardPath: BehaviorSubject<string> = new BehaviorSubject<string>(null);
	private basePiecePath: BehaviorSubject<string> = new BehaviorSubject<string>(null);
	private bgColor = "#813A0D";
	private _squares: Square[];
	private selectedSquare: Square;

	get squares(): Square[] {
		return this._squares;
	}

	constructor() 
	{
	}

	ngOnInit() {
	}

	ngOnDestroy() {
	}

	ngOnChanges(changes: SimpleChange) {
		for (let propName in changes) {
			if(propName === 'fen')
			 
			if(propName === 'fen' && changes[propName].currentValue) {
				this.initBoard(changes[propName].currentValue);
			}
			if (propName === 'gameSettings') {
				this.initSquares();
				this.initBoard(this.gameSettings.startFen);
				this.baseBoardPath.next(imgsUrl + this.gameSettings.style.boardColor);
				this.basePiecePath.next(this.getPieceBasePath());
				let colorKey = Object.keys(BoardTextureType).find(key => BoardTextureType[key] === this.gameSettings.style.boardColor);
				if (colorKey && colors[colorKey]) {
					this.bgColor = colors[colorKey];
				}
			}
		}

	}

	initSquares() {
		let currentIndex = 0;
		let increment;
		let currentRow;
		let correspondingCharCode;
		if(this.gameSettings.options.selectedSide === GameSide.White) {
			currentRow = 8;
			increment = -1;
			correspondingCharCode = 97;
		} else {
			currentRow = 1;
			increment = 1;
			correspondingCharCode = 104;
		}

		this._squares = Array(64).fill({}).map((square, i) => {
			currentIndex = i % 8;
			square = {
				name: String.fromCharCode(correspondingCharCode - currentIndex * increment) + currentRow,
				piece: undefined
			};
			if (currentIndex === 7) {
				currentRow += increment;
			}
			return square;
		}
		);
	}

	initBoard(fen: string) {
		const parts = fen.split(' ');
		if (parts.length < 6) {
			this.error.emit(new SyntaxError("Fen is not valid!"));
			return;
		}

		const lines = parts[0].split('/');
		let baseNum;
		if(this.gameSettings.options.selectedSide === GameSide.White) {
			baseNum = 0;
		}
		else {
			baseNum = 63;
		}
		const changedLinesIndexes = this.getChangedLinesIndexes(lines);
		for (let y = 0, currentIndex = 0; y < changedLinesIndexes.length; y++) {
			currentIndex = changedLinesIndexes[y];
			this.initLine(currentIndex, lines[currentIndex], baseNum);
		}
		this.previousFen = this.fen;
	}

	initLine(lineIndex: number, fenPart: string, baseNum: number) {
		let currentSkipCount: number;
		for(let x = 0, currentFenX = 0; x < 8; x++) {
			currentSkipCount = Number(fenPart[currentFenX]);
			if (currentSkipCount) {
				currentFenX++;
				
				for (; currentSkipCount > 0; currentSkipCount--) {
					this._squares[Math.abs(baseNum - (lineIndex * 8 + x))].piece = undefined;
					x++;
				}
				x--;
				//x += currentSkipCount - 1;
			}
			else {
				let pieceKey: keyof typeof PieceType = fenPart[currentFenX] as keyof typeof PieceType;
				if (!pieceKey) {
					this.error.emit(new SyntaxError(`Fen is not valid! '${fenPart[currentFenX]}' is not a valid piece notation. `));
					return;
				}
				currentFenX++;
				this._squares[Math.abs(baseNum - (lineIndex * 8 + x))].piece = PieceType[pieceKey];
			}
		}
	}

	getChangedLinesIndexes(lines: string[]): number[] {
		if(this.previousFen) {
			const currentLines = this.previousFen.split(' ')[0].split('/');
			let changedLinesIndexes: number[] = [];
			for(let i = 0; i < currentLines.length; i++) {
				if(currentLines[i] !== lines[i])
				{
					changedLinesIndexes.push(i);
				}
			}
			return changedLinesIndexes;
		} else {
			return [0,1,2,3,4,5,6,7];
		}
	}

	selectSquare(square: Square) {
		console.log("GAMEID  " + this.gameSettings.gameId);
		debugger;
		if (!this.selectedSquare) {
			if (square.piece) {
				this.selectedSquare = square;
			}
			return;
		} else if (this.selectedSquare) {
			if (this.selectedSquare.name == square.name)
				{
					this.selectedSquare = null;
					return;
				}

			const move = Object.keys(PieceType).find(key => PieceType[key] === this.selectedSquare.piece)[0]
			+ this.selectedSquare.name + square.name;
			this.moveRequest.emit(new MoveRequest(move, this.gameSettings.gameId));

			let fenParts = this.fen.split(' ');
			let fenLines = fenParts[0].split('/');
			debugger;
			let i = Math.abs(8 - Number(this.selectedSquare.name[1]));
			fenLines[i] = '-';
			i = Math.abs(8 - Number(square.name[1]));
			fenLines[i] = '-';
			fenParts[0] = fenLines.join('/');
			this.previousFen = fenParts.join(' ');

			//square.piece = this.selectedSquare.piece;
			//this.selectedSquare.piece = undefined;
		}
		this.selectedSquare = null;
	}

	getSquareImgUrlExpression(square: Square) {
		const pieceUrl = (square.piece) ? `url(${this.getPiecePath(square.piece)}),` : '';
		const selectedMask = (this.selectedSquare && (square.name === this.selectedSquare.name)) ? `url(${this.getSquareSelectionMaskUrl()}),` : '';
		const squareUrl = `url(${this.baseBoardPath.value}/${square.name}.png)`
		return `${pieceUrl}${selectedMask}${squareUrl}`;
	}

	getPiecePath(piece: PieceType) {
		return this.basePiecePath.value + '/' + piece;
	}

	private getSquareSelectionMaskUrl(): string {
		return `${imgsUrl}/Effects/SelectedSquare/full.png`;
	}

	private getPieceBasePath(): string {
		return `${imgsUrl}${this.gameSettings.style.piecesStyle}` +
			((this.gameSettings.style.boardColor == BoardTextureType.Wood) ? '/Wood' : '/Stone')
	}
}

const imgsUrl = '../../../../assets/images/Chess';
const colors =
{
	"Wood": "#813A0D",
	"StoneBlack": "#181818",
	"StoneBlue": "#43849D",
	"StoneGrey": "#535352"
}