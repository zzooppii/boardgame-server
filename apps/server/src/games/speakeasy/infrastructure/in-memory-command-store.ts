import type {RoomId} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow, type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {prepareSpeakeasyActPlans} from '../application/advance-game.js';
import type {SpeakeasyCommandStore, SpeakeasyStoreCommit, SpeakeasyStoreResult,
  StoredSpeakeasyGame, SpeakeasyReceipt} from '../ports/command-store.js';

/** Development storage for verified injected games; not registered in platform startup.
 * Lifetime is this process. add/close/remove are trusted lifecycle hooks, never player commands.
 */
export class InMemorySpeakeasyCommandStore implements SpeakeasyCommandStore {
  readonly #games = new Map<RoomId, StoredSpeakeasyGame>();
  #version = 0;

  add(roomId: RoomId, state: SpeakeasyGameFlow, plans: unknown): void {
    if (this.#games.has(roomId)) throw new Error('Speakeasy room already exists.');
    const actPlans = prepareSpeakeasyActPlans(state, plans);
    this.#games.set(roomId, {roomId,version:this.nextVersion(),status:'PLAYING',state:parseSpeakeasyGameFlow(state),actPlans,receipts:[]});
  }
  close(roomId: RoomId): void {
    const record = this.#games.get(roomId);
    if (!record || record.status === 'CLOSED') return;
    this.#games.set(roomId, {...record,status:'CLOSED',version:this.nextVersion()});
  }
  remove(roomId: RoomId): void {this.#games.delete(roomId);}
  async read(roomId: RoomId): Promise<StoredSpeakeasyGame|null> {
    const record = this.#games.get(roomId);
    return record ? structuredClone(record) : null;
  }
  async commit(change: SpeakeasyStoreCommit, authorization: {isCurrent(): boolean}): Promise<SpeakeasyStoreResult> {
    const record = this.#games.get(change.roomId);
    if (!authorization.isCurrent()) return {status:'UNAUTHORIZED'};
    if (!record || record.status !== 'PLAYING' || !record.state.round.clock.order.includes(change.actorId)) return {status:'CLOSED'};
    if (record.state.round.gameId !== change.candidate.round.gameId) return {status:'STALE'};
    const prior = record.receipts.find(r=>r.actorId===change.actorId && r.requestId===change.requestId);
    if (prior) {
      if (prior.fingerprint !== change.fingerprint) return {status:'CONFLICT'};
      return {status:'REPLAY',record:structuredClone(record),receipt:structuredClone(prior)};
    }
    if (record.version !== change.expectedVersion) return {status:'STALE'};
    const candidate = parseSpeakeasyGameFlow(change.candidate);
    if (candidate.round.revision <= record.state.round.revision ||
      candidate.round.clock.order.length !== record.state.round.clock.order.length ||
      candidate.round.clock.order.some(id=>!record.state.round.clock.order.includes(id))) throw new Error('Invalid Speakeasy storage transition.');
    const receipt: SpeakeasyReceipt = {actorId:change.actorId,requestId:change.requestId,fingerprint:change.fingerprint,
      revision:candidate.round.revision,createdAt:change.at};
    const next: StoredSpeakeasyGame = {...record,version:this.nextVersion(),state:candidate,receipts:[...record.receipts,receipt]};
    // No await separates this authorization check from the single atomic map replacement.
    if (!authorization.isCurrent()) return {status:'UNAUTHORIZED'};
    this.#games.set(change.roomId,next);
    return {status:'COMMITTED',record:structuredClone(next),receipt:structuredClone(receipt)};
  }
  private nextVersion(): number {
    if (!Number.isSafeInteger(this.#version)) throw new Error('Speakeasy storage version exhausted.');
    return this.#version++;
  }
}
