import { Component, OnInit, Input, SimpleChange } from '@angular/core';
import { Move } from '../../../core';

@Component({
  selector: 'app-move-tracker',
  templateUrl: './move-tracker.component.html',
  styleUrls: ['./move-tracker.component.less']
})
export class MoveTrackerComponent implements OnInit {
  @Input() moves: Move[];
  public fullMoves: FullMove[];
  constructor() { }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChange) {
    for (let propName in changes) {
      if (propName === 'moves') {
        if (!this.moves) {
          this.fullMoves = [];
          return;
        }
        debugger;
        this.fullMoves = [].concat.apply([],
          this.moves.map((move, index, moves) => {
            return index % 2 ? [] : new FullMove(moves[index], moves[index + 1])
          }));
      }
    }
  }

  getMovesCount() {
    if(this.moves) {
      return new Array(Math.round(this.moves.length / 2));
    }
  }
}

export class FullMove {
  constructor(public ply: Move, public ply2?: Move) {}
}