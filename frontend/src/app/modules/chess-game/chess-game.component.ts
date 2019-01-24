import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from "@angular/core";
import {
	ClientEvent,
	Move,
	ChessGameService,
	GameSettings,
	SignalRService,
	AppStateService,
	Group,
	Hub,
	GameSide,
	Invocation,
	ServerAction,
	StyleOptions,
	GameOptions,
	MovesService,
	MoveRequest,
	OpponentType,
	User
} from "../../core";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material";
import {
	NewGameDialogComponent,
	InvitationDialogComponent,
	WaitingDialogComponent
} from "../../shared";
import { Game } from "../../core/models/chess/game";
import { Side } from "../../core/models/chess/side";
import { BehaviorSubject } from "rxjs";

@Component({
	selector: "app-chess-game",
	templateUrl: "./chess-game.component.html",
	styleUrls: ["./chess-game.component.less"],
	changeDetection: ChangeDetectionStrategy.Default
})
export class ChessGameComponent implements OnInit {
	private gameSettings: GameSettings = new GameSettings();
	private commitedMoves: Move[];
	private opponent: User;
	private isGameInitialized = false;
	private isOpponentTurn: boolean = false;
	private waitingDialog: MatDialogRef<WaitingDialogComponent>;
	private invitationDialog: MatDialogRef<InvitationDialogComponent>;
	private awaitedUserUid: BehaviorSubject<string> = new BehaviorSubject<string>(null);
	constructor(
		private cdRef:ChangeDetectorRef,
		private dialog: MatDialog,
		private chessGame: ChessGameService,
		private appStateService: AppStateService
	) {}

	ngOnInit() {
		this.subscribeSignalREvents();

		this.awaitedUserUid.subscribe((value) => {
			if(!value && this.waitingDialog)
			{
				this.waitingDialog.close();
			}
		});

		let currentGame = this.appStateService.currentGame;
		if(currentGame)
		{
			this.chessGame.get(currentGame.gameId)
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
		this.cdRef.detectChanges();
	}

	ngOnDestroy() {
		this.appStateService.signalRConnection.off(
			ClientEvent.InvocationReceived
		);
	}

	async onMove(move: Move) {
		this.commitedMoves = this.commitedMoves.concat(move);
	}

	private getRandomSide() {
		let rand = Math.random() * 100;
		let side = rand > 54 ? GameSide.Black : GameSide.White;
		return side;
	}

	private handleInvocation(invocation: Invocation) {
		this.invitationDialog = this.dialog.open(InvitationDialogComponent, {
			data: invocation
		});
		this.invitationDialog.afterClosed().subscribe(result => {
			if (result) {
						this.chessGame.joinGame(invocation.gameId).subscribe(game => {
							if (game) {
								const selectedSide = game.sides.find(s => s.player.uid === this.appStateService.getCurrentUser().uid);
								const gameOptions = new GameOptions(
									true,
									selectedSide.color,
									OpponentType.Player,
									game.sides.find(s => s.player.uid !== selectedSide.player.uid).player
								);
								let settings = new GameSettings(new StyleOptions(), gameOptions, game.fen);
								settings.gameId = game.id;
								const currentUid = this.appStateService.getCurrentUser().uid;
								const players = game.sides.filter(s => s.player.uid !== currentUid);
								if (players && players.length > 0 && players[0].player) {
									this.opponent = players[0].player
								}
								this.commitedMoves = [];
								this.initializeGame(settings);
							} else {
								throw new Error("User has not joined to game.ERROR")
							}
						});
			} else {
				this.appStateService.signalRConnection.send(
					ServerAction.DismissInvocation,
					`${Group.User}${invocation.inviter.uid}`
				);
			}
		});
	}

	private openNewGameDialog() {
		const config: MatDialogConfig = {
			disableClose: true,
			closeOnNavigation: true
		};
		let dialogRef = this.dialog.open(NewGameDialogComponent, config);
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

	private async createGameWithFriend(settings: GameSettings): Promise<number> {
		const config: MatDialogConfig = {
			disableClose: true,
			closeOnNavigation: true
		};
		this.awaitedUserUid.next(settings.options.opponent.uid);
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
		return await this.chessGame
			.createGameWithFriend(newGame)
			.toPromise()
			.then(async game => {
				if (game) {
					this.gameSettings.gameId = game.id;
					this.waitingDialog = this.dialog.open(
						WaitingDialogComponent,
						config
					);
					this.waitingDialog.afterClosed()
						.subscribe(
							(isCanceled) => {
								  
								if (isCanceled) {
									this.appStateService.signalRConnection
										.send(
											ServerAction.CancelInvocation,
											`${Group.User}${this.awaitedUserUid.value}`);
									this.awaitedUserUid.next(null);
								}
							});
							return game.id;
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
		return await this.chessGame
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
		this.appStateService.signalRConnection.on(
			ClientEvent.InvocationReceived,
			(invocation: Invocation) => {
				this.handleInvocation(invocation);
			}
		);
		this.appStateService.signalRConnection.on(
			ClientEvent.InvocationAccepted,
			(gameId) => {
				if(gameId && this.gameSettings && this.gameSettings.gameId === gameId)
				{
					this.awaitedUserUid.next(null);
					// вывод инфо о начале игры
					this.chessGame.get(gameId)
					.subscribe((game) => {
						const currentUid = this.appStateService.getCurrentUser().uid;
						this.opponent = game.sides.filter(s => s.player.uid !== currentUid)[0].player;
						this.gameSettings.startFen = game.fen;
					})
				}
			}
		);
		this.appStateService.signalRConnection.on(
			ClientEvent.InvocationDismissed,
			byUserWithUid => {
				  
				if (
					this.awaitedUserUid.value &&
					byUserWithUid &&
					this.awaitedUserUid.value === byUserWithUid
				) {
					this.awaitedUserUid.next(null);
					// вывод инфо об отказе
				}
			}
		);
		this.appStateService.signalRConnection.on(
			ClientEvent.InvocationCanceled,
			() => {
				if(this.invitationDialog)
				{
					this.invitationDialog.close();
				}
			}
		);
	}

	
	toggleTurn(opponentTurn: boolean) {
		this.isOpponentTurn = opponentTurn;
		this.cdRef.detectChanges();
	}

}

const AIOpponent: User = new User("", "Bob", "../../../assets/images/AIavatar.png");