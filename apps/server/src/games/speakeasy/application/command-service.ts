import {createHash} from 'node:crypto';
import {parse, safeParse} from 'valibot';
import {SpeakeasyCommandRequestSchema, SpeakeasyCommandReplySchema, ServerTimeSchema,
  type SpeakeasyCommandReply, type SpeakeasyCommandFailure, type SpeakeasyBoardView,
  type RoomId, type PlayerId} from '@hangul-rummikub/shared';
import type {RoomMutationSerialExecutor} from '../../../application/room-session-service.js';
import type {Clock} from '../../../ports/system.js';
import type {SpeakeasyCommandStore, StoredSpeakeasyGame, SpeakeasyReceipt} from '../ports/command-store.js';
import {prepareSpeakeasyPlayerCommand, type SpeakeasyCommandCatalog} from './player-command.js';
import {projectSpeakeasyBoard} from './board-projector.js';
import {advanceSpeakeasyToDecision} from './advance-game.js';

export type SpeakeasyCommandContext = Readonly<{
  roomId: RoomId; actorPlayerId: PlayerId;
  /** Issued by authenticated session/presence code; false after disconnect/replacement. */
  authorization: {isCurrent(): boolean};
}>;
export type SpeakeasyCommandServiceDependencies = Readonly<{
  store: SpeakeasyCommandStore; executor: RoomMutationSerialExecutor; clock: Clock;
  catalog: SpeakeasyCommandCatalog;
}>;
const failure = (reason: SpeakeasyCommandFailure['reason']): SpeakeasyCommandFailure => ({ok:false,reason});

// Object member order has no meaning; ordered tile placements and other arrays retain their order.
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') return `{${Object.entries(value).filter(([,v])=>v!==undefined)
    .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v]:[string,unknown])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  throw new Error('Invalid Speakeasy fingerprint input.');
}
function accessible(record: StoredSpeakeasyGame|null, actor: PlayerId): record is StoredSpeakeasyGame {
  return record !== null && record.status === 'PLAYING' && record.state.round.clock.order.includes(actor);
}
function accepted(record: StoredSpeakeasyGame, receipt: SpeakeasyReceipt, actor: PlayerId, replayed: boolean): SpeakeasyCommandReply {
  const view = projectSpeakeasyBoard(record.state,actor);
  if (!view) throw new Error('Missing Speakeasy command viewer.');
  return parse(SpeakeasyCommandReplySchema,{ok:true,requestId:receipt.requestId,gameId:record.state.round.gameId,
    acceptedRevision:receipt.revision,replayed,view});
}

/** Internal application service. Platform authentication, game registration and transport remain external. */
export class SpeakeasyCommandService {
  constructor(private readonly deps: SpeakeasyCommandServiceDependencies) {}

  async command(context: SpeakeasyCommandContext, input: unknown): Promise<SpeakeasyCommandReply> {
    const parsed = safeParse(SpeakeasyCommandRequestSchema,input);
    if (!parsed.success) return failure('INVALID_PAYLOAD');
    const request=parsed.output, d=this.deps;
    try {
      return await d.executor.run(context.roomId,async () => {
        if (!context.authorization.isCurrent()) return failure('UNAUTHENTICATED');
        const record=await d.store.read(context.roomId);
        if (!context.authorization.isCurrent()) return failure('UNAUTHENTICATED');
        if (!accessible(record,context.actorPlayerId)) return failure('INVALID_PHASE');
        if (record.state.round.gameId!==request.action.command.gameId) return failure('STALE_GAME_REVISION');
        const fingerprint=createHash('sha256').update(canonical(request.action)).digest('hex');
        const prior=record.receipts.find(r=>r.actorId===context.actorPlayerId && r.requestId===request.requestId);
        if (prior) return prior.fingerprint===fingerprint ? accepted(record,prior,context.actorPlayerId,true) : failure('REQUEST_ID_REUSED');
        if (record.state.round.phase === 'FINAL_SCORING') return failure('INVALID_PHASE');
        if (record.state.round.revision!==request.action.command.revision) return failure('STALE_GAME_REVISION');
        const prepared=prepareSpeakeasyPlayerCommand(record.state,context.actorPlayerId,request.action,d.catalog);
        if (!prepared.ok) return failure('RULE_VIOLATION');
        const advanced = advanceSpeakeasyToDecision(prepared.candidate, record.actPlans);
        if (!advanced.ok) return failure('RULE_VIOLATION');
        const committed=await d.store.commit({roomId:context.roomId,expectedVersion:record.version,actorId:context.actorPlayerId,
          requestId:request.requestId,fingerprint,candidate:advanced.value,at:parse(ServerTimeSchema,d.clock.now())},context.authorization);
        if (!context.authorization.isCurrent()) return failure('UNAUTHENTICATED');
        switch (committed.status) {
          case 'COMMITTED': case 'REPLAY': return accepted(committed.record,committed.receipt,context.actorPlayerId,committed.status==='REPLAY');
          case 'CONFLICT': return failure('REQUEST_ID_REUSED');
          case 'UNAUTHORIZED': return failure('UNAUTHENTICATED');
          case 'CLOSED': return failure('INVALID_PHASE');
          case 'STALE': return failure('STALE_GAME_REVISION');
        }
      });
    } catch {return failure('INTERNAL_ERROR');}
  }

  /** Reconnect gets a fresh private view; no past action or effect is executed. */
  async snapshot(context: SpeakeasyCommandContext): Promise<{ok:true;view:SpeakeasyBoardView}|SpeakeasyCommandFailure> {
    try {
      return await this.deps.executor.run(context.roomId,async () => {
        if (!context.authorization.isCurrent()) return failure('UNAUTHENTICATED');
        const record=await this.deps.store.read(context.roomId);
        if (!context.authorization.isCurrent()) return failure('UNAUTHENTICATED');
        if (!accessible(record,context.actorPlayerId)) return failure('INVALID_PHASE');
        const view=projectSpeakeasyBoard(record.state,context.actorPlayerId);
        if (!view) return failure('INVALID_PHASE');
        return {ok:true as const,view};
      });
    } catch {return failure('INTERNAL_ERROR');}
  }
}
