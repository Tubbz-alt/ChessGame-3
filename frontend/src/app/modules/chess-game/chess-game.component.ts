import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, NgZone, Renderer2, ViewChild, ElementRef, ViewEncapsulation } from "@angular/core";
import {
	ClientEvent,
	Move,
	ChessGameService,
	GameSettings,
	AppStateService,
	GameSide,
	Invocation,
	StyleOptions,
	GameOptions,
	OpponentType,
	User
} from "../../core";
import { MatDialog, MatDialogConfig, MatDialogRef, MatDivider } from "@angular/material";
import {
	NewGameDialogComponent,
	InvitationDialogComponent,
	WaitingDialogComponent,
	CheckmateDialogComponent,
	ConfirmationDialogComponent
} from "../../shared";
import { Game } from "../../core/models/chess/game";
import { Side } from "../../core/models/chess/side";
import { BehaviorSubject, fromEvent, timer } from "rxjs";
import { skipUntil, takeUntil } from "rxjs/operators";
import { NotificationsService } from "../../core/services/notifications.service";

@Component({
	selector: "app-chess-game",
	templateUrl: "./chess-game.component.html",
	styleUrls: ["./chess-game.component.less"],
	changeDetection: ChangeDetectionStrategy.Default,
	encapsulation: ViewEncapsulation.None
})
export class ChessGameComponent implements OnInit {
	@ViewChild('resizeBtn') resizeButton: ElementRef;
	@ViewChild('boardContainer') boardContainer: ElementRef;
	public opponent: User = new User("", "../../../assets/images/anonAvatar.png");
	public commitedMoves: Move[];
	public player: User;
	public isGameInitialized = false;
	public gameSettings: GameSettings = new GameSettings();
	public selectedTabIndex = 0;
	public isGameWithAi = false;
	public boardFlipped = false;
	public isOpponentTurn: boolean;
	private waitingDialog: MatDialogRef<WaitingDialogComponent>;
	private awaitedUser: BehaviorSubject<User> = new BehaviorSubject<User>(null);
	private newGameId: number;
	private sub:any;
	private boardMouseUp: any;
	private resizeBtnMouseDown: any;
	private _boardSize: number = 410;
	private readonly minBoardSize = 310;
	private readonly maxBoardSize = 500;
	private i = 0;
	private isFocusModeEnabled = false;
	public set boardSize(value: number) {
		if(value < this.minBoardSize)
		{
			this._boardSize = this.minBoardSize;
		} else if(value > this.maxBoardSize)
		{
			this._boardSize = this.maxBoardSize;
		} else {
			this._boardSize = value;
		}
	}
	public get boardSize() {
		return this._boardSize;
	}

	constructor(
		private cdRef:ChangeDetectorRef,
		private dialog: MatDialog,
		private chessGameService: ChessGameService,
		private appStateService: AppStateService,
		private notificationService: NotificationsService,
		private cd: ChangeDetectorRef,
		private renderer: Renderer2
	) {}

	ngOnInit() {
		this.subscribeSignalREvents();

		this.player = this.appStateService.getCurrentUser();
		this.awaitedUser.subscribe((value) => {
			if(!value && this.waitingDialog)
			{
				this.waitingDialog.close(true);
			}
		});

		let currentGame = this.appStateService.currentGame;
		if(currentGame && currentGame.gameId)
		{
			this.chessGameService.get(currentGame.gameId)
			.subscribe((game) => {
				if(game) {
					currentGame.startFen = game.fen;
					this.commitedMoves = game.moves;
					const currentUid = this.appStateService.getCurrentUser().uid;
					const players = game.sides.filter(s => s.player.uid !== currentUid);
					if(players && players.length > 0 && players[0].player)
					{
					this.opponent = players[0].player
					} else {
						this.opponent = AIOpponent;
					}
					this.initializeGame(currentGame);
				}
			});
		}
	}

	ngAfterViewInit() {
		this.boardMouseUp = fromEvent(this.boardContainer.nativeElement, 'mouseup');
		this.resizeBtnMouseDown = fromEvent(this.resizeButton.nativeElement, 'mousedown');
		this.boardMouseUp.subscribe(() => this.registerBoardResizing());
		this.registerBoardResizing();
		this.appStateService.getCurrentGameObs()
		.subscribe((gameSettings: GameSettings) => {
			if(gameSettings)
			{
				this.chessGameService.get(gameSettings.gameId)
				.subscribe((game) => {
					if(game){
						this.gameSettings = Object.create(gameSettings);
						if(game.moves && game.moves.length > 0)
						{
							this.commitedMoves = game.moves;
						} else {
							this.commitedMoves = [];
						}
						
					}
				});
			}
		});
	
	}

	ngAfterContentInit() {
		this.chessGameService.isMyTurnObs.subscribe(isMyTurn => {
			this.isOpponentTurn = !isMyTurn;
		  });
	}

	ngOnDestroy() {
		this.appStateService.signalRConnection.off(
			ClientEvent.InvocationReceived
		);
	}

	onMove(move: Move) {
		this.commitedMoves = this.commitedMoves.concat(move);
	}

	onCheck(checkTo: GameSide) {

	}

	onCheckmate(checkmateTo: GameSide) {
		const config: MatDialogConfig = {
			disableClose: true,
			closeOnNavigation: true,
			data: {
				isMateToMe: this.gameSettings.options.selectedSide === checkmateTo
			}
		};
		const dialogRef = this.dialog.open(CheckmateDialogComponent, config);
		dialogRef.afterClosed().subscribe((isStartNewGame: boolean) => {
			if(isStartNewGame) {
				this.openNewGameDialog();
			}
		});
	}

	onResign(resignedSide: GameSide) {
		// TEMPORALLY!!!=====================================================================================
		this.onCheckmate(resignedSide);
	}

	onDraw(p) {
		debugger;
	}

	private getRandomSide() {
		let rand = Math.random() * 100;
		let side = rand > 54 ? GameSide.Black : GameSide.White;
		return side;
	}
	
	private async createGameWithFriend(settings: GameSettings): Promise<number> {
		const config: MatDialogConfig = {
			disableClose: true,
			closeOnNavigation: true
		};
		this.awaitedUser.next(settings.options.opponent);
		const sides: Side[] = [
			new Side(settings.options.selectedSide),
			new Side(
				settings.options.selectedSide ===
					GameSide.White
					? GameSide.Black
					: GameSide.White,
				settings.options.opponent
			)
		];
		const newGame = new Game(settings.startFen, sides);
		return await this.chessGameService
			.createGameWithFriend(newGame)
			.toPromise()
			.then(async game => {
				if (game) {
					config.data = settings.options.opponent;
					this.newGameId = game.id;
					this.waitingDialog = this.dialog.open(
						WaitingDialogComponent,
						config
					);
					return await this.waitingDialog.afterClosed()
						.toPromise()
						.then(
							(isCanceled) => {
								if (isCanceled) {
									this.appStateService.signalRConnection
										.cancelInvocation(this.awaitedUser.value.uid);
									this.awaitedUser.next(null);
									return -1;
								} else {
									this.gameSettings.gameId = game.id;
									return game.id;
								}
							});
				}
			});
	}

	private async createGameVersusRandPlayer(settings: GameSettings): Promise<number>  {
		return null;
	}

	private async createGameVersusComputer(settings: GameSettings): Promise<number>  {
		const sides: Side[] = [
			new Side(settings.options.selectedSide)
		];

		const newGame = new Game(settings.startFen, sides);
		return await this.chessGameService
			.createGameVersusAI(newGame)
			.toPromise()
			.then(game => {
				if (game) {
					return game.id;
				}
			});
	}

	private initializeGame(settings: GameSettings) {
		this.gameSettings = settings;
		this.isGameInitialized = true;
		this.appStateService.currentGame = settings;
	}

	private subscribeSignalREvents() {
		
		this.appStateService.signalRConnection.onInvocationAccepted(
			(gameId) => {
				if(gameId && this.newGameId && this.newGameId === gameId)
				{
					this.newGameId = undefined;
					this.waitingDialog.close();
					this.waitingDialog = null;
					this.awaitedUser.next(null);
					// вывод инфо о начале игры
					this.chessGameService.get(gameId)
					.subscribe((game) => {
						const currentUid = this.appStateService.getCurrentUser().uid;
						this.opponent = game.sides.filter(s => s.player.uid !== currentUid)[0].player;
						this.gameSettings.startFen = game.fen;
					})
				}
			}
		);
		this.appStateService.signalRConnection.onInvocationDismissed(
			(byUserWithUid) => {
				if (
					this.awaitedUser.value &&
					byUserWithUid &&
					this.awaitedUser.value.uid === byUserWithUid
				) {
					const userName = this.awaitedUser.value.name;
					this.awaitedUser.next(null);
					this.notificationService.showInfo("Invitation rejected", `User ${userName} has declined your invitation.`);
				}
			}
		);

		this.appStateService.signalRConnection.onInvocationCanceled(
			() => {
				this.notificationService.closeLastToast();
			}
		);
	}

	getOpponentAvatarUrl() {
		return (this.opponent.avatarUrl) ? this.opponent.avatarUrl : '../../../../assets/images/anonAvatar.png' ;
	}

	public openNewGameDialog() {
		const config: MatDialogConfig = {
			disableClose: true,
			closeOnNavigation: true
		};
		const dialogRef = this.dialog.open(NewGameDialogComponent, config);
		dialogRef.componentInstance.onSettingsDefined.subscribe(
			async (settings: GameSettings) => {
				if (settings) {
					//settings.startFen = 'rnbqkbnr/p5pp/1B1P4/3ppK2/1p3p2/R2pB2R/PPP1PPPP/1N1Q2N1 w kq - 0 1';
					if (settings.options.selectedSide === GameSide.Random) {
						settings.options.selectedSide = this.getRandomSide();
					}
					
					let gameId: number;
					switch (settings.options.opponentType) {
						case (OpponentType.Player): {
							gameId = await this.createGameVersusRandPlayer(settings);
							break;
						}
						case (OpponentType.Friend): {
							gameId = await this.createGameWithFriend(settings);
							break;
						}
						default: {
							gameId = await this.createGameVersusComputer(settings);
							break;
						}
					}
					if(gameId < 0)
					{
						return;
					}
					settings.gameId = gameId;
					this.commitedMoves = [];
					this.initializeGame(settings);
				} else {
					//throw new Error("Game settings is invlid!ERROR")
				}
			}
		);
		dialogRef.afterClosed().subscribe(() => {
			dialogRef.componentInstance.onSettingsDefined.unsubscribe();
		});
	}

	async startNewGame(options: GameOptions) {
		this.selectedTabIndex = 0;
		if (options) {
			let settings = new GameSettings(new StyleOptions(), options);
			//settings.startFen = 'rnbqkbnr/p5pp/1B1P4/3ppK2/1p3p2/R2pB2R/PPP1PPPP/1N1Q2N1 w kq - 0 1';
			if (settings.options.selectedSide === GameSide.Random) {
				settings.options.selectedSide = this.getRandomSide();
			}
			
			let gameId: number;
			switch (settings.options.opponentType) {
				case (OpponentType.Player): {
					gameId = await this.createGameVersusRandPlayer(settings);
					break;
				}
				case (OpponentType.Friend): {
					gameId = await this.createGameWithFriend(settings);
					break;
				}
				default: {
					gameId = await this.createGameVersusComputer(settings);
					break;
				}
			}
			if(gameId < 0)
			{
				return;
			}
			settings.gameId = gameId;
			this.commitedMoves = [];
			this.initializeGame(settings);
		} else {
			//throw new Error("Game settings is invlid!ERROR")
		}
	}

	restyleBoard(newStyles: StyleOptions) {
		let currentGame = this.appStateService.currentGame;
		currentGame.style = newStyles;
		this.appStateService.currentGame = currentGame;
		this.gameSettings = Object.assign({}, currentGame);
	}
	
	registerBoardResizing() {
		try {
		  this.sub.unsubscribe();
		} catch (err) {
		  
		} finally {
	
		}
	
		let mousemove = fromEvent(this.boardContainer.nativeElement, 'mousemove');
		mousemove = mousemove
		.pipe(
			takeUntil(this.boardMouseUp),
			skipUntil(this.resizeBtnMouseDown)
			);
		this.sub = mousemove.subscribe((e: any) => {
		
		  let mouseX = e.clientX;
		  const buttonX = this.resizeButton.nativeElement.offsetLeft + 15;
		  let newWidth = this.boardSize + (mouseX - buttonX) * 1.5;
		  this.boardSize = newWidth;
		})
	  }

	  draw(p) {
		const confirmationDialog = this.dialog.open(ConfirmationDialogComponent, 
			{
				width: '350px',
				data: `Are you sure you want to offer a draw to ${this.appStateService.currentGame.options.opponent.name}?`
			});

			confirmationDialog.afterClosed()
			.subscribe((result) => {
				if(result) {
					this.chessGameService
					.draw(this.appStateService.currentGame.gameId)
					.subscribe((game) => {
						debugger;
					});
				}
			});
	  }

	  resign(p) {
		  const confirmationDialog = this.dialog.open(ConfirmationDialogComponent, 
			{
				width: '350px',
				data: 'Are you sure you want to resign?'
			});

			confirmationDialog.afterClosed()
			.subscribe((result) => {
				if(result) {
					this.chessGameService
					.resign(this.appStateService.currentGame.gameId)
					.subscribe((game) => {
						debugger;
					});
				}
			});
	  }

	flipBoard() {
		this.boardFlipped=!this.boardFlipped;
		// chess-board-container__wrapper has display: grid;
		this.setBoardOrientation();
	}

	toggleFocusMode() {
		if(this.isFocusModeEnabled) {
			this.renderer.removeClass(this.boardContainer.nativeElement, 'focused');
			this.renderer.setStyle(this.boardContainer.nativeElement, 'justify-content', 'flex-start');
		} else {
			this.renderer.addClass(this.boardContainer.nativeElement, 'focused');
			this.renderer.setStyle(this.boardContainer.nativeElement, 'justify-content', 'center');
		}
		this.isFocusModeEnabled = !this.isFocusModeEnabled;
		this.setBoardOrientation();
	}

	setBoardOrientation() {
		let playerCard2, playerCard1;
		// chess-board-container__wrapper has display: grid;
		if(this.isFocusModeEnabled) {
			if(this.boardFlipped) {
				playerCard1 = this.boardContainer.nativeElement.querySelector('.player-card--player');
				playerCard2 = this.boardContainer.nativeElement.querySelector('.player-card--oponent');
			} else {
				playerCard1 = this.boardContainer.nativeElement.querySelector('.player-card--oponent');
				playerCard2 = this.boardContainer.nativeElement.querySelector('.player-card--player');
			}
			this.renderer.setStyle(playerCard1, 'grid-area', 'player1');
			this.renderer.setStyle(playerCard1, 'align-self', 'start');
			this.renderer.setStyle(playerCard2, 'grid-area', 'player2');
			this.renderer.setStyle(playerCard2, 'align-self', 'end');
		} 
		// .chess-board-container__wrapper has display: flex;
		else {
			if(this.boardFlipped) {
				this.renderer.setStyle(this.boardContainer.nativeElement.querySelector('.chess-board-container__wrapper'), 'flex-direction', 'column-reverse');
			} else {
				this.renderer.setStyle(this.boardContainer.nativeElement.querySelector('.chess-board-container__wrapper'), 'flex-direction', 'column');
			}
			playerCard1 = this.boardContainer.nativeElement.querySelector('.player-card--player');
			playerCard2 = this.boardContainer.nativeElement.querySelector('.player-card--oponent');
			this.renderer.setStyle(playerCard1, 'grid-area', 'unset');
			this.renderer.setStyle(playerCard1, 'align-self', 'unset');
			this.renderer.setStyle(playerCard2, 'grid-area', 'unset');
			this.renderer.setStyle(playerCard2, 'align-self', 'unset');
		}
	}

	setPlayerCardsOrientation() {
		
		let player2, player1;
			if(this.boardFlipped) {
				player1 = this.boardContainer.nativeElement.querySelector('.player-card--player');
				player2 = this.boardContainer.nativeElement.querySelector('.player-card--oponent');
			} else {
				player1 = this.boardContainer.nativeElement.querySelector('.player-card--oponent');
				player2 = this.boardContainer.nativeElement.querySelector('.player-card--player');
			}
			this.renderer.setStyle(player1, 'grid-area', 'player1');
			this.renderer.setStyle(player1, 'align-self', 'start');
			this.renderer.setStyle(player2, 'grid-area', 'player2');
			this.renderer.setStyle(player2, 'align-self', 'end');
	}
}

const AIOpponent: User = new User( "Bob", "../../../assets/images/AIavatar.png");