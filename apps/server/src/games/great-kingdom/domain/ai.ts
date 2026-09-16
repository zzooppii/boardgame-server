import type {GreatKingdomAction, GreatKingdomBoard, GreatKingdomColor, GreatKingdomDifficulty} from '@hangul-rummikub/shared';
import type {RandomSource} from '../../../ports/system.js';
import type {GreatKingdomState} from './game.js';
import {legalPositions, neighbors, surroundedCastles, territoryOwners} from './board.js';

type Position = {board: GreatKingdomBoard; color: GreatKingdomColor; blue: number; orange: number; passes: number; winner: GreatKingdomColor | 'DRAW' | null};
const opposite = (c: GreatKingdomColor): GreatKingdomColor => c === 'BLUE' ? 'ORANGE' : 'BLUE';
const limit = {EASY: 90, MEDIUM: 1100, HARD: 3000};
function apply(s: Position, action: GreatKingdomAction, tileId: NonNullable<GreatKingdomBoard[number]>['tileId']): Position {
  const n = {...s, board: [...s.board], color: opposite(s.color), passes: action.kind === 'PASS' ? s.passes + 1 : 0};
  if (action.kind === 'PLACE') {
    n.board[action.position] = {tileId, color: s.color};
    if (s.color === 'BLUE') n.blue--; else n.orange--;
    if (surroundedCastles(n.board, n.color).length) n.winner = s.color;
    else if (surroundedCastles(n.board, s.color).length) n.winner = n.color;
  } else if (n.passes === 2) {
    const owners = territoryOwners(n.board), difference = owners.filter(c => c === 'BLUE').length - owners.filter(c => c === 'ORANGE').length;
    n.winner = difference > 0 ? 'BLUE' : difference < 0 ? 'ORANGE' : 'DRAW';
  }
  return n;
}
function evaluate(s: Position, me: GreatKingdomColor): number {
  if (s.winner) return s.winner === 'DRAW' ? 0 : s.winner === me ? 100000 : -100000;
  const owners = territoryOwners(s.board);
  let score = owners.reduce((sum, c) => sum + (c === me ? 24 : c === opposite(me) ? -24 : 0), 0);
  const seen = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const c = s.board[i]?.color;
    if (!c || c === 'NEUTRAL' || seen.has(i)) continue;
    const group = [i], liberties = new Set<number>(); seen.add(i);
    for (let j = 0; j < group.length; j++) for (const n of neighbors(group[j]!)) {
      if (s.board[n] === null) liberties.add(n);
      else if (s.board[n]?.color === c && !seen.has(n)) {seen.add(n); group.push(n);}
    }
    const value = liberties.size === 1 ? -140 : liberties.size === 2 ? -32 : Math.min(liberties.size, 7) * 3;
    score += (c === me ? 1 : -1) * value;
  }
  return score;
}
/** Deterministic for injected randomness. Bounded nodes and cooperative yielding keep other rooms responsive.
 * Search positions contain only public board information; final moves still pass the canonical domain rules. */
export async function chooseGreatKingdomAction(state: GreatKingdomState, difficulty: GreatKingdomDifficulty, random: RandomSource, yieldWork: () => Promise<void> = async () => {}): Promise<GreatKingdomAction> {
  if (state.phase !== 'PLAYING') throw new Error('AI needs an active turn.');
  const player = state.players.find(p => p.playerId === state.activePlayerId)!;
  const me = player.color, neutralId = state.board[40]!.tileId;
  const root: Position = {board: state.board, color: me, blue: state.players[0]!.reserve.length, orange: state.players[1]!.reserve.length, passes: state.consecutivePasses, winner: null};
  let nodes = 0;
  async function children(s: Position) {
    const actions: GreatKingdomAction[] = [...legalPositions(s.board, s.color, s.color === 'BLUE' ? s.blue : s.orange).map(position => ({kind: 'PLACE' as const, position})), {kind: 'PASS'}];
    const result: {action: GreatKingdomAction; state: Position; score: number}[] = [];
    for (const action of actions) {
      if (nodes >= limit[difficulty]) break;
      const next = apply(s, action, neutralId); nodes++;
      result.push({action, state: next, score: evaluate(next, me)});
      if (nodes % 24 === 0) await yieldWork();
    }
    return result.sort((a, b) => s.color === me ? b.score - a.score : a.score - b.score);
  }
  const candidates = await children(root);
  const win = candidates.find(c => c.state.winner === me);
  if (win) return win.action;
  if (difficulty === 'EASY') {
    const safe = candidates.filter(c => c.state.winner !== opposite(me));
    const pool = safe.length ? safe : candidates;
    return pool[random.nextInt(Math.min(pool.length, random.nextInt(3) === 0 ? pool.length : 10))]!.action;
  }
  // Complete each shallow iteration before accepting it, so exhausting a budget cannot favor an unchecked move.
  let best = candidates[0]!.action;
  const beam = candidates.slice(0, difficulty === 'HARD' ? 5 : 12);
  for (let depth = 2; depth <= (difficulty === 'HARD' ? 3 : 2); depth++) {
    let score = -Infinity, chosen = best;
    async function search(s: Position, remaining: number, alpha: number, beta: number): Promise<number> {
      if (s.winner || remaining === 0 || nodes >= limit[difficulty]) return evaluate(s, me);
      const next = await children(s);
      let value = s.color === me ? -Infinity : Infinity;
      for (const child of next.slice(0, remaining > 1 ? 3 : next.length)) {
        const found = await search(child.state, remaining - 1, alpha, beta);
        if (s.color === me) {value = Math.max(value, found); alpha = Math.max(alpha, value);}
        else {value = Math.min(value, found); beta = Math.min(beta, value);}
        if (alpha >= beta) break;
      }
      return Number.isFinite(value) ? value : evaluate(s, me);
    }
    for (const c of beam) {
      const value = await search(c.state, depth - 1, -Infinity, Infinity);
      if (value > score) {score = value; chosen = c.action;}
      if (nodes >= limit[difficulty]) break;
    }
    if (nodes < limit[difficulty]) best = chosen;
    else break;
  }
  return best;
}
