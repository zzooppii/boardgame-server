import { SPIRIT_BRANCH_FEAR, SPIRIT_BRANCH_FEAR_KEYS } from '@hangul-rummikub/shared';
import { currentInvaderStage } from './games/spirit-island/domain/branch-claw-stage-events.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import { SPIRIT_EVENT_KEYS, type SpiritEventKey, GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, SPIRITS, SPIRIT_POWERS, SpiritFinishedProjectionSchema, SpiritPlayingProjectionSchema, spiritProjectionIsConsistent, type SpiritAction, type SpiritId } from '@hangul-rummikub/shared';
import { createSpiritGame, applySpiritAction, parseSpiritState, powerOptions, type SpiritState } from './games/spirit-island/domain/game.js';
import { projectSpirit } from './games/spirit-island/compatibility/projector.js';
import { choiceOptions, settle, spiritFearKeys, SPIRIT_FEAR_KEYS } from './games/spirit-island/domain/resolver.js';
import { powerSteps } from './games/spirit-island/domain/powers.js';
import { step, makePiece, land, defense, presence, innateLevel, cardPower, health, countPieces } from './games/spirit-island/domain/primitives.js';
const now = v.parse(ServerTimeSchema, 1000);
let seq = 0;
function setup(n = 1) { return createSpiritGame({ gameId: v.parse(GameIdSchema, 'spirit-test'), playerIds: Array.from({ length: n }, (_, i) => v.parse(PlayerIdSchema, `p${i}`)), now, transitionId: v.parse(TurnIdSchema, `turn-${++seq}`), id: () => `card-${++seq}`, shuffle: <T>(a: T[]) => a }); }
function apply(s: SpiritState, a: SpiritAction, actor = s.players[0]!.playerId) { const result = applySpiritAction(s, actor, a, now, v.parse(TurnIdSchema, `turn-${++seq}`)); assert.ok(result.ok, `Rejected ${JSON.stringify(a)} at ${s.stage}: ${JSON.stringify(s.queue[0])}`); return result.state; }
function chosen(n = 1, spirit: SpiritId = 'RIVER') { let s = setup(n); for (const [i, p] of s.players.entries())
    s = apply(s, { kind: 'SELECT_SPIRIT', spirit: n === 1 ? spirit : SPIRITS[i]!.id }, p.playerId); return s; }
function drain(s: SpiritState) { let left = 600; while (s.queue.length && s.phase === 'PLAYING') {
    assert.ok(--left > 0, 'queue must terminate');
    const o = choiceOptions(s)[0];
    assert.ok(o, JSON.stringify(s.queue[0]));
    const e = s.queue[0]!;
    s = apply(s, { kind: 'CHOOSE', choiceId: `${s.transitionId}:${s.revision}`, optionId: o.id }, e.target ?? e.actor);
} return s; }
function view(s: SpiritState, i = 0) { return projectSpirit({ gameId: s.gameId, gameRevision: s.revision, startedAt: s.startedAt, finishedAt: s.finishedAt, state: s }, s.players[i]!.playerId); }
for (let n = 1; n <= 4; n++)
    test(`${n} spirits: setup, public projections, growth, round and conservation`, () => {
        let s = chosen(n);
        assert.equal(s.stage, 'PREPARE');
        assert.equal(s.lands.length, 8 * n);
        assert.equal(s.blightPool, 5 * n + 1);
        assert.equal(s.invaderDeck.length, 11);
        assert.equal(s.ravage, null);
        assert.ok(s.build);
        for (let i = 0; i < n; i++) {
            const g = view(s, i);
            assert.ok(spiritProjectionIsConsistent(g));
            assert.ok(v.safeParse(SpiritPlayingProjectionSchema, g).success);
            assert.equal(g.playerStates.every(p => p.hand.length === 4), true);
            assert.ok(!JSON.stringify(g).includes('minorDiscard'));
        }
        for (const p of s.players) {
            s = drain(apply(s, { kind: 'GROW', option: 1 }, p.playerId));
            s = apply(s, { kind: 'PLAY_CARDS', cardIds: [] }, p.playerId);
            s = apply(s, { kind: 'READY', ready: true }, p.playerId);
        }
        assert.equal(s.stage, 'FAST');
        for (const p of s.players)
            s = apply(s, { kind: 'READY', ready: true }, p.playerId);
        while (!['SLOW', 'PREPARE'].includes(s.stage))
            s = drain(apply(s, { kind: 'ADVANCE' }));
        for (const p of s.players)
            s = apply(s, { kind: 'READY', ready: true }, p.playerId);
        s = drain(apply(s, { kind: 'ADVANCE' }));
        assert.equal(s.round, 2);
        assert.equal(s.stage, 'PREPARE');
        parseSpiritState(s);
    });
test('invalid inputs, ownership, stale choice and insufficient energy leave canonical state unchanged', () => { let s = chosen(); const before = JSON.stringify(s); for (const action of [{ kind: 'GROW', option: 7 }, { kind: 'PLAY_CARDS', cardIds: ['unknown'] }, { kind: 'ADVANCE' }, { kind: 'SELECT_SPIRIT', spirit: 'EARTH' }, { kind: 'READY', ready: true }]) {
    assert.equal(applySpiritAction(s, s.players[0]!.playerId, action, now, s.transitionId).ok, false);
    assert.equal(JSON.stringify(s), before);
} s = apply(s, { kind: 'GROW', option: 1 }); assert.equal(applySpiritAction(s, s.players[0]!.playerId, { kind: 'CHOOSE', choiceId: 'stale', optionId: 'o0' }, now, s.transitionId).ok, false); });
test('River wetland counts as sacred and Lightning gains fast opportunities from air', () => {
    let s = chosen();
    assert.equal(presence(land(s, 'A5'), s.players[0]!.playerId), 1);
    s = drain(apply(s, { kind: 'GROW', option: 2 }));
    const p = s.players[0]!;
    s = apply(s, { kind: 'PLAY_CARDS', cardIds: p.hand.filter(id => s.cards.find(c => c.cardId === id)?.key === 'flash-floods') });
    s = apply(s, { kind: 'READY', ready: true });
    assert.ok(powerOptions(s, p.playerId).some(o => o.targets.includes('A4')));
    let lightning = chosen(1, 'LIGHTNING');
    lightning = drain(apply(lightning, { kind: 'GROW', option: 2 }));
    const lp = lightning.players[0]!, shatter = lp.hand.find(id => lightning.cards.find(c => c.cardId === id)?.key === 'shatter-homesteads')!;
    lightning = apply(lightning, { kind: 'PLAY_CARDS', cardIds: [shatter] });
    lightning = apply(lightning, { kind: 'READY', ready: true });
    assert.equal(powerOptions(lightning, lp.playerId).find(o => o.cardId === shatter)?.fast, true);
});
test('Ravage resolves blight, destroys Dahan, then surviving Dahan counterattack', () => { let s = chosen(1, 'EARTH'); const l = land(s, 'A2'); l.pieces = []; makePiece(s, l, 'TOWN'); makePiece(s, l, 'DAHAN'); makePiece(s, l, 'DAHAN'); l.defend = 0; s.stage = 'RAVAGE'; s.ravage = { stage: 1, terrains: [l.terrain], coastal: false }; s = drain(apply(s, { kind: 'ADVANCE' })); assert.equal(land(s, 'A2').blight, 1); assert.equal(land(s, 'A2').pieces.filter(p => p.kind === 'DAHAN').length, 1); assert.equal(land(s, 'A2').pieces.filter(p => p.kind === 'TOWN').length, 0); });
test('Earth sacred site provides defense 3 without consuming it', () => { const s = chosen(1, 'EARTH'); assert.equal(defense(s, land(s, 'A6')), 3); assert.equal(defense(s, land(s, 'A4')), 0); });
test('blight cascade requires adjacent target and removes one presence per spirit', () => { let s = chosen(2); const l = land(s, 'A4'); s.queue = [step('BLIGHT', s.players[0]!.playerId, l.id, 1)]; settle(s); assert.equal(s.queue[0]?.key, 'CASCADE'); assert.deepEqual(choiceOptions(s).map(o => o.landId).sort(), l.adjacent.slice().sort()); s = drain(s); assert.equal(s.blightPool, 9); });
test('damage persists through powers and is healed by time passing', () => { let s = chosen(); s.stage = 'SLOW'; const l = land(s, 'A2'); s.queue = [step('DAMAGE', s.players[0]!.playerId, l.id, 1)]; settle(s); s = drain(s); assert.equal(land(s, 'A2').pieces.find(p => p.kind === 'CITY')?.damage, 1); s = apply(s, { kind: 'READY', ready: true }); s = drain(apply(s, { kind: 'ADVANCE' })); assert.equal(land(s, 'A2').pieces.find(p => p.kind === 'CITY')?.damage, 0); });
test('individual draw choices never expose faces or IDs to teammate', () => { const s = chosen(2); s.queue = [step('GAIN', s.players[0]!.playerId, null, 1, 'MINOR')]; settle(s); assert.equal(s.offered.length, 4); const other = view(s, 1); assert.equal(other.pending?.options.length, 0); for (const id of s.offered)
    assert.ok(!JSON.stringify(other).includes(id)); assert.equal(view(s).pending?.options.length, 4); });
for (const card of SPIRIT_POWERS)
    test(`power effect ${card.key} resolves without unknown instructions`, () => { let s = chosen(2); const a = s.players[0]!.playerId, l = land(s, 'A4'); l.pieces = []; for (const kind of ['EXPLORER', 'EXPLORER', 'TOWN', 'CITY', 'DAHAN', 'DAHAN', 'DAHAN'] as const)
        makePiece(s, l, kind); s.players[0]!.elements = Array.from({ length: 6 }, () => ['SUN', 'MOON', 'FIRE', 'AIR', 'WATER', 'EARTH', 'PLANT', 'ANIMAL'] as const).flat(); s.stage = 'FAST'; s.queue = powerSteps(s, a, card.key, card.target.includes('SPIRIT') ? null : l.id, a, 1); settle(s); s = drain(s); assert.equal(s.queue.length, 0); parseSpiritState(s); });
for (const key of SPIRIT_FEAR_KEYS)
    for (const level of [1, 2, 3] as const)
        test(`fear ${key}, terror ${level}, all choices terminate`, () => { let s = chosen(2); s.terror = level; s.stage = 'FEAR'; s.queue = [step('SPECIAL', s.players[0]!.playerId, null, 0, 'FEAR_CARD', null, [key])]; settle(s); s = drain(s); assert.equal(s.queue.length, 0); });
test('innate thresholds do not consume elements', () => { const s = chosen(); s.players[0]!.elements = ['SUN', 'SUN', 'WATER', 'WATER', 'WATER']; assert.equal(innateLevel(s, s.players[0]!.playerId), 2); assert.equal(innateLevel(s, s.players[0]!.playerId), 2); });
test('victory is checked after the whole power, preserving sacrifice outcome', () => { let s = chosen(); const actor = s.players[0]!.playerId, target = land(s, 'A5'); for (const l of s.lands)
    l.pieces = l.pieces.filter(p => p.kind === 'DAHAN'); makePiece(s, target, 'TOWN'); s.stage = 'SLOW'; s.queue = [step('DAMAGE', actor, target.id, 2), step('BLIGHT', actor, target.id, 1), step('CHECK', actor)]; settle(s); s = drain(s); assert.equal(s.result?.reason, 'SACRIFICE'); assert.equal(s.phase, 'FINISHED'); });
test('negative power budgets and duplicate card selections fail atomically', () => { let s = chosen(); s = drain(apply(s, { kind: 'GROW', option: 0 })); const id = s.players[0]!.hand[0]!; const before = JSON.stringify(s); assert.equal(applySpiritAction(s, s.players[0]!.playerId, { kind: 'PLAY_CARDS', cardIds: [id, id] }, now, s.transitionId).ok, false); assert.equal(JSON.stringify(s), before); });
test('prepared cards can be changed with exact refunds before ready', () => { let s = chosen(); s = drain(apply(s, { kind: 'GROW', option: 2 })); const p = s.players[0]!, free = p.hand.find(id => s.cards.find(c => c.cardId === id)?.key === 'boon-of-vigor')!; const energy = p.energy; s = apply(s, { kind: 'PLAY_CARDS', cardIds: [free] }); s = apply(s, { kind: 'PLAY_CARDS', cardIds: [] }); assert.equal(s.players[0]!.energy, energy); assert.ok(s.players[0]!.hand.includes(free)); });
test('repeated Powerstorm never grants additional repeats', () => { let s = chosen(); const p = s.players[0]!, id = s.cards.find(c => c.key === 'powerstorm')!.cardId; s.major = s.major.filter(c => c !== id); for (const deck of s.progressions)
    deck.cards = deck.cards.filter(c => c !== id); p.played = [id]; p.resolved = [id]; p.energy = 10; p.repeatGrants = [{ id: 'grant', remaining: 1, maxCost: 10, paid: true, used: [] }]; s.stage = 'FAST'; const out = apply(s, { kind: 'USE_POWER', cardId: id, target: p.playerId, threshold: 0, fast: true, repeat: true, shadowReach: false }); assert.equal(out.players[0]!.repeatGrants.reduce((n, g) => n + g.remaining, 0), 0); assert.equal(out.players[0]!.energy, 10); });
for (const n of [1, 2, 3, 4])
    test(`${n} player complete legal game reaches a terminal result through normal commands`, () => { let s = chosen(n), commands = 0; while (s.phase === 'PLAYING' && commands++ < 1600) {
        if (s.queue.length) {
            s = drain(s);
            continue;
        }
        const unready = s.players.find(p => !p.ready) ?? s.players[0]!;
        if (s.stage === 'PREPARE') {
            if (!unready.grown) {
                s = drain(apply(s, { kind: 'GROW', option: 0 }, unready.playerId));
                continue;
            }
            s = apply(s, { kind: 'READY', ready: true }, unready.playerId);
        }
        else if (s.stage === 'FAST' || s.stage === 'SLOW')
            s = apply(s, { kind: 'READY', ready: true }, unready.playerId);
        else
            s = drain(apply(s, { kind: 'ADVANCE' }));
    } assert.equal(s.phase, 'FINISHED'); assert.ok(s.result); assert.ok(s.finishedAt !== null); assert.ok(s.round > 1); assert.ok(spiritProjectionIsConsistent(view(s))); });

for(const spirit of ['GREEN','THUNDER','OCEAN','BRINGER'] as const) test(`core spirit ${spirit} selects, grows, and projects both innate powers`,()=>{
 let s=drain(chosen(1,spirit));assert.equal(s.stage,'PREPARE');assert.ok(spiritProjectionIsConsistent(view(s)));
 for(const option of [0,1,2] as const){let candidate=drain(apply(s,{kind:'GROW',option}));assert.ok(candidate.players[0]!.grown);assert.ok(spiritProjectionIsConsistent(view(candidate)));}
 s.stage='FAST';s.players[0]!.elements=Array.from({length:6},()=>['SUN','MOON','FIRE','AIR','WATER','EARTH','PLANT','ANIMAL'] as const).flat();
 const keys=powerOptions(s,s.players[0]!.playerId).map(o=>o.cardId);s.stage='SLOW';keys.push(...powerOptions(s,s.players[0]!.playerId).map(o=>o.cardId));assert.ok(keys.includes('innate'));assert.ok(keys.includes('innate2'));
});
for(const adversary of ['NONE','PRUSSIA','ENGLAND','SWEDEN'] as const)for(const level of [0,1,2,3,4,5,6] as const){if(adversary==='NONE'&&level>0)continue;test(`core settings ${adversary} ${level} preserve setup and projections`,()=>{
 let s=setup(2);s=drain(apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:true,adversary,level,scenario:'NONE'}}));for(const [i,p]of s.players.entries())s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:i===0?'OCEAN':'GREEN'},p.playerId));assert.ok(spiritProjectionIsConsistent(view(s)));assert.equal(s.blightPool,5);assert.equal(s.players.length,2);
});}
for(const scenario of ['BLITZ','HEART','RITUAL','INSURRECTION'] as const)test(`scenario ${scenario} setup is legal with Ocean and Bringer`,()=>{let s=setup(2);s=apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:true,adversary:'NONE',level:0,scenario}});for(const [i,p]of s.players.entries())s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:i===0?'OCEAN':'BRINGER'},p.playerId));assert.ok(spiritProjectionIsConsistent(view(s)));assert.equal(s.stage,'PREPARE');if(scenario==='HEART'){assert.equal(s.hearts.length,2);assert.equal(s.players[0]!.hand.length,6);}if(scenario==='BLITZ')assert.equal(s.invaderDeck.length,10);});
function hold(s:SpiritState,key:string){const p=s.players[0]!,id=s.cards.find(c=>c.key===key)!.cardId;assert.ok(p.hand.includes(id));p.hand=p.hand.filter(c=>c!==id);p.played.push(id);p.ready=false;return id;}
function use(s:SpiritState,key:string,target:string,threshold=1){const cardId=hold(s,key);s.stage=key==='predatory-nightmares'?'SLOW':'FAST';return apply(s,{kind:'USE_POWER',cardId,target,threshold,fast:s.stage==='FAST',repeat:false,shadowReach:false});}
test('Ocean drowns a gathered explorer and gains energy without fear',()=>{let s=drain(chosen(1,'OCEAN'));for(const l of s.lands)l.pieces=l.pieces.filter(p=>p.kind!=='EXPLORER');const inv=makePiece(s,land(s,'A1'),'EXPLORER');const before=s.players[0]!.energy;s=drain(use(s,'call-of-the-deeps','A0'));assert.ok(s.lands.every(l=>!l.pieces.some(p=>p.id===inv.id)));assert.equal(s.players[0]!.energy,before+1);assert.equal(s.fear,0);});
test('Bringer power replaces lethal damage with fear and push, preserving real damage',()=>{let s=drain(chosen(1,'BRINGER'));const target=s.lands.find(l=>presence(l,s.players[0]!.playerId)>0)!;target.pieces=[];const town=makePiece(s,target,'TOWN');s=use(s,'predatory-nightmares',target.id);for(let i=0;i<2;i++){const e=s.queue[0]!,o=choiceOptions(s).find(o=>o.pieceId===town.id)!;assert.ok(o);s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},e.target??e.actor);}s=drain(s);const after=s.lands.flatMap(l=>l.pieces).find(p=>p.id===town.id);assert.ok(after);assert.equal(after.damage,0);assert.equal(s.fear,2);assert.ok(!land(s,target.id).pieces.some(p=>p.id===town.id));});
test('Green can sacrifice sacred-site presence to prevent only the current build',()=>{let s=drain(chosen(1,'GREEN'));const p=s.players[0]!,l=s.lands.find(l=>presence(l,p.playerId))!;p.energyTrack++;l.presence[0]!.count++;s.build={stage:1,terrains:[l.terrain],coastal:false};makePiece(s,l,'EXPLORER');s.stage='BUILD';s=apply(s,{kind:'ADVANCE'});assert.equal(s.queue[0]?.key,'GREEN_STOP');const e=s.queue[0]!,o=choiceOptions(s).find(o=>o.label.includes('막기'))!;s=drain(apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},e.target??e.actor));assert.equal(presence(land(s,l.id),p.playerId),1);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='TOWN'||p.kind==='CITY').length,0);assert.equal(s.players[0]!.destroyedPresence,1);});
test('Blight card stays hidden until healthy pool empties, then refills once',()=>{let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:true,adversary:'NONE',level:0,scenario:'NONE'}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'}));assert.equal(view(s).blightCard,null);for(const id of ['A1','A2','A3']){s.queue=[step('BLIGHT',s.players[0]!.playerId,id,1)];settle(s);}assert.equal(s.blighted,true);assert.equal(s.blightPool,5);assert.equal(view(s).blightCard,'SPIRAL');assert.equal(s.blightPool+s.lands.reduce((n,l)=>n+l.blight,0),s.blightTotal);});
test('Configuration rejects non-leading actor and changes after spirit selection',()=>{const s=setup(2),settings={progression:false,blightCard:true,adversary:'NONE',level:0,scenario:'NONE'} as const;assert.equal(applySpiritAction(s,s.players[1]!.playerId,{kind:'CONFIGURE',settings},now,s.transitionId).ok,false);const selected=apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'});assert.equal(applySpiritAction(selected,selected.players[0]!.playerId,{kind:'CONFIGURE',settings},now,s.transitionId).ok,false);});
test('Sweden level 3 uses stronger ravage damage and extra blight without a cascade',()=>{let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:false,adversary:'SWEDEN',level:3,scenario:'NONE'}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'}));const l=land(s,'A1');l.pieces=[];makePiece(s,l,'CITY');makePiece(s,l,'EXPLORER');s.ravage={stage:1,terrains:[l.terrain],coastal:false};s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').blight,2);});
test('England capital loss is reported as adversary condition',()=>{let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:false,adversary:'ENGLAND',level:0,scenario:'NONE'}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'}));for(let i=0;i<7;i++)makePiece(s,land(s,'A1'),'TOWN');s.queue=[step('CHECK',s.players[0]!.playerId)];settle(s);assert.equal(s.result?.reason,'ADVERSARY');});
test('Ritual needs all spirits and resolves contributions as their respective actors',()=>{let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:false,adversary:'NONE',level:0,scenario:'RITUAL'}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'EARTH'}));const p=s.players[0]!,l=s.lands.find(l=>presence(l,p.playerId)===2)!;p.energyTrack++;l.presence[0]!.count++;p.energy=3;while(l.pieces.filter(p=>p.kind==='DAHAN').length<3)makePiece(s,l,'DAHAN');s.stage='FAST';s=drain(apply(s,{kind:'RITUAL',landId:l.id}));assert.equal(s.terror,2);assert.equal(s.players[0]!.energy,0);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='DAHAN').length,0);});
for(const adversary of ['PRUSSIA','ENGLAND','SWEDEN'] as const)for(const level of [0,3,6] as const)for(const scenario of ['NONE','BLITZ','HEART','RITUAL','INSURRECTION'] as const)test(`advanced four-player game terminates: ${adversary}/${level}/${scenario}`,()=>{
 let s=setup(4);s=drain(apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:true,adversary,level,scenario}}));for(const [i,p]of s.players.entries())s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:(['OCEAN','BRINGER','GREEN','THUNDER'] as const)[i]!},p.playerId));let budget=250;
 while(s.phase==='PLAYING'&&budget-->0){s=drain(s);if(s.phase==='FINISHED')break;if(s.stage==='PREPARE'){for(const p of [...s.players]){if(s.phase==='FINISHED')break;if(!s.players.find(q=>q.playerId===p.playerId)!.grown)s=drain(apply(s,{kind:'GROW',option:2},p.playerId));}if(s.phase==='FINISHED')break;for(const p of [...s.players])s=drain(apply(s,{kind:'READY',ready:true},p.playerId));}else if(s.stage==='FAST'||s.stage==='SLOW'){for(const p of [...s.players]){s=drain(apply(s,{kind:'READY',ready:true},p.playerId));if(s.phase==='FINISHED')break;}}else s=drain(apply(s,{kind:'ADVANCE'}));if(s.phase==='PLAYING')assert.ok(spiritProjectionIsConsistent(view(s)));}
 assert.equal(s.phase,'FINISHED');assert.ok(s.result);assert.ok(budget>0);
});

test('Scenario setup does not repeat during normal exploration',()=>{
 for(const scenario of ['BLITZ','HEART'] as const){let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{progression:false,blightCard:false,adversary:'NONE',level:0,scenario}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'}));const deck=s.invaderDeck.length,hearts=[...s.hearts],hand=s.players[0]!.hand.length;s.stage='EXPLORE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(s.invaderDeck.length,deck-1);assert.deepEqual(s.hearts,hearts);assert.equal(s.players[0]!.hand.length,hand);assert.equal(s.stage,'SLOW');}
});
test('Insurrection resolves movement raids even without a power CHECK',()=>{const s=chosen(),l=land(s,'A1');s.settings.scenario='INSURRECTION';l.pieces=[];const d=makePiece(s,l,'DAHAN');makePiece(s,l,'EXPLORER');s.flags.push(`raid:${d.id}`);s.queue=[];settle(s);assert.equal(s.queue[0]?.kind,'DAMAGE');assert.ok(!s.flags.includes(`raid:${d.id}`));});

test('Blitz zero-cost fast cards fund preparation and undo refunds exactly',()=>{let s=chosen();s.settings.scenario='BLITZ';const p=s.players[0]!;p.grown=true;p.energy=0;const id=p.hand.find(id=>cardPower(s,id).key==='boon-of-vigor')!;s=apply(s,{kind:'PLAY_CARDS',cardIds:[id]});assert.equal(s.players[0]!.energy,1);s=apply(s,{kind:'PLAY_CARDS',cardIds:[]});assert.equal(s.players[0]!.energy,0);});
test('Blitz lightning conversion rebates a slow power once',()=>{let s=chosen(1,'LIGHTNING');s.settings.scenario='BLITZ';const p=s.players[0]!,id=hold(s,'shatter-homesteads');p.elements=['AIR'];s.stage='FAST';const before=p.energy,target=powerOptions(s,p.playerId).find(o=>o.cardId===id)!.targets[0]!;s=drain(apply(s,{kind:'USE_POWER',cardId:id,target,threshold:0,fast:true,repeat:false,shadowReach:false}));assert.equal(s.players[0]!.energy,before+1);assert.equal(s.players[0]!.fastUsed,1);});

function branchClaw(spirit: 'FANGS'|'KEEPER' = 'FANGS') {
    let s=setup();
    s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true}});
    return drain(apply(s,{kind:'SELECT_SPIRIT',spirit}));
}
test('Branch & Claw selection requires expansion and normal card acquisition',()=>{
    const s=setup(),actor=s.players[0]!.playerId,before=JSON.stringify(s);
    for(const spirit of ['FANGS','KEEPER']) assert.equal(applySpiritAction(s,actor,{kind:'SELECT_SPIRIT',spirit},now,s.transitionId).ok,false);
    assert.equal(applySpiritAction(s,actor,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:true}},now,s.transitionId).ok,false);
    assert.equal(JSON.stringify(s),before);
    for(const spirit of ['FANGS','KEEPER'] as const){const game=branchClaw(spirit);assert.equal(game.players[0]!.hand.length,4);assert.ok(spiritProjectionIsConsistent(view(game)));parseSpiritState(game);}
});
test('Branch & Claw setup places disease and beasts before initial exploration',()=>{
    let s=setup();const empty=s.lands.find(l=>!l.pieces.length&&!l.blight)!;
    s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true}});
    assert.equal(land(s,empty.id).tokens.beasts,1);assert.equal(land(s,'A2').tokens.disease,1);
    assert.equal(s.lands.reduce((n,l)=>n+l.tokens.beasts,0),1);
});
test('Fangs chooses two distinct growths and receives income only after both',()=>{
    let s=branchClaw(),actor=s.players[0]!.playerId;
    s=drain(apply(s,{kind:'GROW',option:3}));assert.equal(s.players[0]!.energy,3);assert.equal(s.players[0]!.grown,false);
    const before=JSON.stringify(s);
    assert.equal(applySpiritAction(s,actor,{kind:'GROW',option:3},now,s.transitionId).ok,false);
    assert.equal(applySpiritAction(s,actor,{kind:'PLAY_CARDS',cardIds:[]},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
    s=apply(s,{kind:'GROW',option:1});
    const effect=choiceOptions(s).find(o=>o.label.includes('현신'))!;assert.ok(effect);
    s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:effect.id});
    const options=choiceOptions(s);assert.ok(options.some(o=>o.landId&&land(s,o.landId).terrain==='JUNGLE'));
    for(const o of options.filter(o=>o.landId)){const l=land(s,o.landId!);assert.ok(l.terrain==='JUNGLE'||l.tokens.beasts>0);}
    s=drain(s);assert.equal(s.players[0]!.grown,true);assert.equal(s.players[0]!.energy,4);parseSpiritState(s);
});
test('Fangs conversion permanently removes presence and is limited to once per round',()=>{
    let s=branchClaw(),actor=s.players[0]!.playerId,l=s.lands.find(l=>presence(l,actor)>0)!;
    const beasts=l.tokens.beasts,oldPresence=presence(l,actor);
    s=apply(s,{kind:'CALL_PREDATORS',landId:l.id});assert.equal(land(s,l.id).tokens.beasts,beasts+1);assert.equal(presence(land(s,l.id),actor),oldPresence-1);
    assert.equal(s.players[0]!.removedPresence,1);assert.equal(s.players[0]!.destroyedPresence,0);assert.equal(view(s).playerStates[0]!.canCallPredators,false);
    const another=s.lands.find(l=>presence(l,actor)>0)!;assert.equal(applySpiritAction(s,actor,{kind:'CALL_PREDATORS',landId:another.id},now,s.transitionId).ok,false);parseSpiritState(s);
});
test('Fangs presence can follow a moved beast without changing track counts',()=>{
    let s=branchClaw();const actor=s.players[0]!.playerId,from=s.lands.find(l=>presence(l,actor)>0&&l.tokens.beasts>0)!,to=land(s,from.adjacent[0]!);
    const count=presence(from,actor);s.queue=[step('SPECIAL',actor,from.id,1,'TOKEN:PUSH:beasts',actor)];settle(s);
    const move=choiceOptions(s).find(o=>o.landId===to.id)!;s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:move.id});
    assert.equal(s.queue[0]?.key,'FOLLOW_DAHAN');const follow=choiceOptions(s).find(o=>o.landId===to.id)!;s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:follow.id});
    assert.equal(presence(land(s,from.id),actor),count-1);assert.ok(presence(land(s,to.id),actor)>0);parseSpiritState(s);
});
test('Keeper growth costs are paid before benefits and new sacred sites push all Dahan',()=>{
    let s=branchClaw('KEEPER');const actor=s.players[0]!.playerId;
    assert.equal(applySpiritAction(s,actor,{kind:'GROW',option:3},now,s.transitionId).ok,false);
    s=drain(apply(s,{kind:'GROW',option:0}));assert.equal(s.players[0]!.energy,1);
    const home=s.lands.find(l=>presence(l,actor)>0)!;makePiece(s,home,'DAHAN');makePiece(s,home,'DAHAN');
    s=apply(s,{kind:'GROW',option:2});
    while(s.queue[0]?.key==='GROWTH'){const o=choiceOptions(s).find(o=>o.label.includes('현신'))??choiceOptions(s)[0]!;s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id});}
    const o=choiceOptions(s).find(o=>o.landId===home.id)!;assert.ok(o);s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id});
    assert.equal(s.queue[0]?.kind,'MOVE');s=drain(s);assert.equal(land(s,home.id).pieces.filter(p=>p.kind==='DAHAN').length,0);assert.equal(presence(land(s,home.id),actor),2);assert.equal(s.players[0]!.grown,true);parseSpiritState(s);
});
test('Wilds blocks an Explore action, but does not block ordinary Explorer addition',()=>{
    let s=chosen();const actor=s.players[0]!.playerId,l=land(s,'A1');l.tokens.wilds=2;
    const original=l.pieces.filter(p=>p.kind==='EXPLORER').length;s.invaderDeck.unshift({stage:1,terrains:[l.terrain],coastal:false});s.queue=[step('SPECIAL',actor,null,0,'EXPLORE')];settle(s);s=drain(s);
    assert.equal(land(s,l.id).tokens.wilds,1);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='EXPLORER').length,original);
    makePiece(s,land(s,l.id),'EXPLORER');assert.equal(land(s,l.id).tokens.wilds,1);
});
test('Disease blocks only an eligible Build and is preserved when the action is skipped',()=>{
    let s=chosen();const actor=s.players[0]!.playerId,l=land(s,'A2');l.tokens.disease=2;s.build={stage:1,terrains:[l.terrain],coastal:false};const n=l.pieces.length;
    s.queue=[step('SPECIAL',actor,null,0,'BUILD')];settle(s);s=drain(s);assert.equal(land(s,l.id).tokens.disease,1);assert.equal(land(s,l.id).pieces.length,n);
    land(s,l.id).skip=true;s.queue=[step('SPECIAL',actor,null,0,'BUILD')];settle(s);assert.equal(land(s,l.id).tokens.disease,1);
});
test('Strife prevents land and Dahan damage, consumes one token and still permits counterattack',()=>{
    let s=chosen();const actor=s.players[0]!.playerId,l=land(s,'A1');l.pieces=[];const town=makePiece(s,l,'TOWN');town.strife=2;makePiece(s,l,'DAHAN');const blight=l.blight;
    s.queue=[step('SPECIAL',actor,l.id,0,'RAVAGE')];settle(s);assert.equal(land(s,l.id).pieces.find(p=>p.id===town.id)?.strife,1);s=drain(s);
    assert.equal(land(s,l.id).blight,blight);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='TOWN').length,0);
});
test('Strife stays on moved and replaced Invaders, and is removed with Dahan replacement',()=>{
    let s=chosen();const actor=s.players[0]!.playerId,l=land(s,'A1');l.pieces=[];makePiece(s,l,'CITY').strife=2;
    s.queue=[step('REPLACE',actor,l.id,1,'DOWNGRADE',null,['CITY'])];settle(s);s=drain(s);assert.equal(land(s,l.id).pieces[0]!.kind,'TOWN');assert.equal(land(s,l.id).pieces[0]!.strife,2);
    s.queue=[step('MOVE',actor,l.id,1,'PUSH',null,['TOWN','REQUIRED'])];settle(s);const o=choiceOptions(s)[0]!,dest=o.landId!;s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id});assert.equal(land(s,dest).pieces.find(p=>p.strife===2)?.kind,'TOWN');
    s.queue=[step('REPLACE',actor,dest,1,'DAHAN',null,['TOWN'])];settle(s);s=drain(s);assert.ok(land(s,dest).pieces.filter(p=>p.kind==='DAHAN').every(p=>p.strife===0));
});
test('Sacrosanct Wilds branch leaves Dahan in place',()=>{
    let s=branchClaw('KEEPER');const actor=s.players[0]!.playerId,l=land(s,'A1');makePiece(s,l,'DAHAN');const n=l.pieces.filter(p=>p.kind==='DAHAN').length;
    s.queue=powerSteps(s,actor,'sacrosanct-wilderness',l.id,actor,1);settle(s);const o=choiceOptions(s).find(o=>o.label==='야생 1개 추가')!;s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id});assert.equal(land(s,l.id).tokens.wilds,1);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='DAHAN').length,n);
});
test('Green may skip a Build before disease is consumed',()=>{
 let s=chosen(1,'GREEN');const actor=s.players[0]!.playerId;
 const homes=s.lands.filter(l=>presence(l,actor)>0),l=homes[0]!,other=homes[1]!;l.presence.find(p=>p.playerId===actor)!.count++;other.presence=other.presence.filter(p=>p.playerId!==actor);parseSpiritState(s);makePiece(s,l,'TOWN');l.tokens.disease=1;s.build={stage:1,terrains:[l.terrain],coastal:false};
 s.queue=[step('SPECIAL',actor,null,0,'BUILD')];settle(s);const stop=choiceOptions(s).find(o=>o.landId===l.id&&o.label.includes('막기'))!;assert.ok(stop);s=apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:stop.id});assert.equal(land(s,l.id).tokens.disease,1);
});

function grantPower(s:SpiritState,key:string,index=0) {
 const id=s.cards.find(c=>c.key===key)!.cardId;
 for(const zone of ['minor','major','minorDiscard','majorDiscard','forgotten','offered'] as const)s[zone]=s[zone].filter(c=>c!==id);
 for(const p of s.players)for(const zone of ['hand','played','discard'] as const)p[zone]=p[zone].filter(c=>c!==id);
 for(const p of s.progressions)p.cards=p.cards.filter(c=>c!==id);
 s.players[index]!.hand.push(id);return id;
}
function chooseText(s:SpiritState,label:string) {
 const o=choiceOptions(s).find(o=>o.label===label);assert.ok(o,`Missing ${label}: ${choiceOptions(s).map(o=>o.label).join(', ')}`);
 return apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},s.queue[0]!.target??s.queue[0]!.actor);
}
function minorEffect(s:SpiritState,key:string,id='A2',target=s.players[0]!.playerId,level=1) {
 s.queue=powerSteps(s,s.players[0]!.playerId,key,id,target,level);settle(s);return s;
}
test('Branch & Claw mixes exactly 31 minor powers only into the expansion deck',()=>{
 assert.equal(SPIRIT_POWERS.filter(c=>c.expansion&&c.deck==='MINOR').length,31);
 const core=chosen(),bc=branchClaw();
 assert.equal(core.minor.some(id=>cardPower(core,id).expansion),false);
 assert.equal(bc.minor.filter(id=>cardPower(bc,id).expansion).length,31);
 assert.equal(bc.minor.length,67);assert.equal(bc.major.length,43);parseSpiritState(bc);
});
for(const card of SPIRIT_POWERS.filter(c=>c.expansion&&c.deck==='MINOR'))
 test(`Branch minor ${card.key}: all initial choices terminate at both threshold settings`,()=>{
  for(const level of [0,1]){
   let s=chosen(2);const p=s.players[0]!,l=land(s,'A2');p.energy=10;l.tokens={beasts:2,disease:2,wilds:2};makePiece(s,l,'TOWN');makePiece(s,l,'EXPLORER');makePiece(s,l,'DAHAN');
   p.elements=Array.from({length:4},()=>['SUN','MOON','FIRE','AIR','WATER','EARTH','PLANT','ANIMAL'] as const).flat();
   s=minorEffect(s,card.key,card.target==='SPIRIT'?'A5':l.id,s.players[1]!.playerId,level);
   const options=choiceOptions(s);
   if(!s.queue.length){assert.equal(s.phase,'PLAYING');continue;}
   for(const option of options){let candidate=structuredClone(s);candidate=apply(candidate,{kind:'CHOOSE',choiceId:`${candidate.transitionId}:${candidate.revision}`,optionId:option.id},candidate.queue[0]!.target??candidate.queue[0]!.actor);candidate=drain(candidate);assert.equal(candidate.queue.length,0);parseSpiritState(candidate);}
  }
 });
test('Absorb Corruption moves blight without cascades or presence destruction, then pays to remove it',()=>{
 let s=chosen();const actor=s.players[0]!.playerId,l=land(s,'A5'),from=land(s,l.adjacent.find(id=>land(s,id).blight>0)!);assert.ok(from);l.blight++;s.blightTotal++;s.players[0]!.energy=2;s.players[0]!.elements=['PLANT','PLANT'];const present=presence(l,actor),total=s.blightTotal,pool=s.blightPool;
 s=minorEffect(s,'absorb-corruption',l.id);s=chooseText(s,'오염 모은 뒤 에너지 1로 제거');s=chooseText(s,`${from.id} → ${l.id} 오염 1개 이동`);s=drain(s);
 assert.equal(land(s,l.id).blight,1);assert.equal(land(s,from.id).blight,0);assert.equal(presence(land(s,l.id),actor),present);assert.equal(s.blightTotal,total);assert.equal(s.blightPool,pool+1);assert.equal(s.players[0]!.energy,1);
});
test('Portents triggers once on actual destruction, not removal, and repeated copies stack',()=>{
 let s=chosen();const l=land(s,'A1'),actor=s.players[0]!.playerId;l.pieces=[];makePiece(s,l,'EXPLORER');makePiece(s,l,'EXPLORER');
 s=minorEffect(s,'portents-of-disaster',l.id);s=minorEffect(s,'portents-of-disaster',l.id);const before=s.effectCounter;
 s.queue=[step('REMOVE',actor,l.id,1,'',null,['EXPLORER'])];settle(s);s=drain(s);assert.equal(s.flags.filter(f=>f.startsWith('portents:')).length,2);
 s.queue=[step('DESTROY',actor,l.id,1,'',null,['EXPLORER'])];settle(s);s=drain(s);assert.equal(s.flags.some(f=>f.startsWith('portents:')),false);assert.ok(s.effectCounter>before);assert.equal(s.fear,2);
});
test('Confounding Mists triggers on arrivals but not movement or replacement',()=>{
 let s=chosen(),actor=s.players[0]!.playerId,l=land(s,'A1');s=minorEffect(s,'confounding-mists',l.id);s=chooseText(s,'추가되는 침략자 밀어내기');
 const piece=makePiece(s,land(s,l.id),'CITY');settle(s);assert.equal(s.queue[0]?.kind,'MOVE');assert.ok(choiceOptions(s).some(o=>o.pieceId===piece.id));s=chooseText(s,'이 선택 마치기');
 s.queue=[step('REPLACE',actor,l.id,1,'DOWNGRADE',null,['CITY'])];settle(s);s=drain(s);assert.equal(land(s,l.id).pieces.find(p=>p.kind==='TOWN')?.kind,'TOWN');assert.equal(s.queue.length,0);
 const other=land(s,l.adjacent[0]!);makePiece(s,other,'EXPLORER');s.queue=[step('MOVE',actor,l.id,1,'GATHER',null,['EXPLORER','REQUIRED'])];settle(s);s=drain(s);assert.equal(s.queue.length,0);
});
test('Call to Trade replaces only the first Ravage with a Build, consuming disease not strife',()=>{
 let s=chosen(),actor=s.players[0]!.playerId,l=land(s,'A2');l.pieces=[];makePiece(s,l,'CITY').strife=1;makePiece(s,l,'DAHAN');l.tokens.disease=1;
 s=drain(minorEffect(s,'call-to-trade',l.id));const before=land(s,l.id).blight;
 s.queue=[step('SPECIAL',actor,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,l.id).tokens.disease,0);assert.equal(land(s,l.id).pieces.find(p=>p.kind==='CITY')!.strife,1);assert.equal(land(s,l.id).blight,before);
 s.queue=[step('SPECIAL',actor,l.id,0,'RAVAGE')];settle(s);assert.equal(land(s,l.id).pieces.find(p=>p.kind==='CITY')?.strife,0);s=drain(s);assert.equal(land(s,l.id).pieces.some(p=>p.kind==='CITY'),false);assert.equal(s.flags.some(f=>f.startsWith('trade-build:')),false);
});
test('Spur pays the recipient card cost, adds elements and reopens their ready state',()=>{
 let s=chosen(2);const target=s.players[1]!.playerId;s.stage='FAST';s.players[1]!.energy=1;s.players[1]!.ready=true;const id=s.players[1]!.hand.find(id=>cardPower(s,id).cost===2)!;const power=cardPower(s,id);
 s=minorEffect(s,'spur-on-with-words-of-fire','A1',target);s=chooseText(s,`${power.title} · 에너지 2`);
 assert.equal(s.players[1]!.energy,0);assert.ok(s.players[1]!.played.includes(id));assert.equal(s.players[1]!.ready,false);assert.ok(!s.players[1]!.hand.includes(id));assert.ok(view(s,1).playerStates[1]!.elements.length>0);parseSpiritState(s);
});
test('Sky permits one fast power in Slow phase and does not consume a normal fast gift',()=>{
 let s=chosen();const actor=s.players[0]!.playerId,id=hold(s,'flash-floods');s.players[0]!.fastGift=1;s=minorEffect(s,'sky-stretches-to-shore','A5');s.stage='SLOW';const o=powerOptions(s,actor).find(o=>o.cardId===id)!;assert.ok(o?.slow);
 s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:o.targets[0]!,threshold:0,fast:false,repeat:false,shadowReach:false}));assert.equal(s.flags.includes(`sky:${actor}`),false);assert.equal(s.players[0]!.fastUsed,0);assert.ok(s.flags.includes(`shore:${actor}`));
});
test('Scour uses its own speed threshold without consuming gifted speed',()=>{
 let s=chosen();const actor=s.players[0]!.playerId;grantPower(s,'scour-the-land');const id=hold(s,'scour-the-land');s.stage='FAST';s.players[0]!.elements=['AIR','AIR'];s.players[0]!.fastGift=1;
 const o=powerOptions(s,actor).find(o=>o.cardId===id)!;assert.ok(o?.fast);s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:o.targets[0]!,threshold:1,fast:true,repeat:false,shadowReach:false}));assert.equal(s.players[0]!.fastUsed,0);
});
test('Inflame threshold can add disease and strife together',()=>{
 let s=chosen();s.players[0]!.elements=['ANIMAL','ANIMAL','ANIMAL'];const l=land(s,'A2');s=minorEffect(s,'inflame-the-fires-of-life',l.id);s=chooseText(s,'두 효과 모두 적용');s=drain(s);assert.equal(land(s,l.id).tokens.disease,1);assert.equal(land(s,l.id).pieces.reduce((n,p)=>n+p.strife,0),1);assert.equal(s.fear,1);
});
test('Sky and Scour speed conversions each rebate once in Blitz',()=>{
 for(const key of ['wash-away','scour-the-land']){
  let s=chosen();s.settings.scenario='BLITZ';const actor=s.players[0]!.playerId;grantPower(s,key);const id=hold(s,key);s.stage='FAST';s.players[0]!.elements=key==='scour-the-land'?['AIR','AIR']:[];
  if(key==='wash-away')s=minorEffect(s,'sky-stretches-to-shore','A5');const before=s.players[0]!.energy,o=powerOptions(s,actor).find(o=>o.cardId===id)!;
  s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:o.targets[0]!,threshold:1,fast:true,repeat:false,shadowReach:false}));assert.equal(s.players[0]!.energy,before+1);assert.ok(s.flags.includes(`blitz-fast:${id}`));assert.equal(s.flags.includes(`sky:${actor}`),false);
 }
});
test('Trade conversion respects fear build prevention and keeps unused disease',()=>{
 let s=chosen();const actor=s.players[0]!.playerId,l=land(s,'A2');l.tokens.disease=1;s.flags.push('no-build-dahan',`trade-build:${l.id}`);const pieces=l.pieces.length;
 s.queue=[step('SPECIAL',actor,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,l.id).pieces.length,pieces);assert.equal(land(s,l.id).tokens.disease,1);assert.equal(s.flags.includes(`trade-build:${l.id}`),false);
});
test('Sky speed change persists for repeated powers without consuming another grant',()=>{
 let s=chosen();const actor=s.players[0]!.playerId,id=hold(s,'flash-floods');s=minorEffect(s,'sky-stretches-to-shore','A5');s.stage='SLOW';let option=powerOptions(s,actor).find(o=>o.cardId===id)!;
 s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:option.targets[0]!,threshold:0,fast:false,repeat:false,shadowReach:false}));
 s.players[0]!.repeatGrants.push({id:'repeat-sky',remaining:1,maxCost:3,paid:false,used:[]});option=powerOptions(s,actor).find(o=>o.cardId===id)!;assert.ok(option?.slow&&option.repeat);
 s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:option.targets[0]!,threshold:0,fast:false,repeat:true,shadowReach:false}));assert.equal(s.players[0]!.repeatGrants[0]!.remaining,0);assert.equal(s.flags.includes(`sky:${actor}`),false);
});
test('Sky may delay a power into Slow even in Blitz',()=>{
 let s=chosen();s.settings.scenario='BLITZ';const actor=s.players[0]!.playerId,id=hold(s,'flash-floods');s=minorEffect(s,'sky-stretches-to-shore','A5');s.stage='SLOW';const option=powerOptions(s,actor).find(o=>o.cardId===id)!;assert.ok(option?.slow);
 s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:option.targets[0]!,threshold:0,fast:false,repeat:false,shadowReach:false}));assert.equal(s.flags.includes(`sky:${actor}`),false);
});
test('Mists resolves an added building movement before the next Build action',()=>{
 let s=chosen(),actor=s.players[0]!.playerId,l=land(s,'A1');l.pieces=[];makePiece(s,l,'EXPLORER');s.flags.push(`bc-mists:${l.id}:${actor}`);s.build={stage:1,terrains:[l.terrain],coastal:false};
 const later=s.lands.find(a=>a.id!==l.id&&a.terrain===l.terrain)!;later.pieces=[];makePiece(s,later,'EXPLORER');s.queue=[step('SPECIAL',actor,null,0,'BUILD')];settle(s);
 assert.equal(s.queue[0]?.kind,'MOVE');assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='TOWN').length,1);assert.equal(land(s,later.id).pieces.filter(p=>p.kind==='TOWN').length,0);
 s=chooseText(s,'이 선택 마치기');s=drain(s);assert.equal(land(s,later.id).pieces.filter(p=>p.kind==='TOWN').length,1);
});

const majorCards=SPIRIT_POWERS.filter(c=>c.expansion&&c.deck==='MAJOR');
test('Branch major deck has 21 unique powers and core excludes every expansion card',()=>{
 assert.equal(majorCards.length,21);const core=chosen(),bc=branchClaw();assert.equal(core.major.some(id=>cardPower(core,id).expansion),false);assert.equal(bc.major.filter(id=>cardPower(bc,id).expansion).length,21);assert.equal(bc.major.length,43);
 for(const key of ['strangling-firevine','pyroclastic-flow','volcanic-eruption','tigers-hunting'])assert.ok(majorCards.find(c=>c.key===key)?.sourceTerrain);
});
for(const c of majorCards)for(const level of [0,1])test(`Branch major ${c.key}: threshold ${level} resolves and preserves state`,()=>{
 let s=chosen(2),p=s.players[0]!;p.energy=20;p.elements=Array.from({length:4},()=>['SUN','MOON','FIRE','AIR','WATER','EARTH','PLANT','ANIMAL'] as const).flat();
 for(const l of s.lands){l.tokens={beasts:2,disease:2,wilds:2};makePiece(s,l,'CITY');makePiece(s,l,'EXPLORER');}
 // Keep source restrictions valid and preserve total Presence.
 const old=s.lands.find(l=>presence(l,p.playerId)>0)!;old.presence=old.presence.filter(x=>x.playerId!==p.playerId);land(s,'A4').presence.push({playerId:p.playerId,count:1});
 s=minorEffect(s,c.key,'A2',p.playerId,level);s=drain(s);if(s.phase==='FINISHED')s.finishedAt=now;
 assert.equal(s.queue.length,0);parseSpiritState(s);assert.ok(spiritProjectionIsConsistent(view(s)));
});
test('Bloodwrack defense uses disease count after addition, with damage split across neighbors',()=>{
 let s=chosen();land(s,'A2').tokens.disease=1;s=drain(minorEffect(s,'bloodwrack-plague','A2',s.players[0]!.playerId,0));const l=land(s,'A2');assert.equal(l.tokens.disease,3);for(const id of [l.id,...l.adjacent])assert.equal(land(s,id).defend,3);
});
test('Savage transformation replaces without destruction fear and discards attached strife',()=>{
 let s=chosen();const l=land(s,'A2');l.pieces=[];const x=makePiece(s,l,'EXPLORER');x.strife=2;s=drain(minorEffect(s,'savage-transformation',l.id,s.players[0]!.playerId,0));assert.equal(land(s,l.id).pieces.length,0);assert.equal(land(s,l.id).tokens.beasts,1);assert.equal(s.fear,2);
});
test('Pent-Up Calamity counts removed tokens, permits return, and does not count Blight',()=>{
 let s=chosen();const l=land(s,'A2');l.tokens={beasts:1,disease:1,wilds:0};s.players[0]!.elements=['MOON','MOON','FIRE','FIRE','FIRE'];s=minorEffect(s,'pent-up-calamity',l.id);s=chooseText(s,'토큰을 제거하여 공포와 피해');s=chooseText(s,'야수 1개 제거');s=chooseText(s,'질병 1개 제거');s=chooseText(s,'제거 완료 · 공포 2 · 피해 6');s=drain(s);assert.equal(land(s,l.id).tokens.beasts,1);assert.equal(land(s,l.id).tokens.disease,1);assert.equal(land(s,l.id).pieces.some(p=>p.kind==='CITY'),false);
});
test('Unlock draws two without forgetting and offers delayed forgetting instead of payment',()=>{
 let s=chosen();const p=s.players[0]!,count=p.hand.length;s.players[0]!.elements=Array.from({length:2},()=>['SUN','MOON','FIRE','AIR','WATER','EARTH','PLANT','ANIMAL'] as const).flat();
 s=minorEffect(s,'unlock-the-gates-of-deepest-power');assert.equal(s.offered.length,2);const id=s.offered[0]!,key=cardPower(s,id).key;s=chooseText(s,cardPower(s,id).title);assert.equal(s.players[0]!.hand.length,count+1);s=chooseText(s,'라운드 끝 망각 · 무료 준비');assert.ok(s.players[0]!.played.includes(id));assert.ok(s.flags.includes(`unlocked:${p.playerId}:${key}`));
 s.queue=[step('SPECIAL',p.playerId,null,0,'NEW_ROUND')];settle(s);assert.ok(s.majorDiscard.includes(id));assert.equal(s.flags.some(f=>f.startsWith('unlocked:')),false);parseSpiritState(s);
});
test('Cast Down removes the board, blight and presence, preserves survivors and awards sacrifice victory',()=>{
 let s=chosen();const actor=s.players[0]!.playerId;s.players[0]!.elements=Array.from({length:4},()=>['SUN','MOON','WATER','EARTH'] as const).flat();grantPower(s,'cast-down-into-the-briny-deep');const id=hold(s,'cast-down-into-the-briny-deep');s.stage='SLOW';land(s,'A2').presence.push({playerId:actor,count:0});
 // Move the existing Presence into a coastal sacred site using its other track token.
 land(s,'A2').presence=[];land(s,'A5').presence=[];land(s,'A2').presence=[{playerId:actor,count:2}];s.players[0]!.energyTrack++;
 s=drain(apply(s,{kind:'USE_POWER',cardId:id,target:'A2',threshold:1,fast:false,repeat:false,shadowReach:false}));assert.deepEqual(s.destroyedBoards,['A']);assert.equal(s.lands.length,0);assert.equal(s.result?.reason,'SACRIFICE');assert.ok(spiritProjectionIsConsistent(view(s)));parseSpiritState(s);
});
test('Ruin snapshots Strife attackers so they can destroy each other',()=>{
 let s=chosen(),l=land(s,'A2');l.pieces=[];const city=makePiece(s,l,'CITY'),town=makePiece(s,l,'TOWN'),explorer=makePiece(s,l,'EXPLORER');city.strife=town.strife=explorer.strife=1;s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'BCM_RUIN')];settle(s);s=drain(s);assert.equal(land(s,l.id).pieces.length,0);
});
test('Ruin Ravage ignores Strife and defense and only damages adjacent Invaders',()=>{
 let s=chosen(),l=land(s,'A2'),actor=s.players[0]!.playerId;l.pieces=[];makePiece(s,l,'CITY').strife=1;makePiece(s,l,'DAHAN');l.defend=100;s.flags.push(`ruin:${l.id}`);const next=land(s,l.adjacent[0]!);next.pieces=[];makePiece(s,next,'CITY');s.queue=[step('SPECIAL',actor,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,l.id).pieces.find(p=>p.kind==='CITY')?.strife,1);assert.equal(land(s,l.id).pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(land(s,next.id).pieces.length,0);
});
test('Fire and Flood selects one common sacred source and two distinct targets',()=>{
 let s=chosen(),p=s.players[0]!,l=land(s,'A2');land(s,'A5').presence=[];l.presence=[{playerId:p.playerId,count:2}];p.energyTrack++;p.elements=['FIRE','FIRE','FIRE','WATER','WATER','WATER'];
 s=minorEffect(s,'fire-and-flood',l.id);assert.equal(s.queue[0]?.key,'BCM_FIRE_FLOOD_SOURCE');s=chooseText(s,'A2 공통 성소');assert.equal(choiceOptions(s).some(o=>o.landId==='A2'),false);const target=choiceOptions(s).find(o=>o.landId==='A3')!;s=chooseText(s,target.label);s=drain(s);assert.equal(land(s,'A2').pieces.some(p=>p.kind==='CITY'),false);parseSpiritState(s);
});
test('Firevine from range zero adds both Wilds and damages after both additions',()=>{
 let s=chosen(),p=s.players[0]!;land(s,'A5').presence=[];land(s,'A4').presence=[{playerId:p.playerId,count:1}];land(s,'A4').pieces=[];makePiece(s,land(s,'A4'),'CITY');s=drain(minorEffect(s,'strangling-firevine','A4',p.playerId,0));assert.equal(land(s,'A4').tokens.wilds,2);assert.equal(land(s,'A4').pieces[0]?.damage,2);
});
test('Bringer Cast Down keeps the board and others Presence while destroying its own',()=>{
 let s=setup(2);s=apply(s,{kind:'SELECT_SPIRIT',spirit:'BRINGER'});s=apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'},s.players[1]!.playerId);const p=s.players[0]!;
 s.flags.push(`power:${p.playerId}`);const before=s.lands.length,other=s.players[1]!.playerId,otherPresence=s.lands.reduce((n,l)=>n+presence(l,other),0);s.queue=[step('SPECIAL',p.playerId,'A2',0,'BCM_SINK')];settle(s);s=drain(s);assert.equal(s.lands.length,before);assert.deepEqual(s.destroyedBoards,[]);assert.equal(s.lands.reduce((n,l)=>n+presence(l,p.playerId),0),0);assert.equal(s.lands.reduce((n,l)=>n+presence(l,other),0),otherPresence);
});
test('Sinking one board rescues immortal Dahan and preserves adjacent-board topology',()=>{
 let s=chosen(2),actor=s.players[0]!.playerId;land(s,'B2').presence.push({playerId:actor,count:1});s.players[0]!.energyTrack++;s.flags.push('immortal:A2');land(s,'A2').vitality=true;const dahan=land(s,'A2').pieces.find(p=>p.kind==='DAHAN')!.id;
 s.queue=[step('SPECIAL',actor,'A2',0,'BCM_SINK')];settle(s);s=drain(s);assert.deepEqual(s.destroyedBoards,['A']);assert.ok(s.lands.some(l=>l.pieces.some(p=>p.id===dahan)));assert.equal(s.lands.some(l=>l.adjacent.some(id=>id.startsWith('A'))),false);assert.ok(spiritProjectionIsConsistent(view(s)));parseSpiritState(s);
});
test('Unlock forced thresholds do not grant elements to other powers',()=>{
 let s=chosen(),actor=s.players[0]!.playerId;s.flags.push(`unlocked:${actor}:cleansing-floods`);const unlocked=powerSteps(s,actor,'cleansing-floods','A2',actor,0),normal=powerSteps(s,actor,'accelerated-rot','A2',actor,1);assert.equal(unlocked.find(e=>e.kind==='DAMAGE')?.n,14);assert.equal(normal.find(e=>e.kind==='DAMAGE')?.n,4);assert.equal(s.flags.some(f=>f.startsWith('threshold-active:')),false);
});
test('Flow carries blight as movement without cascading or destroying Presence',()=>{
 let s=chosen(),p=s.players[0]!;p.elements=['AIR','AIR','WATER','WATER'];land(s,'A5').blight=2;s.blightTotal+=2;s=minorEffect(s,'flow-like-water-reach-like-air');s=chooseText(s,'A5 현신 → A4');while(s.queue[0]?.tags[0]!=='BLIGHT')s=chooseText(s,'동반 이동 마치기');s=chooseText(s,'A5 오염 → A4');s=chooseText(s,'A5 오염 → A4');s=drain(s);assert.equal(land(s,'A4').blight,3);assert.equal(presence(land(s,'A4'),p.playerId),1);assert.equal(s.blightPool,6);parseSpiritState(s);
});
test('Ruin lets players resolve its Ravage before another matching land',()=>{
 let s=chosen();const first=land(s,'A6'),later=land(s,'A1');s.stage='RAVAGE';s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.flags.push(`ruin:${first.id}`);s=apply(s,{kind:'ADVANCE'});assert.equal(s.queue[0]?.key,'BCM_RAVAGE_ORDER');assert.ok(choiceOptions(s).some(o=>o.landId===first.id));s=chooseText(s,`${first.id} 파괴 먼저 해결`);s=drain(s);assert.equal(s.stage,'BUILD');assert.equal(s.queue.length,0);assert.ok(later.id);
});
test('An unrestricted repeat retains both numeric range and source terrain',()=>{
 let s=chosen(),p=s.players[0]!;grantPower(s,'pyroclastic-flow');const id=hold(s,'pyroclastic-flow');p.resolved.push(id);p.repeatGrants.push({id:'major-repeat',remaining:1,maxCost:9,paid:false,used:[]});s.stage='FAST';land(s,'A5').presence=[];land(s,'A1').presence=[{playerId:p.playerId,count:1}];const option=powerOptions(s,p.playerId).find(o=>o.cardId===id)!;assert.equal(option.targets.includes('A8'),false);assert.ok(option.targets.includes('A1'));
 land(s,'A1').presence=[];land(s,'A4').presence=[{playerId:p.playerId,count:1}];assert.equal(powerOptions(s,p.playerId).find(o=>o.cardId===id)?.targets.length,0);
});

function eventGame(n=1,key:SpiritEventKey='NEW_SPECIES',round=2) {
 let s=setup(n);s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true}});
 for(const [i,p] of s.players.entries())s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:SPIRITS[i]!.id},p.playerId));
 s.round=round;s.stage='FAST';s.eventDeck=[key,...s.eventDeck.filter(k=>k!==key)];
 for(const p of s.players)s=apply(s,{kind:'READY',ready:true},p.playerId);
 return s;
}
function eventChoose(s:SpiritState,text:string) {const option=choiceOptions(s).find(o=>o.label.includes(text));assert.ok(option,`${text}: ${choiceOptions(s).map(o=>o.label).join(',')}`);const e=s.queue[0]!;return apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id},e.target??e.actor);}
test('Events: core has no deck; expansion reveals after blight penalties and skips first round effects',()=>{
 let core=chosen();core.stage='FAST';core=apply(core,{kind:'READY',ready:true});assert.equal(core.currentEvent,null);assert.equal(core.queue.length,0);
 let s=eventGame(1,'NEW_SPECIES',1);const before=JSON.stringify(s.lands);assert.equal(s.currentEvent,'NEW_SPECIES');assert.equal(s.queue[0]?.key,'BCE_REVEAL');s=drain(s);assert.equal(JSON.stringify(s.lands),before);assert.equal(s.stage,'FEAR');
 s=branchClaw('KEEPER');s.blighted=true;s.stage='FAST';s=apply(s,{kind:'READY',ready:true});assert.equal(s.queue[0]?.key,'BLIGHT_PENALTY');assert.equal(s.currentEvent,null);s=drain(s);assert.equal(s.currentEvent,'NEW_SPECIES');
});
test('Events: pending reveal blocks advancing and concealed deck order never projects',()=>{
 const s=eventGame(2),before=JSON.stringify(s);assert.equal(applySpiritAction(s,s.players[0]!.playerId,{kind:'ADVANCE'},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
 const other=view(s,0);assert.equal(other.currentEvent,'NEW_SPECIES');assert.ok(!JSON.stringify(other).includes('LITTLE_RAIN'));assert.ok(!Object.hasOwn(other,'eventDeck'));assert.ok(spiritProjectionIsConsistent(other));
});
test('Events: unsupported, duplicate and missing event cards fail canonical validation',()=>{
 const s=eventGame();assert.throws(()=>parseSpiritState({...s,eventDeck:['NEW_SPECIES']}));assert.throws(()=>parseSpiritState({...s,eventDeck:[]}));assert.throws(()=>parseSpiritState({...s,eventDeck:['UNKNOWN']}));
});
test('Events: support pledges can be cancelled with no resources consumed',()=>{
 let s=eventChoose(eventGame(),'이벤트 선택 시작');s.players[0]!.energy=5;s=eventChoose(s,'비용 4');const energy=s.players[0]!.energy,hand=[...s.players[0]!.hand];s=eventChoose(s,'에너지 1 지원 추가');assert.equal(s.players[0]!.energy,energy);assert.equal(view(s).eventPayment?.energy,1);s=eventChoose(s,'지원 취소');assert.equal(s.eventPayment,null);assert.equal(s.players[0]!.energy,energy);assert.deepEqual(s.players[0]!.hand,hand);
});
test('Events: energy can be split among teammates, authenticated and committed only when funded',()=>{
 let s=eventChoose(eventGame(2),'이벤트 선택 시작');for(const p of s.players)p.energy=5;s=eventChoose(s,'비용 8');const first=s.queue[0]!.target!;
 const before=JSON.stringify(s),option=choiceOptions(s)[0]!;assert.equal(applySpiritAction(s,s.players.find(p=>p.playerId!==first)!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
 assert.ok(!choiceOptions(s).some(o=>o.label.includes('비용 확정')));
 for(let i=0;i<3;i++)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'다음 정령');for(let i=0;i<5;i++)s=eventChoose(s,'에너지 1 지원 추가');assert.equal(view(s).eventPayment?.remaining,0);s=eventChoose(s,'비용 확정');assert.equal(s.eventPayment,null);assert.equal(s.players.reduce((n,p)=>n+p.energy,0),2);assert.ok(s.queue[0]?.key==='BCE_BEAST_LAND');s=drain(s);parseSpiritState(s);
});
test('Events: forgetting a played card replaces its element support rather than double counting',()=>{
 let s=eventChoose(eventGame(),'이벤트 선택 시작');const id=grantPower(s,'call-of-the-dahan-ways');s.players[0]!.hand=s.players[0]!.hand.filter(c=>c!==id);s.players[0]!.played.push(id);
 s=eventChoose(s,'비용 4');const initial=view(s).eventPayment!.support;s=eventChoose(s,'망각으로 지원 4 (사용 원소 제외)');assert.equal(view(s).eventPayment!.support,initial+4-cardPower(s,id).elements.filter(e=>e==='MOON').length);assert.ok(s.players[0]!.played.includes(id));assert.ok(!choiceOptions(s).some(o=>o.label.includes(cardPower(s,id).title)&&o.label.includes('손패 버림')));s=eventChoose(s,'비용 확정');assert.ok(!s.players[0]!.played.includes(id));assert.ok(s.minorDiscard.includes(id));
});
test('Events: one card cannot be pledged twice or discarded then forgotten',()=>{
 let s=eventChoose(eventGame(),'이벤트 선택 시작');const id=grantPower(s,'call-of-the-dahan-ways');s=eventChoose(s,'비용 4');s=eventChoose(s,`${cardPower(s,id).title} · 손패 버림`);const opts=choiceOptions(s).filter(o=>o.label.includes(cardPower(s,id).title));assert.equal(opts.length,1);assert.match(opts[0]!.label,/취소/);
 const broken=structuredClone(s);broken.eventPayment!.pledges[0]!.cards.push({cardId:id,mode:'FORGET'});assert.throws(()=>parseSpiritState(broken));
});
test('Events: new species free branch discards power, returns event, and resolves disease then Dahan',()=>{
 let s=eventChoose(eventGame(),'이벤트 선택 시작');const l=land(s,'A2');makePiece(s,l,'DAHAN');const old=l.tokens.disease,dahanBefore=l.pieces.filter(p=>p.kind==='DAHAN').length;const before=s.minor[0]!;s=eventChoose(s,'외래종');s=drain(s);assert.ok(s.minorDiscard.includes(before));assert.ok(s.eventDeck.includes('NEW_SPECIES'));assert.ok(!s.eventDiscard.includes('NEW_SPECIES'));assert.equal(land(s,'A2').tokens.disease,old+1);assert.equal(land(s,'A2').pieces.filter(p=>p.kind==='DAHAN').length,dahanBefore-1);parseSpiritState(s);
});
test('Events: beasts attack sequentially and only the beast finishing a building is removed',()=>{
 let s=eventGame(1,'LITTLE_RAIN');s.queue=[];const l=land(s,'A2');l.pieces=[];makePiece(s,l,'CITY');l.tokens.beasts=2;s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,2,'BCE_BEAST_ATTACK')];settle(s);s=drain(s);assert.equal(land(s,'A2').pieces.length,0);assert.equal(land(s,'A2').tokens.beasts,1);
});
test('Events: drought health respects England and heals/reset at time passing',()=>{
 let s=eventGame(1,'LITTLE_RAIN');const l=land(s,'A2');l.invaderHealth=1;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE_HEALTH')];settle(s);assert.equal(l.eventHealthLoss,true);assert.equal(health(l,l.pieces.find(p=>p.kind==='CITY')!),3);assert.equal(health(l,l.pieces.find(p=>p.kind==='DAHAN')!),1);assert.equal(land(s,'A2').invaderHealth,1);s.queue=[];s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.ok(s.lands.every(l=>!l.eventHealthLoss));assert.equal(s.currentEvent,null);
});
test('Events: canny defense is per Dahan during ravage and does not alter power defense',()=>{
 let s=eventGame(1,'LITTLE_RAIN');s.queue=[];s.flags.push('event-canny');const l=land(s,'A2');l.pieces=[];makePiece(s,l,'TOWN');makePiece(s,l,'DAHAN');makePiece(s,l,'DAHAN');assert.equal(defense(s,l),0);s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,'A2').blight,0);assert.equal(land(s,'A2').pieces.filter(p=>p.kind==='DAHAN').length,2);
});
test('Events: both event branches resolve for one through four spirits',()=>{
 for(const n of [1,2,3,4])for(const key of ['NEW_SPECIES','LITTLE_RAIN'] as const)for(const paid of [false,true]){let s=eventChoose(eventGame(n,key),'이벤트 선택 시작');if(paid){for(const p of s.players)p.elements=[...p.elements,...Array.from({length:4},()=>key==='NEW_SPECIES'?'MOON' as const:'WATER' as const)];s=eventChoose(s,`비용 ${4*n}`);s=eventChoose(s,'비용 확정');}else s=eventChoose(s,key==='NEW_SPECIES'?'외래종':'가뭄을 감수');s=drain(s);assert.equal(s.queue.length,0);parseSpiritState(s);}
});
test('Events: exhausted preview deck reshuffles through injected random source at next round',()=>{
 let s=eventGame();s.queue=[];s.currentEvent=null;s.eventDiscard=[...SPIRIT_EVENT_KEYS];s.eventDeck=[];s.stage='FAST';s.round=3;let calls=0;
 const result=applySpiritAction(s,s.players[0]!.playerId,{kind:'READY',ready:true},now,v.parse(TurnIdSchema,'event-shuffle'),a=>{calls++;return [...a].reverse();});assert.ok(result.ok);assert.equal(calls,1);assert.equal(result.state.currentEvent,SPIRIT_EVENT_KEYS.at(-1));assert.equal(result.state.eventDeck[0],SPIRIT_EVENT_KEYS.at(-2));parseSpiritState(result.state);
});
test('Events: Ocean is excluded from disease placement even with Dahan and invaders',()=>{
 let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'OCEAN'}));s.currentEvent='NEW_SPECIES';const ocean=land(s,'A0');makePiece(s,ocean,'DAHAN');makePiece(s,ocean,'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,1,'BCE_DISEASE')];settle(s);assert.ok(!choiceOptions(s).some(o=>o.landId==='A0'));s=drain(s);assert.equal(land(s,'A0').tokens.disease,0);
});

const stageEvents=['SEEKING_INTERIOR','RECONNAISSANCE','DISCOVERIES','STRANGE_TALES'] as const;
for(const key of stageEvents)for(const stage of [1,2,3] as const)for(const n of [1,2,3,4])test(`Stage event ${key}: invader stage ${stage}, ${n} spirits`,()=>{
 let s=eventGame(n,key);s.eventInvaderStage=stage;s=eventChoose(s,'이벤트 선택 시작');s=drain(s);assert.equal(s.queue.length,0);assert.equal(s.stage,'FEAR');parseSpiritState(s);
});
test('Stage events: all configured event keys are configured once; core contains none',()=>{
 const s=branchClaw();assert.deepEqual([...s.eventDeck].sort(),[...SPIRIT_EVENT_KEYS].sort());assert.equal(s.eventDeck.length,25);assert.equal(chosen().eventDeck.length,0);
});
test('Stage events: Prussia early III counts as II, real late III and empty deck count as III',()=>{
 const s=branchClaw();s.settings.adversary='PRUSSIA';s.settings.level=2;s.invaderDeck=[{stage:3,terrains:['JUNGLE','SANDS'],coastal:false},{stage:2,terrains:['MOUNTAIN'],coastal:false}];assert.equal(currentInvaderStage(s),2);s.invaderDeck.shift();assert.equal(currentInvaderStage(s),2);s.invaderDeck=[{stage:3,terrains:['JUNGLE','SANDS'],coastal:false}];assert.equal(currentInvaderStage(s),3);s.invaderDeck=[];assert.equal(currentInvaderStage(s),3);
});
test('Stage events: reveal freezes the invader stage through later deck advancement',()=>{
 let s=eventGame(1,'DISCOVERIES');const revealed=s.eventInvaderStage;s.invaderDeck=[{stage:3,terrains:['MOUNTAIN','JUNGLE'],coastal:false}];assert.equal(view(s).eventInvaderStage,revealed);s=eventChoose(s,'이벤트 선택 시작');assert.equal(s.flags.includes('event-aggression'),false);assert.equal(s.queue[0]?.key,'BCE2_DISCOVERY');
});
test('Stage events: seeking interior moves only coastal explorers into adjacent inland lands',()=>{
 let s=eventGame(1,'SEEKING_INTERIOR');for(const l of s.lands)l.tokens.beasts=0;s.eventInvaderStage=1;s=eventChoose(s,'이벤트 선택 시작');while(s.queue[0]?.kind==='MOVE'){const from=land(s,s.queue[0].land);assert.equal(from.coastal,true);for(const o of choiceOptions(s)){assert.ok(o.landId);assert.equal(land(s,o.landId).coastal,false);assert.ok(from.adjacent.includes(o.landId));}s=eventChoose(s,'→');}s=drain(s);parseSpiritState(s);
});
test('Stage events: diaspora chooses one global maximum and visits each neighbor at most once',()=>{
 let s=eventGame(2,'SEEKING_INTERIOR');s.eventInvaderStage=2;const source=land(s,'A5');for(let i=0;i<8;i++)makePiece(s,source,'EXPLORER');s=eventChoose(s,'이벤트 선택 시작');assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A5']);s=eventChoose(s,'A5');const first=choiceOptions(s)[0]!;const destination=first.landId!;s=eventChoose(s,first.label);s=eventChoose(s,'→');assert.equal(s.queue[0]?.key,'BCE2_DISPERSE');assert.ok(choiceOptions(s).every(o=>o.landId!==destination));s=drain(s);parseSpiritState(s);
});
test('Stage events: urbanization rounds up, preserves damage and strife and generates no fear',()=>{
 let s=eventGame(1,'RECONNAISSANCE');s.eventInvaderStage=2;const l=land(s,'A5');l.pieces=[];for(let i=0;i<3;i++){const p=makePiece(s,l,'TOWN');p.strife=i+1;p.damage=1;}const initial=s.fear;s=eventChoose(s,'이벤트 선택 시작');s=drain(s);const out=land(s,'A5');assert.equal(out.pieces.filter(p=>p.kind==='CITY').length,2);assert.equal(out.pieces.filter(p=>p.kind==='TOWN').length,1);assert.deepEqual(out.pieces.filter(p=>p.kind==='CITY').map(p=>p.strife),[1,2]);assert.ok(out.pieces.filter(p=>p.kind==='CITY').every(p=>p.damage===1));assert.equal(s.fear,initial);
});
test('Stage events: reconnaissance adds extra explorers only where exploration succeeds',()=>{
 let s=eventGame(1,'RECONNAISSANCE');s=drain(eventChoose(s,'이벤트 선택 시작'));s.invaderDeck=[{stage:1,terrains:['MOUNTAIN'],coastal:false}];const a=land(s,'A1'),b=land(s,'A6');a.tokens.wilds=1;b.skip=false;makePiece(s,b,'TOWN');const beforeA=a.pieces.length,beforeB=b.pieces.length;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);s=drain(s);assert.equal(land(s,'A1').pieces.length,beforeA);assert.equal(land(s,'A1').tokens.wilds,0);assert.equal(land(s,'A6').pieces.length,beforeB+2);
});
test('Stage events: Stricken checks current tokens, skips only ravage and preserves strife/disease',()=>{
 let s=eventGame(1,'RECONNAISSANCE');s=drain(eventChoose(s,'이벤트 선택 시작'));const l=land(s,'A5');l.pieces=[];const town=makePiece(s,l,'TOWN');town.strife=1;makePiece(s,l,'DAHAN');const before=JSON.stringify(l);s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];settle(s);assert.equal(JSON.stringify(l),before);l.tokens.disease=1;s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'BUILD_LAND')];settle(s);assert.equal(l.tokens.disease,0);assert.equal(town.strife,1);assert.equal(l.skip,false);
});
test('Stage events: retreat must move two Dahan together when possible, and one only as fallback',()=>{
 let s=eventGame(1,'RECONNAISSANCE');s.queue=[];for(const l of s.lands)l.pieces=l.pieces.filter(p=>p.kind!=='DAHAN');const l=land(s,'A2');makePiece(s,l,'DAHAN');makePiece(s,l,'DAHAN');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE2_RETREAT',null,['A','CITY'])];settle(s);assert.ok(choiceOptions(s).every(o=>o.label.includes('다한 2개')));const destination=choiceOptions(s)[0]!.landId!;s=eventChoose(s,'다한 2개');s=drain(s);assert.equal(land(s,'A2').pieces.filter(p=>p.kind==='DAHAN').length,0);assert.equal(land(s,destination).pieces.filter(p=>p.kind==='DAHAN').length,2);
 s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE2_RETREAT',null,['A','CITY'])];makePiece(s,land(s,'A2'),'DAHAN');settle(s);assert.ok(choiceOptions(s).every(o=>o.label.includes('다한 1개')));
});
test('Stage events: disease chooses only jungle/wetland with most buildings, ties remain selectable',()=>{
 const s=eventGame(1,'DISCOVERIES');const a=land(s,'A3'),b=land(s,'A5');for(let i=0;i<2;i++){makePiece(s,a,'TOWN');makePiece(s,b,'CITY');}for(let i=0;i<5;i++)makePiece(s,land(s,'A4'),'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE2_DISEASE',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId).sort(),['A3','A5']);
});
test('Stage events: aggression adds one per land even when strife suppresses individual damage',()=>{
 let s=eventGame(1,'DISCOVERIES');s.eventInvaderStage=2;s=drain(eventChoose(s,'이벤트 선택 시작'));const l=land(s,'A5');l.pieces=[];for(let i=0;i<2;i++){const p=makePiece(s,l,'TOWN');p.strife=1;}s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,'A5').blight,0);assert.ok(s.log.some(e=>e.text.includes('A5 파괴 · 피해 1,')));assert.equal(view(s).eventRavageBonus,1);
});
test('Stage events: rumors add fear now, explorers only after advancing, once and at current sites',()=>{
 let s=eventGame(1,'STRANGE_TALES');for(const l of s.lands)l.tokens.beasts=0;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.fear,1);assert.equal(view(s).eventAfterAdvance,'SACRED_EXPLORERS');const site=land(s,'A5'),before=site.pieces.length;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'ADVANCE_INVADERS')];settle(s);s=drain(s);assert.equal(land(s,'A5').pieces.length,before+1);assert.equal(view(s).eventAfterAdvance,null);s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'ADVANCE_INVADERS')];settle(s);s=drain(s);assert.equal(land(s,'A5').pieces.length,before+1);
});
test('Stage events: fortification excludes all occupied action terrains including immigration',()=>{
 let s=eventGame(1,'STRANGE_TALES');s.eventInvaderStage=2;for(const l of s.lands)l.tokens.beasts=0;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(view(s).eventAfterAdvance,'FORTIFICATION');s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.build={stage:1,terrains:['JUNGLE'],coastal:false};s.immigration={stage:1,terrains:['SANDS'],coastal:false};s.explore=null;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE2_AFTER_ADVANCE')];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.label),['습지 · 추가 건설']);const empty=land(s,'A5');empty.pieces=[];const occupied=land(s,'A2');occupied.tokens.disease=1;s=eventChoose(s,'습지');s=drain(s);assert.equal(land(s,'A5').pieces.length,0);assert.equal(land(s,'A2').tokens.disease,0);assert.equal(view(s).eventAfterAdvance,null);
});
test('Stage events: all terrain slots occupied makes fortification a safe no-op',()=>{
 const s=eventGame(1,'STRANGE_TALES');s.queue=[];s.ravage={stage:3,terrains:['MOUNTAIN','JUNGLE'],coastal:false};s.build={stage:3,terrains:['SANDS','WETLAND'],coastal:false};s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE2_FORTIFY')];settle(s);assert.equal(s.queue.length,0);
});
test('Stage events: deferred effects and round modifiers reset at time passing',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-recon','event-aggression','event-stricken','event-fortification');s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));const g=view(s);assert.equal(g.eventInvaderStage,null);assert.equal(g.eventAfterAdvance,null);assert.equal(g.eventRavageBonus,0);assert.equal(g.eventStricken,false);assert.equal(g.eventExploreBonus,false);
});
test('Stage events: prowling beasts offer Fangs a presence follow without entering Ocean',()=>{
 let s=branchClaw('FANGS');const actor=s.players[0]!.playerId,source=s.lands.find(l=>presence(l,actor)>0&&l.tokens.beasts>0)!;source.pieces=source.pieces.filter(p=>p.kind==='DAHAN');s.queue=[step('SPECIAL',actor,null,0,'BCE2_PROWL',null,[source.id])];settle(s);const first=choiceOptions(s)[0]!;assert.ok(first.landId);assert.ok(land(s,first.landId).number>0);s=eventChoose(s,first.label);assert.equal(s.queue[0]?.key,'FOLLOW_DAHAN');s=drain(s);parseSpiritState(s);
});
test('Stage events: Dahan retreat retains Thunder presence-follow choices',()=>{
 let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'THUNDER'}));const actor=s.players[0]!.playerId,source=s.lands.find(l=>presence(l,actor)>0)!;makePiece(s,source,'CITY');makePiece(s,source,'DAHAN');makePiece(s,source,'DAHAN');s.queue=[step('SPECIAL',actor,null,0,'BCE2_RETREAT',null,['A','CITY'])];settle(s);const option=choiceOptions(s).find(o=>o.label.startsWith(source.id))!;assert.ok(option);s=eventChoose(s,option.label);s=eventChoose(s,'→');assert.equal(s.queue[0]?.key,'PUSH');s=eventChoose(s,'→');assert.equal(s.queue[0]?.key,'FOLLOW_DAHAN');s=drain(s);parseSpiritState(s);
});

for(const key of ['TIGHT_KNIT','WELL_PREPARED'] as const)for(const blighted of [false,true])for(let n=1;n<=4;n++)test(`Island events: ${key} / blighted ${blighted} / ${n} players resolves`,()=>{
 let s=eventGame(n,key);s.blighted=blighted;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.stage,'FEAR');assert.equal(s.eventIslandState,blighted?'BLIGHTED':'HEALTHY');assert.equal(s.queue.length,0);parseSpiritState(s);assert.ok(v.safeParse(SpiritPlayingProjectionSchema,view(s)).success);
});
test('Island events: health bonus changes only intended pieces and stacks with existing modifiers',()=>{
 const s=eventGame(),l=land(s,'A1');l.pieces=[];l.invaderHealth=2;l.dahanHealth=1;l.eventHealthBonus='BUILDINGS';const pieces=(['EXPLORER','TOWN','CITY','DAHAN'] as const).map(k=>makePiece(s,l,k));assert.deepEqual(pieces.map(p=>health(l,p)),[1,5,6,3]);l.eventHealthBonus='EXPLORERS';assert.deepEqual(pieces.map(p=>health(l,p)),[2,4,5,3]);l.eventHealthLoss=true;assert.deepEqual(pieces.map(p=>health(l,p)),[2,3,4,2]);
});
test('Island events: health bonus and branch reset next round; first round does not apply bonus',()=>{
 let s=eventGame(1,'WELL_PREPARED',1);s=drain(s);assert.equal(s.eventIslandState,null);assert.ok(s.lands.every(l=>l.eventHealthBonus===null));s=eventGame(1,'WELL_PREPARED');s=drain(eventChoose(s,'이벤트 선택 시작'));assert.ok(s.lands.every(l=>l.eventHealthBonus==='EXPLORERS'));s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(s.eventIslandState,null);assert.ok(s.lands.every(l=>l.eventHealthBonus===null));
});
test('Island events: pledge cancellation is free and two spirits may jointly protect a board',()=>{
 let s=eventGame(2,'TIGHT_KNIT');s.blighted=true;s.queue=[];for(const l of s.lands)l.presence=[];const a=land(s,'A1'),b=land(s,'A2');a.presence=[{playerId:s.players[0]!.playerId,count:1}];b.presence=[{playerId:s.players[1]!.playerId,count:2}];s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE3_PROTECT',null,['A'])];settle(s);
 const before=JSON.stringify(s.lands);s=eventChoose(s,'현신 2개로 보호');s=eventChoose(s,'A1');assert.equal(JSON.stringify(s.lands),before);s=eventChoose(s,'희생 취소');assert.equal(JSON.stringify(s.lands),before);
 s=eventChoose(s,'현신 2개로 보호');s=eventChoose(s,'A1');assert.ok(!choiceOptions(s).some(o=>o.label.startsWith('A1')));s=eventChoose(s,'A2');assert.equal(JSON.stringify(s.lands),before);const counts=s.players.map(p=>p.destroyedPresence);s=eventChoose(s,'희생 확정');assert.equal(presence(land(s,'A1'),s.players[0]!.playerId),0);assert.equal(presence(land(s,'A2'),s.players[1]!.playerId),1);assert.deepEqual(s.players.map(p=>p.destroyedPresence),counts.map(n=>n+1));assert.equal(s.queue.length,0);
});
test('Island events: one presence cannot protect and outside-board presence cannot be pledged',()=>{
 const s=eventGame(2);for(const l of s.lands.filter(l=>l.board==='A'))l.presence=[];land(s,'A1').presence=[{playerId:s.players[0]!.playerId,count:1}];s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE3_PROTECT',null,['A'])];settle(s);assert.equal(choiceOptions(s).length,1);assert.match(choiceOptions(s)[0]!.label,/받아들인다/);
});
test('Island events: blight spread uses adjacency not existing blight, including cross-board neighbors',()=>{
 const s=eventGame(2);for(const l of s.lands)l.blight=0;const a=land(s,'A1'),b=land(s,'B1');a.adjacent=[b.id];b.blight=1;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE3_BLIGHT',null,['A'])];settle(s);const expected=s.lands.filter(l=>l.board==='A'&&l.adjacent.includes('B1')).map(l=>l.id);assert.deepEqual(choiceOptions(s).map(o=>o.landId),expected);assert.ok(expected.includes('A1'));
});
test('Island events: prey destroys explorers regardless of health and adds only one beast on an empty board',()=>{
 let s=eventGame(3,'TIGHT_KNIT');for(const l of s.lands)l.tokens.beasts=0;const l=land(s,'A1');l.pieces=[];l.tokens.beasts=2;l.eventHealthBonus='EXPLORERS';for(let i=0;i<3;i++)makePiece(s,l,'EXPLORER');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE3_TOKEN')];settle(s);s=eventChoose(s,'탐험가 파괴');s=eventChoose(s,'탐험가 파괴');assert.equal(land(s,'A1').pieces.length,1);assert.ok(choiceOptions(s).every(o=>o.landId?.startsWith('B')||o.landId?.startsWith('C')));s=eventChoose(s,'B1');assert.equal(s.lands.reduce((n,l)=>n+l.tokens.beasts,0),3);assert.equal(s.queue.length,0);
});
for(const key of ['TIGHT_KNIT','WELL_PREPARED'] as const)test(`Island events: ${key} Dahan birth stays in its coastal/inland band`,()=>{
 const s=eventGame(1,key);s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE3_DAHAN',null,['A'])];settle(s);assert.ok(choiceOptions(s).length>0);for(const o of choiceOptions(s)){assert.ok(o.landId);const l=land(s,o.landId);assert.equal(l.coastal,key==='TIGHT_KNIT');assert.ok(l.pieces.some(p=>p.kind==='DAHAN'));}
});
test('Island events: another actor or stale revision cannot change a sacrifice plan',()=>{
 let s=eventGame(2,'TIGHT_KNIT');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE3_PROTECT',null,['B'])];settle(s);s=eventChoose(s,'현신 2개로 보호');const option=choiceOptions(s).find(o=>o.landId);assert.ok(option);const before=JSON.stringify(s),action:SpiritAction={kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id};assert.equal(applySpiritAction(s,s.players[1]!.playerId,action,now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,s.players[0]!.playerId,{...action,choiceId:'stale'},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
});

for(const key of ['ROOTS','NEW_LANDS','SURGE_INLAND','POPULATION'] as const)for(const blighted of [false,true])for(let n=1;n<=4;n++)test(`Settlement events: ${key} / blighted ${blighted} / ${n} players resolves`,()=>{
 let s=eventGame(n,key);s.blighted=blighted;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.queue.length,0);assert.equal(s.eventIslandState,blighted?'BLIGHTED':'HEALTHY');parseSpiritState(s);if(key==='POPULATION'&&blighted&&n>1){assert.equal(s.result?.reason,'PRESENCE');assert.ok(v.safeParse(SpiritFinishedProjectionSchema,view(s)).success);}else assert.ok(v.safeParse(SpiritPlayingProjectionSchema,view(s)).success);
});
test('Settlement events: roots replaces inland explorer preserving strife without fear',()=>{
 let s=eventGame(1,'ROOTS');const l=land(s,'A5');l.pieces=[];const p=makePiece(s,l,'EXPLORER');p.strife=2;const initial=s.fear;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_ROOTS',null,['A'])];settle(s);assert.ok(choiceOptions(s).every(o=>o.landId&&!land(s,o.landId).coastal));s=eventChoose(s,'A5');assert.equal(land(s,'A5').pieces[0]?.kind,'TOWN');assert.equal(land(s,'A5').pieces[0]?.strife,2);assert.equal(s.fear,initial);
});
test('Settlement events: exploration pushes only to empty adjacent lands, preserving the piece',()=>{
 let s=eventGame(1,'NEW_LANDS');const l=land(s,'A3');l.pieces=[];const p=makePiece(s,l,'EXPLORER');p.strife=1;makePiece(s,l,'EXPLORER');s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'BCE4_SEARCH')];settle(s);const options=choiceOptions(s);assert.ok(options.length);assert.ok(options.every(o=>o.landId&&land(s,o.landId).pieces.every(p=>p.kind==='DAHAN')));const o=options.find(o=>o.pieceId===p.id)!;s=eventChoose(s,o.label);s=drain(s);assert.ok(land(s,o.landId).pieces.some(q=>q.id===p.id&&q.strife===1));assert.equal(land(s,l.id).pieces.length,1);
});
test('Settlement events: surge stops after one move when no farther inland destination exists',()=>{
 let s=eventGame(1,'SURGE_INLAND');const p=makePiece(s,land(s,'A3'),'TOWN');p.strife=2;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_SURGE',null,['A'])];settle(s);s=eventChoose(s,'A3 마을 → A4');s=eventChoose(s,'→ A4');assert.equal(s.queue[0]?.key,'BCE4_SURGE_NEXT');assert.ok(land(s,'A4').pieces.some(q=>q.id===p.id&&q.strife===2));assert.deepEqual(choiceOptions(s).map(o=>o.label),['한 번 이동으로 마치기']);s=drain(s);assert.equal(s.queue.length,0);
});
test('Settlement events: roots protection requires three presence and confirms all three together',()=>{
 let s=eventGame(3,'ROOTS');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,3,'BCE3_PROTECT',null,['C','INLAND'])];settle(s);s=eventChoose(s,'현신 3개로 보호');const before=JSON.stringify(s.lands);for(let i=0;i<3;i++){const o=choiceOptions(s).find(o=>o.label.includes('현신 선택'));assert.ok(o);s=eventChoose(s,o.label);if(i<2)assert.ok(!choiceOptions(s).some(o=>o.label.includes('희생 확정')));}assert.equal(JSON.stringify(s.lands),before);s=eventChoose(s,'현신 3개 희생 확정');assert.equal(s.players[2]!.destroyedPresence,3);assert.equal(s.lands.filter(l=>l.board==='C').flatMap(l=>l.presence).length,0);parseSpiritState(s);
});
for(const mode of ['INLAND','COAST','BUILDINGS'])test(`Settlement events: blight filter ${mode}`,()=>{
 const s=eventGame();s.queue=[step('SPECIAL',s.players[0]!.playerId,null,2,'BCE3_BLIGHT',null,['A',mode])];settle(s);const expected=s.lands.filter(l=>l.board==='A'&&(mode==='INLAND'?!l.coastal:mode==='COAST'?l.coastal:l.pieces.some(p=>p.kind==='TOWN'||p.kind==='CITY')||l.adjacent.some(id=>land(s,id).pieces.some(p=>p.kind==='TOWN'||p.kind==='CITY')))).map(l=>l.id);assert.deepEqual(choiceOptions(s).map(o=>o.landId),expected);
});
test('Settlement events: empty boards are excluded from roots and devastated shores blight',()=>{
 for(const key of ['ROOTS','NEW_LANDS'] as const){let s=eventGame(2,key);s.blighted=true;for(const l of s.lands.filter(l=>l.board==='A'))l.pieces=l.pieces.filter(p=>p.kind==='DAHAN');s=eventChoose(s,'이벤트 선택 시작');assert.equal(s.queue[0]?.tags[0],'B');assert.equal(s.queue.filter(e=>e.key==='BCE3_PROTECT').length,1);}
});
test('Settlement events: power fade removes blight from supply and total, never from land',()=>{
 let s=eventGame(1,'POPULATION');s.blighted=true;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_FADE',s.players[0]!.playerId)];settle(s);const before=JSON.stringify(s.lands),pool=s.blightPool,total=s.blightTotal;s=eventChoose(s,'게임에서 제거');assert.equal(s.blightPool,pool-1);assert.equal(s.blightTotal,total-1);assert.equal(JSON.stringify(s.lands),before);parseSpiritState(s);
});
test('Settlement events: power fade forgets two distinct powers and preserves card conservation',()=>{
 let s=eventGame(1,'POPULATION');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_FADE',s.players[0]!.playerId)];settle(s);const before=s.players[0]!.hand.length;s=eventChoose(s,'능력 2장');s=drain(s);assert.equal(s.players[0]!.hand.length,before-2);parseSpiritState(s);
});
test('Settlement events: fade supply exhaustion causes loss and cannot borrow another spirit presence',()=>{
 let s=eventGame(1,'POPULATION');s.blighted=true;s.blightTotal-=s.blightPool-1;s.blightPool=1;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_FADE',s.players[0]!.playerId),step('CHECK',s.players[0]!.playerId)];settle(s);assert.ok(!choiceOptions(s).some(o=>o.label==='내 현신 2개 파괴'));s=eventChoose(s,'게임에서 제거');assert.equal(s.result?.reason,'BLIGHT');parseSpiritState(s);
});
test('Settlement events: sandfever counts only mountains and sands, including ties',()=>{
 const s=eventGame(1,'POPULATION');for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A1'),'TOWN');makePiece(s,land(s,'A4'),'CITY');for(let i=0;i<4;i++)makePiece(s,land(s,'A5'),'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_SANDFEVER',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1','A4']);
});
test('Settlement events: distant hunt respects blight and retains Fangs presence-follow',()=>{
 let s=branchClaw('FANGS');const from=s.lands.find(l=>presence(l,s.players[0]!.playerId)>0&&l.tokens.beasts>0)!;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_HUNT',null,[from.board])];settle(s);const o=choiceOptions(s).find(o=>o.label.startsWith(from.id));assert.ok(o);assert.equal(land(s,o.landId).blight,0);s=eventChoose(s,o.label);assert.equal(s.queue[0]?.key,'FOLLOW_DAHAN');s=drain(s);parseSpiritState(s);
});
test('Settlement events: grim toll damages both sides before the Dahan defense event',()=>{
 let s=eventGame(1,'SURGE_INLAND');const l=land(s,'A5');l.pieces=[];l.tokens.disease=1;makePiece(s,l,'TOWN');makePiece(s,l,'DAHAN');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_GRIM',null,['A']),step('SPECIAL',s.players[0]!.playerId,null,0,'BCE4_DAHAN')];settle(s);s=eventChoose(s,'A5');s=drain(s);assert.equal(land(s,'A5').pieces.length,0);assert.ok(s.flags.includes('event-canny'));assert.equal(land(s,'A5').tokens.disease,1);
});
test('Settlement events: each spirit can choose forgetting independently and continue after power fade',()=>{
 let s=eventGame(2,'POPULATION');s.blighted=true;s=eventChoose(s,'이벤트 선택 시작');let choices=0;while(s.queue.length&&s.phase==='PLAYING'){const options=choiceOptions(s),fade=s.queue[0]?.key==='BCE4_FADE';const option=fade?options.find(o=>o.label==='내 능력 2장 망각'):options[0];assert.ok(option);if(fade)choices++;s=eventChoose(s,option.label);}assert.equal(choices,2);assert.equal(s.phase,'PLAYING');assert.ok(s.players.every(p=>p.hand.length===2));parseSpiritState(s);
});

for(const key of ['URBAN_DEVELOPMENT','HEAVY_FARMING'] as const)for(const blighted of [false,true])for(const n of [1,2,3,4])test(`Industry events: ${key} ${blighted?'blighted':'healthy'} ${n} players`,()=>{
 let s=eventGame(n,key);s.blighted=blighted;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.queue.length,0);assert.equal(s.eventIslandState,blighted?'BLIGHTED':'HEALTHY');assert.equal(s.phase,'PLAYING');parseSpiritState(s);assert.ok(v.safeParse(SpiritPlayingProjectionSchema,view(s)).success);assert.equal(view(s).eventCityDamage,!blighted&&key==='URBAN_DEVELOPMENT'?2:0);assert.equal(view(s).eventTownDamage,!blighted&&key==='HEAVY_FARMING'?1:0);
});
test('Normal Ravage bonuses survive empty slots and time, ignore extra Ravages, then expire',()=>{
 let s=eventGame(1,'URBAN_DEVELOPMENT');s=drain(eventChoose(s,'이벤트 선택 시작'));s.flags.push('event-next-town');s.ravage=null;s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventCityDamage,2);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(s.currentEvent,null);assert.equal(view(s).eventCityDamage,2);assert.equal(view(s).eventTownDamage,1);
 const l=land(s,'A1');l.pieces=[];l.defend=4;makePiece(s,l,'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];const blight=l.blight;settle(s);s=drain(s);assert.equal(land(s,'A1').blight,blight);assert.equal(view(s).eventCityDamage,2);
 s.stage='RAVAGE';s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};land(s,'A1').defend=3;s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').blight,blight+1);assert.equal(view(s).eventCityDamage,0);assert.equal(view(s).eventTownDamage,0);assert.equal(view(s).eventNormalRavageActive,false);assert.equal(s.stage,'BUILD');
});
for(const strife of [0,1])test(`Normal Ravage modifiers combine with Sweden; strife ${strife} suppresses whole attacker`,()=>{
 let s=eventGame();s.queue=[];s.settings.adversary='SWEDEN';s.settings.level=3;s.flags.push('event-next-city','event-next-town');const l=land(s,'A1');l.pieces=[];l.defend=8;makePiece(s,l,'CITY').strife=strife;makePiece(s,l,'TOWN');const blight=l.blight;s.stage='RAVAGE';s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').blight,blight+(strife?0:1));assert.equal(land(s,'A1').pieces.find(p=>p.kind==='CITY')?.strife,0);assert.equal(view(s).eventCityDamage,0);
});
test('A normal card consumes pending bonuses even when every matching land skips',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-next-city');for(const l of s.lands)l.skip=true;s.stage='RAVAGE';s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventCityDamage,0);
});
test('Ruin ordering keeps normal damage active through all choices and includes strifed attackers',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-next-city','ruin:A1');const l=land(s,'A1');l.pieces=[];makePiece(s,l,'CITY').strife=1;const to=land(s,l.adjacent[0]!);makePiece(s,to,'CITY');s.stage='RAVAGE';s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s=apply(s,{kind:'ADVANCE'});assert.equal(view(s).eventNormalRavageActive,true);s=eventChoose(s,'A1 파괴 먼저 해결');assert.equal(s.queue[0]?.kind,'DAMAGE');assert.equal(s.queue[0]?.n,5);s=drain(s);assert.equal(view(s).eventCityDamage,0);
});
test('Festering Pits requires two blight, adds without cascade, but destroys presence',()=>{
 let s=eventGame(2,'URBAN_DEVELOPMENT');s.queue=[];const l=land(s,'A5'),owner=s.players[0]!.playerId;assert.ok(presence(l,owner)>0);s.blightPool-=2-l.blight;l.blight=2;const before=s.blightPool,destroyed=s.players[0]!.destroyedPresence;s.queue=[step('SPECIAL',owner,null,0,'BCE5_PITS',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A5']);s=eventChoose(s,'A5');assert.equal(s.queue.length,0);assert.equal(land(s,'A5').blight,3);assert.equal(s.blightPool,before-1);assert.equal(s.players[0]!.destroyedPresence,destroyed+1);parseSpiritState(s);
});
test('Festering Pits only visits invaded boards and accepts an unoccupied polluted land',()=>{
 let s=eventGame(2,'URBAN_DEVELOPMENT');s.blighted=true;for(const l of s.lands.filter(l=>l.board==='A'))l.pieces=l.pieces.filter(p=>p.kind==='DAHAN');const l=land(s,'B8');s.blightPool-=2-l.blight;l.blight=2;l.pieces=[];s=eventChoose(s,'이벤트 선택 시작');assert.equal(s.queue[0]?.key,'BCE5_PITS');assert.deepEqual(choiceOptions(s).map(o=>o.landId),['B8']);
});
test('Overcrowded cities restricts protection and blight placement to boards and lands with cities',()=>{
 let s=eventGame(2,'HEAVY_FARMING');s.blighted=true;for(const l of s.lands)l.pieces=l.pieces.filter(p=>p.kind!=='CITY');makePiece(s,land(s,'B3'),'CITY');s=eventChoose(s,'이벤트 선택 시작');assert.deepEqual(s.queue[0]?.tags,['B','CITY']);s=eventChoose(s,'받아들인다');assert.deepEqual(choiceOptions(s).map(o=>o.landId),['B3']);
});
test('Lingering Plagues retains disease during builds and expires at the end of Invader Phase',()=>{
 let s=eventGame(1,'URBAN_DEVELOPMENT');s=drain(eventChoose(s,'이벤트 선택 시작'));const l=land(s,'A1');l.pieces=[];l.tokens.disease=2;makePiece(s,l,'EXPLORER');s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'BUILD_LAND')];settle(s);assert.equal(l.tokens.disease,2);assert.ok(l.pieces.some(p=>p.kind==='TOWN'));l.skip=true;s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'BUILD_LAND')];settle(s);assert.equal(l.pieces.length,2);assert.equal(l.tokens.disease,2);l.skip=false;s.stage='EXPLORE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventLingeringPlagues,false);const after=land(s,'A1').pieces.length;s.queue=[step('SPECIAL',s.players[0]!.playerId,'A1',0,'BUILD_LAND')];settle(s);assert.equal(land(s,'A1').tokens.disease,1);assert.equal(land(s,'A1').pieces.length,after);
});
test('Fierce Mien counts qualifying lands, not individual Dahan or uninvaded lands',()=>{
 const s=eventGame(1,'URBAN_DEVELOPMENT');s.queue=[];for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A1'),'EXPLORER');makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A2'),'CITY');makePiece(s,land(s,'A2'),'DAHAN');makePiece(s,land(s,'A3'),'DAHAN');makePiece(s,land(s,'A4'),'TOWN');makePiece(s,land(s,'A4'),'DAHAN');makePiece(s,land(s,'A4'),'DAHAN');const before=s.fear;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE5_DAHAN')];settle(s);assert.equal(s.fear,before+2);
});
test('Heavy Farming grows Dahan only in jungle and wetland with existing Dahan',()=>{
 const s=eventGame(1,'HEAVY_FARMING');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE5_GROW',null,['A'])];settle(s);const choices=choiceOptions(s);assert.ok(choices.length);for(const o of choices){const l=land(s,o.landId);assert.ok(['JUNGLE','WETLAND'].includes(l.terrain));assert.ok(l.pieces.some(p=>p.kind==='DAHAN'));}
});

for(const key of ['CULTURAL_ASSIMILATION','DISTANT_EXPLORATION'] as const)for(const terror of [1,2,3] as const)for(const n of [1,2,3,4])test(`Terror events: ${key} terror ${terror}, ${n} spirits`,()=>{
 let s=eventGame(n,key);s.terror=terror;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.queue.length,0);assert.equal(s.eventTerrorLevel,terror);parseSpiritState(s);assert.ok(v.safeParse(s.phase==='PLAYING'?SpiritPlayingProjectionSchema:SpiritFinishedProjectionSchema,view(s)).success);if(key==='DISTANT_EXPLORATION'){assert.equal(view(s).eventDistantExplore,terror===1);assert.equal(view(s).eventFearfulMobs,terror>1);}
});
test('Cultural assimilation requires exactly one Dahan and a city here or across a board edge',()=>{
 let s=eventGame(2,'CULTURAL_ASSIMILATION');s.queue=[];for(const l of s.lands)l.pieces=[];
 const a=s.lands.find(l=>l.board==='A'&&l.adjacent.some(id=>land(s,id).board==='B'))!,b=land(s,a.adjacent.find(id=>land(s,id).board==='B')!);makePiece(s,a,'DAHAN');makePiece(s,b,'CITY');const wrong=land(s,'A5');if(wrong.id!==a.id){makePiece(s,wrong,'DAHAN');makePiece(s,wrong,'DAHAN');makePiece(s,wrong,'CITY');}
 s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE6_ASSIMILATE',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),[a.id]);const before=s.fear;s=eventChoose(s,a.id);s=drain(s);assert.equal(land(s,a.id).pieces.filter(p=>p.kind==='DAHAN').length,0);assert.equal(land(s,a.id).pieces.filter(p=>p.kind==='TOWN').length,1);assert.equal(s.fear,before);
});
test('Reprisal ignores Defend and Strife, deals three to Dahan, and causes no land damage',()=>{
 let s=eventGame(1,'CULTURAL_ASSIMILATION');const l=land(s,'A1');l.pieces=[];l.defend=99;makePiece(s,l,'TOWN').strife=1;makePiece(s,l,'DAHAN');makePiece(s,l,'DAHAN');const blight=l.blight;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE6_REPRISAL',null,['A'])];settle(s);s=eventChoose(s,'A1');const result=land(s,'A1');assert.equal(result.pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(result.pieces.find(p=>p.kind==='DAHAN')?.damage,1);assert.equal(result.blight,blight);assert.equal(result.pieces.find(p=>p.kind==='TOWN')?.strife,1);
});
test('Reckless offensive destroys one chosen building per Dahan irrespective of health before adding blight',()=>{
 let s=eventGame(1,'CULTURAL_ASSIMILATION');const l=land(s,'A1');l.pieces=[];l.invaderHealth=20;makePiece(s,l,'DAHAN');makePiece(s,l,'DAHAN');makePiece(s,l,'TOWN');makePiece(s,l,'CITY');makePiece(s,l,'CITY');const blight=l.blight,before=s.fear;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE6_OFFENSIVE',null,['A'])];settle(s);s=eventChoose(s,'A1');assert.equal(land(s,'A1').blight,blight);s=eventChoose(s,'도시');assert.equal(land(s,'A1').blight,blight);s=eventChoose(s,'도시');assert.equal(land(s,'A1').blight,blight+1);assert.deepEqual(land(s,'A1').pieces.filter(p=>p.kind!=='DAHAN').map(p=>p.kind),['TOWN']);assert.equal(s.fear,(before+4)%4);assert.equal(s.queue.length,0);
});
test('Terror event branch remains fixed after a later fear increase and resets at Time',()=>{
 let s=eventGame(1,'DISTANT_EXPLORATION');s=drain(eventChoose(s,'이벤트 선택 시작'));s.terror=2;assert.equal(view(s).eventTerrorLevel,1);assert.equal(view(s).eventDistantExplore,true);assert.equal(view(s).eventFearfulMobs,false);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventTerrorLevel,null);assert.equal(view(s).eventDistantExplore,false);assert.equal(view(s).eventFearfulMobs,false);
});
test('Terror event first-round discard applies no branch or persistent effects',()=>{
 const s=drain(eventGame(1,'DISTANT_EXPLORATION',1));assert.equal(s.eventTerrorLevel,null);assert.equal(view(s).eventDistantExplore,false);
});
for(const n of [2,3])for(const strife of [0,1])test(`Fearful Mobs uses ${n} current invaders and strife ${strife} does not cancel land bonus`,()=>{
 let s=eventGame(1,'DISTANT_EXPLORATION');s.queue=[];s.flags.push('event-fearful-mobs');const l=land(s,'A1');l.pieces=[];l.defend=strife?1:3;for(let i=0;i<n;i++)makePiece(s,l,'EXPLORER').strife=strife;const before=l.blight;s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,'A1').blight,before+(n===3?1:0));
});
test('Fearful Mobs counts current invaders rather than the count when event resolves',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-fearful-mobs');const l=land(s,'A1');l.pieces=[];l.defend=2;for(let i=0;i<3;i++)makePiece(s,l,'EXPLORER');l.pieces.pop();s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,'A1').blight,0);
});
test('Distant Exploration reaches distance two from a building, not three; core source range stays one',()=>{
 const s=eventGame();s.queue=[];const actor=s.players[0]!.playerId;for(const l of s.lands){l.pieces=[];l.coastal=false;l.adjacent=[];l.tokens.wilds=0;}
 const a=land(s,'A1'),b=land(s,'A2'),c=land(s,'A3'),d=land(s,'A4');a.adjacent=[b.id];b.adjacent=[a.id,c.id];c.adjacent=[b.id,d.id];d.adjacent=[c.id];makePiece(s,a,'TOWN');s.invaderDeck.unshift({stage:1,terrains:['JUNGLE'],coastal:false});s.queue=[step('SPECIAL',actor,null,0,'EXPLORE')];settle(s);assert.equal(c.pieces.length,0);
 s.flags.push('event-distant-explore');s.invaderDeck.unshift({stage:3,terrains:['SANDS','JUNGLE'],coastal:false});s.queue=[step('SPECIAL',actor,null,0,'EXPLORE')];settle(s);assert.equal(c.pieces.filter(p=>p.kind==='EXPLORER').length,1);assert.equal(d.pieces.length,0);
});
test('Distant Exploration reaches inland from coastal land but honors wilds, skips and terrain',()=>{
 const s=eventGame();s.queue=[];const actor=s.players[0]!.playerId;for(const l of s.lands){l.pieces=[];l.adjacent=[];l.coastal=false;l.tokens.wilds=0;}
 const coast=land(s,'A1'),wild=land(s,'A2'),skip=land(s,'A5'),reach=land(s,'A6');coast.coastal=true;for(const l of [wild,skip,reach]){l.adjacent=[coast.id];coast.adjacent.push(l.id);}wild.tokens.wilds=1;skip.skip=true;s.flags.push('event-distant-explore');s.invaderDeck.unshift({stage:3,terrains:['MOUNTAIN','WETLAND'],coastal:false});s.queue=[step('SPECIAL',actor,null,0,'EXPLORE')];settle(s);assert.equal(wild.tokens.wilds,0);assert.equal(wild.pieces.length,0);assert.equal(skip.pieces.length,0);assert.equal(reach.pieces.length,1);
});

function contactChoice(n:number,key:'MISSIONARIES'|'RISING_INTEREST',paid:boolean){let s=eventChoose(eventGame(n,key),'이벤트 선택 시작');if(!paid)return eventChoose(s,key==='MISSIONARIES'?'접촉을 지켜본다':'호기심을 내버려');for(const p of s.players)p.energy=4*n;s=eventChoose(s,'비용');while(view(s).eventPayment!.remaining>0)s=eventChoose(s,'에너지 1 지원 추가');return eventChoose(s,'모인 지원으로 비용 확정');}
for(const key of ['MISSIONARIES','RISING_INTEREST'] as const)for(const paid of [false,true])for(const n of [1,2,3,4])test(`Contact events: ${key}, ${paid?'paid':'free'}, ${n} spirits`,()=>{
 const s=drain(contactChoice(n,key,paid));parseSpiritState(s);assert.equal(s.queue.length,0);assert.equal(s.phase,'PLAYING');assert.ok(v.safeParse(SpiritPlayingProjectionSchema,view(s)).success);assert.equal(view(s).eventCityDamage,paid?(key==='MISSIONARIES'?3:1):0);assert.equal(view(s).eventTownDamage,paid&&key==='RISING_INTEREST'?1:0);if(key==='MISSIONARIES'&&!paid){assert.equal(s.eventDeck[2],key);assert.ok(!s.eventDiscard.includes(key));}
});
test('Missionary Sun discard pushes from a Dahan land and no-Sun discard replaces without healing',()=>{
 for(const sun of [false,true]){let s=eventGame(1,'MISSIONARIES');const actor=s.players[0]!.playerId,card=s.minor.find(id=>cardPower(s,id).elements.includes('SUN')===sun)!;s.minor=[card,...s.minor.filter(id=>id!==card)];for(const l of s.lands)l.pieces=[];const l=land(s,'A1');makePiece(s,l,'EXPLORER');makePiece(s,l,'DAHAN').damage=1;s.queue=[step('SPECIAL',actor,null,0,'BCE7_DISCARD',null,['A'])];settle(s);assert.ok(s.minorDiscard.includes(card));assert.equal(s.queue[0]?.key,sun?'BCE7_PUSH':'BCE7_CONVERT');if(sun){const o=choiceOptions(s)[0]!;assert.ok(o.landId&&l.adjacent.includes(o.landId));s=eventChoose(s,o.label);s=drain(s);assert.equal(land(s,'A1').pieces.filter(p=>p.kind==='EXPLORER').length,0);}else{s=drain(s);assert.equal(land(s,'A1').pieces.find(p=>p.kind==='TOWN')?.damage,1);}}
});
test('Missionary support is cancellable and each Spirit places disease on any city, including the same land',()=>{
 let s=eventChoose(eventGame(2,'MISSIONARIES'),'이벤트 선택 시작');const payer=s.queue[0]!.target??s.queue[0]!.actor;s.players.find(p=>p.playerId===payer)!.energy=8;const before=s.players.find(p=>p.playerId===payer)!.energy;s=eventChoose(s,'비용');s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'지원 취소');assert.equal(s.players.find(p=>p.playerId===payer)!.energy,before);assert.equal(view(s).eventCityDamage,0);
 s=contactChoice(2,'MISSIONARIES',true);const beforeDisease=land(s,'A2').tokens.disease;assert.equal(s.queue[0]?.target,s.players[0]!.playerId);s=eventChoose(s,'A2');assert.equal(s.queue[0]?.target,s.players[1]!.playerId);assert.equal(applySpiritAction(s,s.players[0]!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:choiceOptions(s)[0]!.id},now,s.transitionId).ok,false);s=eventChoose(s,'A2');s=drain(s);assert.equal(land(s,'A2').tokens.disease,beforeDisease+2);assert.equal(s.players[1]!.energy,0);assert.equal(view(s).eventCityDamage,3);assert.equal(s.eventDeck.includes('MISSIONARIES'),false);
});
test('Missionary city bonus stacks with Urban Development and survives an empty normal Ravage',()=>{
 let s=drain(contactChoice(1,'MISSIONARIES',true));s.flags.push('event-next-city');s.ravage=null;s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventCityDamage,5);const l=land(s,'A1');l.pieces=[];makePiece(s,l,'CITY');l.defend=6;s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').blight,1);assert.equal(view(s).eventCityDamage,0);
});
test('Rising Interest removes an unearned fear card, reveals the next terror level, and never resolves it',()=>{
 let s=eventChoose(eventGame(1,'RISING_INTEREST'),'이벤트 선택 시작');s.fearDeck=s.fearDeck.slice(-7);s.terror=1;const top=s.fearDeck[0]!;s.revealedFear=[top];s.players[0]!.energy=4;s=eventChoose(s,'비용');while(view(s).eventPayment!.remaining)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'모인 지원');assert.equal(s.terror,2);assert.ok(!s.fearDeck.includes(top));assert.ok(!s.fearEarned.includes(top));assert.ok(!s.fearDiscard.includes(top));assert.ok(!s.revealedFear.includes(top));
});
test('Rising Interest removing the last fear card wins after its main event',()=>{
 let s=eventChoose(eventGame(1,'RISING_INTEREST'),'이벤트 선택 시작');s.fearDeck=s.fearDeck.slice(-1);s.terror=3;s.players[0]!.energy=4;s=eventChoose(s,'비용');while(view(s).eventPayment!.remaining)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'모인 지원');assert.equal(s.result?.reason,'VICTORY');assert.equal(s.terror,4);assert.equal(s.queue.length,0);parseSpiritState(s);
});
test('Rising Interest leaves Prussia setup III in place and removes the next ordinary card',()=>{
 let s=setup();s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true,adversary:'PRUSSIA',level:6}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'}));assert.ok(s.protectedInvader);s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);s=drain(s);assert.equal(s.protectedInvader,null,'exploring the special card clears its protection');
 s=setup();s=apply(s,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',progression:false,blightCard:true,adversary:'PRUSSIA',level:2}});s=drain(apply(s,{kind:'SELECT_SPIRIT',spirit:'RIVER'}));while(s.invaderDeck[0]?.stage!==3)s.invaderDeck.shift();const early=structuredClone(s.invaderDeck[0]),next=structuredClone(s.invaderDeck[1]);s.round=2;s.stage='FAST';s.eventDeck=['RISING_INTEREST',...s.eventDeck.filter(k=>k!=='RISING_INTEREST')];s=apply(s,{kind:'READY',ready:true});s=eventChoose(s,'이벤트 선택 시작');s=eventChoose(s,'호기심');assert.deepEqual(s.invaderDeck[0],early);assert.ok(!s.invaderDeck.some(c=>JSON.stringify(c)===JSON.stringify(next)));assert.deepEqual(s.protectedInvader,early);assert.ok(!Object.hasOwn(view(s),'protectedInvader'));
});
test('Rising Interest only offers town-free lands, unblighted jungles and Dahan lands for wilds',()=>{
 const s=eventGame(1,'RISING_INTEREST'),actor=s.players[0]!.playerId;for(const key of ['BCE7_TOWN','BCE7_JUNGLE','BCE7_WILDS']){s.queue=[step('SPECIAL',actor,null,0,key,null,['A'])];settle(s);assert.ok(choiceOptions(s).length);for(const o of choiceOptions(s)){const l=land(s,o.landId);assert.ok(l.number>0);assert.equal(l.board,'A');if(key==='BCE7_TOWN')assert.ok(l.pieces.every(p=>p.kind!=='TOWN'));else if(key==='BCE7_JUNGLE'){assert.equal(l.terrain,'JUNGLE');assert.equal(l.blight,0);}else assert.ok(l.pieces.some(p=>p.kind==='DAHAN'));}}
});
test('One-to-one replacement carries lethal damage and creates destruction fear only for the destroyed replacement',()=>{
 let s=chosen();const l=land(s,'A1');l.pieces=[];makePiece(s,l,'CITY').damage=2;const before=s.fear;s.queue=[step('REPLACE',s.players[0]!.playerId,l.id,1,'DOWNGRADE',null,['CITY'])];settle(s);s=drain(s);assert.equal(land(s,'A1').pieces.length,0);assert.equal(s.fear,before+1);
});
test('Urbanization and Roots keep the old invader damage on the replacement',()=>{
 for(const kind of ['TOWN','EXPLORER'] as const){let s=eventGame();const l=land(s,'A5');l.pieces=[];l.eventHealthBonus=kind==='EXPLORER'?'EXPLORERS':null;makePiece(s,l,kind).damage=1;s.queue=[step('SPECIAL',s.players[0]!.playerId,kind==='TOWN'?l.id:null,1,kind==='TOWN'?'BCE2_UPGRADE':'BCE4_ROOTS',null,['A'])];settle(s);s=drain(s);assert.equal(land(s,'A5').pieces[0]?.damage,1);assert.equal(land(s,'A5').pieces[0]?.kind,kind==='TOWN'?'CITY':'TOWN');}
});

for(const teach of [false,true])for(const n of [1,2,3,4])test(`Farmers: ${teach?'teach':'spurn'}, ${n} spirits`,()=>{
 let s=eventChoose(eventGame(n,'FARMERS'),'이벤트 선택 시작');assert.equal(s.queue[0]?.key,'BCE8_CHOICE');assert.equal(choiceOptions(s).length,2);assert.equal(s.eventPayment,null);s=drain(eventChoose(s,teach?'농사를 가르친다':'요청을 거절'));parseSpiritState(s);assert.equal(s.queue.length,0);assert.equal(s.phase,'PLAYING');assert.equal(view(s).eventRavageToBuild,teach);assert.ok(s.lands.every(l=>l.eventBuildingHealthLoss===!teach));assert.ok(v.safeParse(SpiritPlayingProjectionSchema,view(s)).success);
});
test('Farmers first round is discarded without a choice, payment or conversion',()=>{
 const s=drain(eventGame(1,'FARMERS',1));assert.equal(view(s).eventRavageToBuild,false);assert.ok(s.lands.every(l=>!l.eventBuildingHealthLoss));assert.equal(s.eventPayment,null);
});
test('Farmers conversion survives an empty slot and Time, then builds without consuming pending damage',()=>{
 let s=drain(eventChoose(eventChoose(eventGame(1,'FARMERS'),'이벤트 선택 시작'),'농사를 가르친다'));s.flags.push('event-next-city','event-next-town','event-next-city-extra');s.ravage=null;s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventRavageToBuild,true);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(s.currentEvent,null);assert.equal(view(s).eventRavageToBuild,true);
 const l=land(s,'A1');l.pieces=[];makePiece(s,l,'CITY').strife=1;l.tokens.disease=1;s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').tokens.disease,0);assert.equal(land(s,'A1').pieces.length,1);assert.equal(land(s,'A1').pieces[0]?.strife,1);assert.equal(land(s,'A1').blight,0);assert.equal(view(s).eventRavageToBuild,false);assert.equal(view(s).eventCityDamage,3);assert.equal(view(s).eventTownDamage,1);assert.equal(s.stage,'BUILD');
 land(s,'A1').pieces[0]!.strife=0;land(s,'A1').defend=4;s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').blight,1);assert.equal(view(s).eventCityDamage,0);assert.equal(view(s).eventTownDamage,0);
});
test('Farmers converted card uses normal build source and skip rules instead of Ruin Ravage',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-next-build','ruin:A1');const a=land(s,'A1'),b=land(s,'A6');a.pieces=[];b.pieces=[];makePiece(s,a,'EXPLORER');s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.ok(land(s,'A1').pieces.some(p=>p.kind==='TOWN'));assert.equal(land(s,'A6').pieces.length,0);assert.equal(view(s).eventRavageToBuild,false);
 s.flags.push('event-next-build');land(s,'A1').skip=true;const before=land(s,'A1').pieces.length;s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').pieces.length,before);assert.equal(view(s).eventRavageToBuild,false);
});
test('Farmers conversion honors England adjacent buildings and does not consume Stricken disease as a Ravage',()=>{
 let s=eventGame();s.queue=[];s.settings.adversary='ENGLAND';s.settings.level=1;s.flags.push('event-next-build','event-stricken');for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A2'),'TOWN');makePiece(s,land(s,'A2'),'CITY');land(s,'A1').tokens.disease=0;land(s,'A6').tokens.disease=1;s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.stage='RAVAGE';s=drain(apply(s,{kind:'ADVANCE'}));assert.ok(land(s,'A1').pieces.some(p=>p.kind==='TOWN'));assert.equal(land(s,'A6').pieces.length,0);assert.equal(land(s,'A6').tokens.disease,1);
});
test('Farmers never converts an extra Ravage; it still waits for the normal card',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-next-build');const l=land(s,'A1');l.pieces=[];makePiece(s,l,'TOWN');s.queue=[step('SPECIAL',s.players[0]!.playerId,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,'A1').blight,1);assert.equal(view(s).eventRavageToBuild,true);assert.equal(land(s,'A1').pieces.length,1);
});
test('Farmers spurn health loss only affects buildings, stacks, kills damaged buildings and expires',()=>{
 let s=eventGame();s.queue=[];const l=land(s,'A1');l.pieces=[];const town=makePiece(s,l,'TOWN');town.damage=1;const city=makePiece(s,l,'CITY'),dahan=makePiece(s,l,'DAHAN'),explorer=makePiece(s,l,'EXPLORER');const before=s.fear;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE8_HEALTH')];settle(s);assert.ok(!l.pieces.some(p=>p.id===town.id));assert.equal(s.fear,before+1);assert.equal(health(l,city),2);assert.equal(health(l,dahan),2);assert.equal(health(l,explorer),1);l.eventHealthLoss=true;assert.equal(health(l,city),1);l.invaderHealth=1;l.eventHealthBonus='BUILDINGS';assert.equal(health(l,city),3);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').eventBuildingHealthLoss,false);
});
test('Farmers spurn uses distinct eligibility for Dahan damage and blight; teach needs only Dahan',()=>{
 const s=eventGame(),actor=s.players[0]!.playerId;for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A1'),'TOWN');makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A2'),'TOWN');makePiece(s,land(s,'A2'),'CITY');makePiece(s,land(s,'A3'),'DAHAN');
 for(const [key,ids] of [['BCE8_DAHAN',['A1']],['BCE8_BLIGHT',['A2']],['BCE8_TOWN',['A1','A3']]] as const){s.queue=[step('SPECIAL',actor,null,0,key,null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),ids);}
});
test('Farmers pending decision rejects another actor and stale revision without mutation',()=>{
 const s=eventChoose(eventGame(2,'FARMERS'),'이벤트 선택 시작'),e=s.queue[0]!,actor=e.target??e.actor,other=s.players.find(p=>p.playerId!==actor)!.playerId,option=choiceOptions(s)[0]!,before=JSON.stringify(s);assert.equal(applySpiritAction(s,other,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:'stale',optionId:option.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
});

for(const blighted of [false,true])for(const n of [1,2,3,4])test(`Farmland: ${blighted?'cash crops':'healthy'}, ${n} spirits`,()=>{
 let s=eventGame(n,'FARMLAND');s.blighted=blighted;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.eventIslandState,blighted?'BLIGHTED':'HEALTHY');assert.equal(s.flags.includes('event-farmland'),!blighted);assert.ok(s.flags.includes('event-canny'));assert.equal(s.queue.length,0);parseSpiritState(s);
});
test('Farmland first round does not enable exploration substitution or defense',()=>{const s=drain(eventGame(1,'FARMLAND',1));assert.equal(s.flags.includes('event-farmland'),false);assert.equal(s.flags.includes('event-canny'),false);});
test('Farmland selects one successful exploration per board and never replaces an existing explorer',()=>{
 let s=eventGame(2);s.queue=[];s.flags.push('event-farmland','event-recon');for(const l of s.lands){l.pieces=[];l.tokens.wilds=0;}const old=makePiece(s,land(s,'A1'),'EXPLORER');old.damage=1;old.strife=1;s.invaderDeck=[{stage:1,terrains:[],coastal:true}];s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);assert.equal(s.queue[0]?.key,'BCE9_EXPLORE');assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1','A2','A3']);assert.equal(land(s,'A2').pieces.length,0);s=eventChoose(s,'A2');assert.equal(s.queue[0]?.tags[0],'B1');s=eventChoose(s,'B3');assert.equal(land(s,'A2').pieces.filter(p=>p.kind==='TOWN').length,1);assert.equal(land(s,'A2').pieces.filter(p=>p.kind==='EXPLORER').length,1);assert.equal(land(s,'A1').pieces.find(p=>p.id===old.id)?.strife,1);assert.equal(land(s,'A1').pieces.find(p=>p.id===old.id)?.damage,1);assert.equal(land(s,'B3').pieces.filter(p=>p.kind==='TOWN').length,1);
 s.invaderDeck=[{stage:1,terrains:[],coastal:true}];s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);assert.equal(s.queue.length,0);assert.equal(land(s,'A2').pieces.filter(p=>p.kind==='TOWN').length,1);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(s.flags.some(f=>f.startsWith('event-farmland')),false);
});
test('Farmland excludes wilds, skipped lands and lands without an exploration source',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-farmland');for(const l of s.lands){l.pieces=[];l.tokens.wilds=0;}land(s,'A1').tokens.wilds=1;land(s,'A2').skip=true;s.invaderDeck=[{stage:1,terrains:[],coastal:true}];s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A3']);assert.equal(land(s,'A1').tokens.wilds,0);s=eventChoose(s,'A3');assert.equal(land(s,'A1').pieces.length,0);assert.equal(land(s,'A2').pieces.length,0);
 s.flags=s.flags.filter(f=>!f.startsWith('event-farmland-used'));for(const l of s.lands)l.pieces=[];s.invaderDeck=[{stage:1,terrains:['MOUNTAIN'],coastal:false}];land(s,'A1').skip=true;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);assert.equal(s.queue.length,0);assert.equal(s.flags.some(f=>f.startsWith('event-farmland-used')),false);assert.equal(land(s,'A6').pieces.length,0);
});
test('Cash crops resolves extra Ravage before this card grants Dahan defense and leaves normal effects pending',()=>{
 let s=eventGame(1,'FARMLAND');s.blighted=true;s.ravage=null;s.build=null;s.explore=null;s.flags.push('event-next-build','event-next-city');const l=land(s,'A1');l.pieces=[];makePiece(s,l,'TOWN');makePiece(s,l,'DAHAN');l.defend=0;l.tokens.beasts=0;s=eventChoose(s,'이벤트 선택 시작');s=eventChoose(s,'산');assert.equal(s.flags.includes('event-canny'),false);s=drain(eventChoose(s,'추가 파괴를 받아'));assert.equal(land(s,'A1').blight,1);assert.equal(land(s,'A1').pieces.filter(p=>p.kind==='DAHAN').length,0);assert.ok(s.flags.includes('event-canny'));assert.ok(s.flags.includes('event-next-build'));assert.ok(s.flags.includes('event-next-city'));
});
test('Cash crops excludes terrain shown in any invader slot, including immigration, and skips if all are shown',()=>{
 const s=eventGame();s.ravage={stage:1,terrains:['MOUNTAIN'],coastal:false};s.build={stage:1,terrains:['JUNGLE'],coastal:false};s.explore={stage:1,terrains:['SANDS'],coastal:false};s.immigration={stage:1,terrains:['WETLAND'],coastal:false};s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE9_TERRAIN')];settle(s);assert.equal(s.queue.length,0);s.immigration=null;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE9_TERRAIN')];settle(s);assert.equal(choiceOptions(s).length,1);assert.match(choiceOptions(s)[0]!.label,/습지/);
});
test('Cash crops presence protection can be planned and cancelled, then spends two from only the protected board',()=>{
 let s=eventGame(2);s.queue=[];const p=s.players[0]!,q=s.players[1]!;for(const owner of s.players){const total=s.lands.reduce((n,l)=>n+presence(l,owner.playerId),0);owner.destroyedPresence+=Math.max(0,total-2);owner.energyTrack+=Math.max(0,2-total);}for(const l of s.lands)l.presence=[];land(s,'A1').presence=[{playerId:p.playerId,count:1}];land(s,'A2').presence=[{playerId:q.playerId,count:1}];land(s,'B1').presence=[{playerId:p.playerId,count:1},{playerId:q.playerId,count:1}];s.queue=[step('SPECIAL',p.playerId,null,2,'BCE3_PROTECT',null,['A','RAVAGE','MOUNTAIN'])];settle(s);s=eventChoose(s,'현신 2개로');s=eventChoose(s,'A1');assert.equal(land(s,'A1').presence[0]?.count,1);s=eventChoose(s,'선택 취소');assert.equal(s.queue[0]?.used.length,0);s=eventChoose(s,'A1');s=eventChoose(s,'A2');s=eventChoose(s,'희생 확정');assert.equal(land(s,'A1').presence.reduce((n,p)=>n+p.count,0),0);assert.equal(land(s,'A2').presence.reduce((n,p)=>n+p.count,0),0);assert.equal(land(s,'B1').presence.reduce((n,p)=>n+p.count,0),2);assert.equal(s.queue.length,0);assert.equal(land(s,'A1').blight,0);
});
test('Farmland beasts require a town and no blight; exploration choice is actor and revision scoped',()=>{
 let s=eventGame(2);for(const l of s.lands){l.pieces=[];l.blight=0;}makePiece(s,land(s,'A1'),'TOWN');makePiece(s,land(s,'A2'),'TOWN');land(s,'A2').blight=1;s.blightTotal=s.blightPool+1;makePiece(s,land(s,'A3'),'CITY');const actor=s.players[0]!.playerId;s.queue=[step('SPECIAL',actor,null,0,'BCE9_BEAST',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1']);s=eventChoose(s,'A1');assert.ok(land(s,'A1').tokens.beasts>0);s.queue=[step('SPECIAL',actor,null,0,'BCE9_EXPLORE',null,['A1','A2'])];settle(s);const before=JSON.stringify(s),option=choiceOptions(s)[0]!;assert.equal(applySpiritAction(s,s.players[1]!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:'old',optionId:option.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
});

for(const terror of [1,2,3] as const)for(const n of [1,2,3,4])test(`Investigation: terror ${terror}, ${n} spirits`,()=>{
 let s=eventGame(n,'INVESTIGATION');s.terror=terror;s=drain(eventChoose(s,'이벤트 선택 시작'));assert.equal(s.eventTerrorLevel,terror);assert.equal(view(s).eventUnnatural,terror>=2);assert.equal(s.queue.length,0);parseSpiritState(s);
});
test('Investigation first round is skipped and early targets exclude any Dahan or Invader',()=>{
 const first=drain(eventGame(1,'INVESTIGATION',1));assert.equal(first.eventTerrorLevel,null);assert.equal(view(first).eventUnnatural,false);const s=eventGame();for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A2'),'EXPLORER');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE10_EXPLORE',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A3','A4','A5','A6','A7','A8']);
});
test('Unnatural damage follows current presence, applies to extra Ravage and expires at Time',()=>{
 let s=eventGame();s.queue=[];s.flags.push('event-unnatural');const p=s.players[0]!,l=land(s,'A1');l.pieces=[];makePiece(s,l,'EXPLORER');const home=s.lands.find(l=>presence(l,p.playerId)>0)!;if(home!==l){l.presence=home.presence;home.presence=[];}const backup=s.lands.find(a=>a!==l&&presence(a,p.playerId)===0)!;backup.presence.push({playerId:p.playerId,count:1});p.energyTrack++;l.defend=2;s.queue=[step('SPECIAL',p.playerId,l.id,0,'RAVAGE')];settle(s);s=drain(s);assert.equal(land(s,'A1').blight,1);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(view(s).eventUnnatural,false);
});
test('Unnatural does not harm Dahan when there are no Invaders',()=>{
 const s=eventGame();s.queue=[];s.flags.push('event-unnatural');const p=s.players[0]!,l=s.lands.find(l=>presence(l,p.playerId)>0)!;l.pieces=[];makePiece(s,l,'DAHAN');s.queue=[step('SPECIAL',p.playerId,l.id,0,'RAVAGE')];settle(s);assert.equal(l.pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(l.pieces[0]!.damage,0);
});
function rouseGame(){let s=eventGame(1,'INVESTIGATION');s.queue=[];const p=s.players[0]!;grantPower(s,'wash-away');const id=hold(s,'wash-away');const home=s.lands.find(l=>presence(l,p.playerId)>0)!;for(let i=0;i<3;i++)makePiece(s,home,'DAHAN');s.queue=[step('SPECIAL',p.playerId,null,0,'BCE10_ROUSE',p.playerId)];settle(s);return {s,id,home:home.id};}
test('Rouse uses one prepared Slow power now, preserves speed and leaves a granted repeat for Slow',()=>{
 let {s,id,home}=rouseGame();const p=s.players[0]!,before=p.energy;p.repeatGrants.push({id:'later',remaining:1,maxCost:9,paid:false,used:[]});s=eventChoose(s,'씻어내는 물결');assert.equal(s.queue[0]?.key,'BCE10_TARGET');s=drain(eventChoose(s,`→ ${home} · 기본`));assert.ok(s.players[0]!.resolved.includes(id));assert.equal(s.players[0]!.energy,before);assert.equal(s.players[0]!.repeatGrants[0]?.remaining,1);assert.equal(s.stage,'FEAR');assert.equal(s.flags.some(f=>f.startsWith('speed:')),false);assert.equal(powerOptions(s,p.playerId).length,0);s.stage='SLOW';assert.ok(powerOptions(s,p.playerId).some(o=>o.cardId===id&&o.repeat));
});
test('Rouse cannot normally reuse an already used power, but may spend one existing repeat grant',()=>{
 let {s,id,home}=rouseGame();s.players[0]!.resolved.push(id);assert.ok(!choiceOptions(s).some(o=>o.label.includes('씻어내는 물결')));s.players[0]!.repeatGrants.push({id:'repeat',remaining:2,maxCost:9,paid:true,used:[]});s.players[0]!.energy=2;s=eventChoose(s,'반복 권한');s=drain(eventChoose(s,`→ ${home} · 기본`));assert.equal(s.players[0]!.repeatGrants[0]!.remaining,1);assert.equal(s.players[0]!.energy,1);assert.equal(s.players[0]!.resolved.filter(c=>c===id).length,1);
});
test('Rouse ignores Fast powers and Slow cards whose speed was already changed to Fast',()=>{
 const {s,id}=rouseGame();grantPower(s,'lightning-s-boon');hold(s,'lightning-s-boon');s.flags.push(`speed:${s.players[0]!.playerId}:${id}:FAST`);assert.ok(!choiceOptions(s).some(o=>o.label.includes('씻어내는 물결')||o.label.includes('번개의 축복')));
});
test('Rouse cancellation preserves cards and energy and requires three Dahan across own lands',()=>{
 let {s,home}=rouseGame();const p=s.players[0]!,before=JSON.stringify(p);s=eventChoose(s,'씻어내는 물결');s=eventChoose(s,'능력 선택으로');assert.equal(JSON.stringify(s.players[0]),before);s=eventChoose(s,'즉시 사용 생략');assert.equal(JSON.stringify(s.players[0]),before);for(const l of s.lands)l.pieces=l.pieces.filter(p=>p.kind!=='DAHAN');makePiece(s,land(s,home),'DAHAN');makePiece(s,land(s,home),'DAHAN');const other=s.lands.find(l=>presence(l,p.playerId)===0)!;makePiece(s,other,'DAHAN');s.queue=[step('SPECIAL',p.playerId,null,0,'BCE10_ROUSE',p.playerId)];settle(s);assert.equal(s.queue.length,0);
});
test('Rouse validates actor and revision and never exposes an off-turn USE_POWER shortcut',()=>{
 const {s,id,home}=rouseGame(),actor=s.players[0]!.playerId,before=JSON.stringify(s),o=choiceOptions(s)[0]!;assert.equal(applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:'stale',optionId:o.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,actor,{kind:'USE_POWER',cardId:id,target:home,threshold:0,fast:false,repeat:false,shadowReach:false},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
});
test('Rouse allows a qualified Slow innate and validates its threshold and range',()=>{
 let s=chosen(1,'RIVER');s.stage='FEAR';const p=s.players[0]!,home=s.lands.find(l=>presence(l,p.playerId)>0)!;home.presence.find(x=>x.playerId===p.playerId)!.count++;p.energyTrack++;for(let i=0;i<3;i++)makePiece(s,home,'DAHAN');p.elements=Array.from({length:4},()=>['SUN','WATER','EARTH'] as const).flat();s.queue=[step('SPECIAL',p.playerId,null,0,'BCE10_ROUSE',p.playerId)];settle(s);s=eventChoose(s,'고유 능력 ·');assert.ok(choiceOptions(s).some(o=>o.label.includes('고유 1단계')));assert.ok(!choiceOptions(s).some(o=>o.label.includes('고유 0단계')));s=drain(eventChoose(s,`→ ${home.id} · 고유 1단계`));assert.ok(s.players[0]!.resolved.includes('innate'));s.stage='SLOW';assert.ok(!powerOptions(s,p.playerId).some(o=>o.cardId==='innate'));
});
test('Rouse hands the next opportunity to its owner and hides their private power choices',()=>{
 let s=eventGame(2);s.queue=[];for(const p of s.players){const home=s.lands.find(l=>presence(l,p.playerId)>0)!;for(let i=0;i<3;i++)makePiece(s,home,'DAHAN');}s.queue=s.players.map(p=>step('SPECIAL',p.playerId,null,0,'BCE10_ROUSE',p.playerId));settle(s);s=eventChoose(s,'즉시 사용 생략');const p=s.players[1]!,option=choiceOptions(s).at(-1)!;assert.equal(s.queue[0]?.target,p.playerId);const projected=view(s);assert.deepEqual(projected.pending?.options,[]);assert.equal(applySpiritAction(s,s.players[0]!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id},now,s.transitionId).ok,false);s=eventChoose(s,'즉시 사용 생략');assert.equal(s.queue.length,0);
});

function outpacedGame(n=1){let s=eventGame(n,'OUTPACED');for(const [i,p] of s.players.entries()){const id=grantPower(s,['wash-away','river-s-bounty','raging-storm','call-to-bloodshed'][i]!,i);p.hand=p.hand.filter(c=>c!==id);p.played.push(id);p.energy=8;}return eventChoose(s,'이벤트 선택 시작');}
for(const n of [1,2,3,4])test(`Outpaced discards Slow cards and resolves all subevents for ${n} spirits`,()=>{
 let s=outpacedGame(n);s=drain(s);assert.equal(s.queue.length,0);assert.ok(s.flags.includes('event-lingering-plagues'));parseSpiritState(s);
});
test('Outpaced permits discard-first ordering, grants printed cost plus one and removes its elements',()=>{
 let s=outpacedGame();s.queue=[];const p=s.players[0]!,first=p.played[0]!;grantPower(s,'river-s-bounty');const second=hold(s,'river-s-bounty');p.energy=1;s.queue=[step('SPECIAL',p.playerId,null,0,'BCE11_CARDS',p.playerId,[first,second])];settle(s);s=eventChoose(s,'씻어내는 물결');s=eventChoose(s,'버리기');assert.equal(s.players[0]!.energy,3);assert.ok(s.players[0]!.discard.includes(first));assert.ok(!s.players[0]!.played.includes(first));assert.equal(view(s).playerStates[0]!.elements.filter(x=>x==='EARTH').length,0);s=eventChoose(s,'강의 풍요');s=eventChoose(s,'에너지 3');assert.equal(s.players[0]!.energy,0);s=eventChoose(s,'지금 사용하지');assert.ok(s.players[0]!.played.includes(second));assert.ok(!s.players[0]!.resolved.includes(second));assert.equal(s.queue.length,0);
});
test('Outpaced payment is independent and unauthorized players cannot decide for its owner',()=>{
 let s=outpacedGame(2);const p=s.players[0]!;p.energy=0;s.players[1]!.energy=100;s=eventChoose(s,'처리하기');assert.ok(!choiceOptions(s).some(o=>o.label.includes('에너지 3')));const before=JSON.stringify(s),o=choiceOptions(s)[0]!;assert.equal(applySpiritAction(s,s.players[1]!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,p.playerId,{kind:'CHOOSE',choiceId:'stale',optionId:o.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);assert.deepEqual(view(s,1).pending?.options,[]);
});
test('Outpaced retained card uses the existing immediate Slow path and preserves later repeats',()=>{
 let s=outpacedGame();const p=s.players[0]!,id=p.played[0]!;s.queue=[step('SPECIAL',p.playerId,null,0,'BCE11_CARDS',p.playerId,[id])];p.repeatGrants.push({id:'later',remaining:1,maxCost:9,paid:false,used:[]});settle(s);s=eventChoose(s,'처리하기');s=eventChoose(s,'에너지 3');const target=choiceOptions(s).find(o=>o.label.includes('기본 효과'))!;assert.ok(target);s=drain(apply(s,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:target.id}));assert.ok(s.players[0]!.resolved.includes(id));assert.equal(s.players[0]!.repeatGrants[0]!.remaining,1);assert.equal(s.players[0]!.energy,5);assert.equal(s.stage,'FEAR');assert.equal(s.flags.some(f=>f.startsWith('speed:')),false);s.stage='SLOW';assert.ok(powerOptions(s,p.playerId).some(o=>o.cardId===id&&o.repeat));
});
test('Outpaced uses current speed, excludes hand and innate, and permits Sky conversion before paying',()=>{
 let s=outpacedGame();const p=s.players[0]!,id=p.played[0]!;grantPower(s,'lightning-s-boon');const fast=hold(s,'lightning-s-boon');p.elements=['FIRE','FIRE','FIRE','AIR','AIR'];s.flags.push(`sky:${p.playerId}`);s.queue=[step('SPECIAL',p.playerId,null,0,'BCE11_CARDS',p.playerId,[id,fast])];settle(s);assert.ok(!choiceOptions(s).some(o=>o.label.includes('고유')));assert.ok(!choiceOptions(s).some(o=>o.label==='번개의 축복 · 처리하기'));s=eventChoose(s,'빠르게 · 비용');assert.equal(s.queue.length,0);assert.equal(s.players[0]!.energy,8);assert.ok(s.players[0]!.played.includes(id));s.flags.push(`sky:${p.playerId}`);s.queue=[step('SPECIAL',p.playerId,null,0,'BCE11_CARDS',p.playerId,[fast])];settle(s);s=eventChoose(s,'느리게');s=eventChoose(s,'처리하기');s=eventChoose(s,'버리기');assert.ok(s.players[0]!.discard.includes(fast));assert.equal(s.players[0]!.energy,10);
});
test('Outpaced presence plan is reversible and atomically destroys exactly two of the owner presence',()=>{
 let s=outpacedGame(2);const p=s.players[0]!,id=p.played[0]!;const total=s.lands.reduce((n,l)=>n+presence(l,p.playerId),0);if(total<3){const l=s.lands.find(l=>presence(l,p.playerId)>0)!;l.presence.find(x=>x.playerId===p.playerId)!.count+=3-total;p.energyTrack+=3-total;}const before=s.lands.reduce((n,l)=>n+presence(l,p.playerId),0),other=s.lands.reduce((n,l)=>n+presence(l,s.players[1]!.playerId),0);s.queue=[step('SPECIAL',p.playerId,null,0,'BCE11_CARDS',p.playerId,[id])];settle(s);s=eventChoose(s,'처리하기');s=eventChoose(s,'내 현신 2개');s=eventChoose(s,'내 현신 선택');assert.equal(s.lands.reduce((n,l)=>n+presence(l,p.playerId),0),before);s=eventChoose(s,'선택 취소');assert.equal(s.queue[0]?.used.length,0);s=eventChoose(s,'내 현신 선택');s=eventChoose(s,'내 현신 선택');s=eventChoose(s,'희생 확정');assert.equal(s.lands.reduce((n,l)=>n+presence(l,p.playerId),0),before-2);assert.equal(s.lands.reduce((n,l)=>n+presence(l,s.players[1]!.playerId),0),other);assert.equal(s.players[0]!.energy,8);s=eventChoose(s,'지금 사용하지');assert.equal(s.queue.length,0);parseSpiritState(s);
});
test('Outpaced raids select distinct lands without requiring presence and allow zero buildings',()=>{
 let s=eventGame(2);s.queue=[];for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'B1'),'DAHAN');makePiece(s,land(s,'A2'),'DAHAN');makePiece(s,land(s,'A2'),'TOWN');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE11_RAID',s.players[0]!.playerId)];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1','B1']);makePiece(s,land(s,'A8'),'CITY');s=eventChoose(s,'B1');assert.equal(s.queue[0]?.target,s.players[1]!.playerId);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1']);s=eventChoose(s,'A1');assert.equal(s.queue.length,0);
});
test('Outpaced first round has no costs, plague flag or raid',()=>{const s=drain(eventGame(1,'OUTPACED',1));assert.equal(s.flags.includes('event-lingering-plagues'),false);assert.equal(s.eventPayment,null);});

function madnessGame(n=1){let s=eventChoose(eventGame(n,'MADNESS'),'이벤트 선택 시작');for(const p of s.players)p.energy=40;return s;}
for(const paid of [false,true])for(const n of [1,2,3,4])test(`Madness ${paid?'guided':'free'}, ${n} spirits resolves in order`,()=>{
 let s=madnessGame(n);s=eventChoose(s,paid?'광기를 이끈다':'내버려');if(paid){while(view(s).eventPayment!.remaining>0)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');}s=drain(s);assert.equal(s.queue.length,0);assert.equal(s.eventPayment,null);parseSpiritState(s);
});
test('Madness plans update per-beast cost, cancel without resources spent, and commit together',()=>{
 let s=madnessGame();for(const l of s.lands)l.tokens.beasts=0;land(s,'A1').tokens.beasts=3;s=eventChoose(s,'광기를 이끈다');assert.equal(view(s).eventPayment!.cost,9);s=eventChoose(s,'A1 야수 제거 계획 +1');assert.equal(view(s).eventPayment!.cost,6);assert.equal(land(s,'A1').tokens.beasts,3);s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'지원 취소 · 이벤트');assert.equal(s.players[0]!.energy,40);assert.equal(land(s,'A1').tokens.beasts,3);
 s=eventChoose(s,'광기를 이끈다');s=eventChoose(s,'A1 야수 제거 계획 +1');s=eventChoose(s,'A1 야수 제거 계획 취소');assert.equal(view(s).eventPayment!.cost,9);for(let i=0;i<3;i++)s=eventChoose(s,'A1 야수 제거 계획 +1');assert.equal(view(s).eventPayment!.cost,3);assert.ok(!choiceOptions(s).some(o=>o.label.includes('계획 +1')));for(let i=0;i<3;i++)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');assert.equal(land(s,'A1').tokens.beasts,0);assert.equal(s.players[0]!.energy,37);s=drain(s);parseSpiritState(s);
});
test('Madness validates plan quantities, cost, payer and revision without live mutation',()=>{
 let s=madnessGame(2);s=eventChoose(s,'광기를 이끈다');const actor=s.queue[0]!.target!,before=JSON.stringify(s),o=choiceOptions(s).find(o=>o.label.includes('계획 +1'))!;assert.equal(applySpiritAction(s,s.players.find(p=>p.playerId!==actor)!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:'stale',optionId:o.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
 const cost=structuredClone(s);cost.eventPayment!.cost++;assert.throws(()=>parseSpiritState(cost));const bad=structuredClone(s);bad.queue[0]!.used=['A0'];assert.throws(()=>parseSpiritState(bad));const excess=structuredClone(s),l=excess.lands.find(l=>l.tokens.beasts>0)!;excess.queue[0]!.used=Array(l.tokens.beasts+1).fill(l.id);assert.throws(()=>parseSpiritState(excess));
 s=eventChoose(s,'계획 +1');const used=[...s.queue[0]!.used];s=eventChoose(s,'다음 정령');assert.deepEqual(s.queue[0]!.used,used);assert.notEqual(s.queue[0]!.target,actor);parseSpiritState(s);
});
test('Madness destroys Dahan before removing beasts, then only remaining beasts attack',()=>{
 let s=madnessGame();for(const l of s.lands){l.tokens.beasts=0;l.pieces=[];}makePiece(s,land(s,'A8'),'CITY');const l=land(s,'A1');l.tokens.beasts=2;for(let i=0;i<3;i++)makePiece(s,l,'DAHAN');makePiece(s,l,'EXPLORER');makePiece(s,l,'TOWN');s=eventChoose(s,'내버려');assert.equal(s.queue[0]?.kind,'DESTROY');s=eventChoose(s,'다한');s=eventChoose(s,'다한');assert.equal(s.queue[0]?.key,'BCE12_REMOVE');assert.equal(land(s,'A1').pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(land(s,'A1').tokens.beasts,2);s=eventChoose(s,'야수 1 제거');assert.equal(land(s,'A1').tokens.beasts,1);s=drain(s);assert.equal(land(s,'A1').pieces.filter(p=>p.kind!=='DAHAN').length,0);assert.equal(land(s,'A1').tokens.beasts,1);assert.equal(s.lands.reduce((n,l)=>n+l.pieces.filter(p=>p.kind==='DAHAN').length,0),1);
});
test('Madness permits different spirits to push the same beast again before its attack',()=>{
 let s=madnessGame(2);for(const l of s.lands)l.tokens.beasts=0;land(s,'A1').tokens.beasts=1;s=eventChoose(s,'광기를 이끈다');for(let i=0;i<3;i++)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');const to=choiceOptions(s).find(o=>o.landId)!.landId!;s=eventChoose(s,`A1 야수 → ${to}`);assert.equal(s.queue[0]?.target,s.players[1]!.playerId);s=eventChoose(s,`${to} 야수 → A1`);s=drain(s);assert.equal(land(s,'A1').tokens.beasts,1);assert.equal(land(s,to).tokens.beasts,0);
});
test('Savage frenzy destroys explorers despite health bonuses and does not consume building-killing beasts',()=>{
 let s=madnessGame();for(const l of s.lands){l.tokens.beasts=0;l.pieces=[];}makePiece(s,land(s,'A8'),'CITY');const l=land(s,'A1');l.tokens.beasts=2;l.eventHealthBonus='EXPLORERS';makePiece(s,l,'EXPLORER');makePiece(s,l,'EXPLORER');makePiece(s,l,'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE12_FRENZY')];settle(s);s=eventChoose(s,'탐험가');s=eventChoose(s,'도시');s=eventChoose(s,'도시');s=eventChoose(s,'탐험가');s=drain(s);assert.equal(land(s,'A1').pieces.length,0);assert.equal(land(s,'A1').tokens.beasts,2);
});
for(const token of ['beasts','disease','wilds'] as const)test(`Safer home retreats from ${token} to a land without all three tokens`,()=>{
 let s=madnessGame(2);for(const l of s.lands){l.tokens={beasts:0,disease:0,wilds:0};l.pieces=l.pieces.filter(p=>p.kind!=='DAHAN');}const from=s.lands.find(l=>l.adjacent.some(id=>land(s,id).board!==l.board))!,to=land(s,from.adjacent.find(id=>land(s,id).board!==from.board)!);from.tokens[token]=1;makePiece(s,from,'DAHAN');makePiece(s,from,'DAHAN');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE2_RETREAT',null,[from.board,'TOKENS'])];settle(s);assert.ok(choiceOptions(s).every(o=>o.label.includes('다한 2개')));assert.ok(choiceOptions(s).some(o=>o.landId===to.id));to.tokens.wilds=1;assert.ok(!choiceOptions(s).some(o=>o.landId===to.id));to.tokens.wilds=0;s=eventChoose(s,`→ ${to.id}`);s=drain(s);assert.equal(land(s,to.id).pieces.filter(p=>p.kind==='DAHAN').length,2);assert.equal(land(s,from.id).pieces.filter(p=>p.kind==='DAHAN').length,0);
});
test('Madness first round is skipped and zero beasts still requires minimum support',()=>{
 const first=drain(eventGame(1,'MADNESS',1));assert.equal(first.eventPayment,null);let s=madnessGame();for(const l of s.lands)l.tokens.beasts=0;s=eventChoose(s,'광기를 이끈다');assert.equal(view(s).eventPayment!.cost,3);assert.ok(!choiceOptions(s).some(o=>o.label.includes('계획 +1')));
});
test('Madness animal card support and excess energy adapt to the revised removal plan',()=>{
 let s=madnessGame();for(const l of s.lands)l.tokens.beasts=0;land(s,'A1').tokens.beasts=3;const key=SPIRIT_POWERS.find(p=>p.deck==='MINOR'&&p.elements.includes('ANIMAL'))!.key,id=grantPower(s,key);s.players[0]!.elements=['ANIMAL'];s=eventChoose(s,'광기를 이끈다');s=eventChoose(s,`${cardPower(s,id).title} · 손패 버림`);assert.equal(view(s).eventPayment!.support,3);for(let i=0;i<6;i++)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'계획 +1');s=eventChoose(s,'계획 +1');assert.equal(view(s).eventPayment!.cost,3);s=eventChoose(s,'비용 확정');assert.equal(s.players[0]!.energy,40);assert.ok(s.players[0]!.discard.includes(id));assert.equal(land(s,'A1').tokens.beasts,1);s=drain(s);parseSpiritState(s);
});
test('Madness beast push preserves Fangs follow-presence interaction',()=>{
 let s=branchClaw('FANGS');const actor=s.players[0]!.playerId,from=s.lands.find(l=>presence(l,actor)>0&&l.tokens.beasts>0)!;s.queue=[step('SPECIAL',actor,null,0,'BCE12_PUSH',actor)];settle(s);const o=choiceOptions(s).find(o=>o.label.startsWith(from.id))!;assert.ok(o.landId);s=eventChoose(s,o.label);assert.equal(s.queue[0]?.key,'FOLLOW_DAHAN');s=drain(s);parseSpiritState(s);
});

function sacredGame(n=1){let s=eventChoose(eventGame(n,'SACRED_SITES'),'이벤트 선택 시작');for(const p of s.players)p.energy=30;return s;}
function sacredPresence(s:SpiritState,id:string,index:number,count=2){const l=land(s,id),p=s.players[index]!,old=presence(l,p.playerId);l.presence=l.presence.filter(x=>x.playerId!==p.playerId);l.presence.push({playerId:p.playerId,count});p.energyTrack+=count-old;}
for(const paid of [false,true])for(const n of [1,2,3,4])test(`Sacred sites ${paid?'guard':'repulse'} with ${n} spirits`,()=>{
 let s=sacredGame(n);s=eventChoose(s,paid?'직접 지킨다':'섬의 힘');if(paid){while(view(s).eventPayment!.remaining)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');}s=drain(s);assert.equal(s.queue.length,0);assert.equal(s.eventPayment,null);parseSpiritState(s);
});
test('Sacred guard charges once per land and plans sacrifice without consuming presence or energy',()=>{
 let s=sacredGame(2);sacredPresence(s,'A1',0);sacredPresence(s,'A1',1);sacredPresence(s,'A2',0);makePiece(s,land(s,'A1'),'TOWN');makePiece(s,land(s,'A2'),'TOWN');s=eventChoose(s,'직접 지킨다');const cost=view(s).eventPayment!.cost;assert.equal(s.queue[0]!.used.filter(id=>id==='A1').length,1);s=eventChoose(s,'A1 · 피해 2 계획');assert.equal(view(s).eventPayment!.cost,cost-3);assert.equal(presence(land(s,'A1'),s.players[0]!.playerId),2);s=eventChoose(s,'지원 취소 · 이벤트');assert.equal(presence(land(s,'A1'),s.players[1]!.playerId),2);assert.equal(s.players[0]!.energy,30);
 s=eventChoose(s,'직접 지킨다');s=eventChoose(s,'A1 · 피해 2 계획');while(view(s).eventPayment!.remaining)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');s=drain(s);assert.equal(presence(land(s,'A1'),s.players[0]!.playerId),1);assert.equal(presence(land(s,'A1'),s.players[1]!.playerId),1);assert.equal(presence(land(s,'A2'),s.players[0]!.playerId),2);parseSpiritState(s);
});
test('Sacred sacrifice includes a spirit with only one presence and zero damage plan costs zero',()=>{
 let s=sacredGame(2);for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');makePiece(s,land(s,'A1'),'EXPLORER');sacredPresence(s,'A1',0);sacredPresence(s,'A1',1,1);s=eventChoose(s,'직접 지킨다');assert.equal(view(s).eventPayment!.cost,3);s=eventChoose(s,'A1 · 피해 2 계획');assert.equal(view(s).eventPayment!.cost,0);s=eventChoose(s,'비용 확정');s=drain(s);assert.equal(presence(land(s,'A1'),s.players[0]!.playerId),1);assert.equal(presence(land(s,'A1'),s.players[1]!.playerId),0);assert.equal(s.players[0]!.energy,30);assert.equal(s.players[1]!.energy,30);
});
test('Sacred plan rejects duplicate or ineligible lands, wrong costs, actor and revision',()=>{
 let s=sacredGame(2);sacredPresence(s,'A1',0);makePiece(s,land(s,'A1'),'TOWN');s=eventChoose(s,'직접 지킨다');const actor=s.queue[0]!.target!,other=s.players.find(p=>p.playerId!==actor)!.playerId,o=choiceOptions(s).find(o=>o.label.startsWith('A1 ·'))!,before=JSON.stringify(s);assert.equal(applySpiritAction(s,other,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:'stale',optionId:o.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);
 for(const ids of [['A1','A1'],['A0']]){const bad=structuredClone(s);bad.queue[0]!.used=ids;bad.eventPayment!.cost=3*ids.length;assert.throws(()=>parseSpiritState(bad));}const bad=structuredClone(s);bad.eventPayment!.cost++;assert.throws(()=>parseSpiritState(bad));s=eventChoose(s,'다음 정령');assert.equal(s.queue[0]!.target,other);parseSpiritState(s);
});
test('Sacred repulse pushes once per spirit sacred site, preserves cities and removes supply after movement',()=>{
 let s=sacredGame(2);for(const l of s.lands)l.pieces=[];sacredPresence(s,'A1',0);sacredPresence(s,'A1',1);const l=land(s,'A1');makePiece(s,l,'CITY');makePiece(s,l,'TOWN');makePiece(s,l,'EXPLORER');const pool=s.blightPool,total=s.blightTotal;s=eventChoose(s,'섬의 힘');assert.equal(s.queue[0]!.kind,'MOVE');assert.equal(s.blightPool,pool);assert.ok(choiceOptions(s).every(o=>!o.label.includes('도시')));const away=choiceOptions(s).find(o=>o.landId&&o.landId!=='A1')!;s=eventChoose(s,away.label);assert.equal(s.blightPool,pool);s=drain(s);assert.equal(land(s,'A1').pieces.filter(p=>p.kind==='CITY').length,1);assert.equal(land(s,'A1').pieces.length,1);assert.equal(s.blightPool,pool-2);assert.equal(s.blightTotal,total-2);
});
test('Sacred supply removal flips a healthy card and continues remaining removal on the new side',()=>{
 let s=sacredGame(2);s.blightCard='SPIRAL';s.blighted=false;s.blightPool=1;s.blightTotal=1+s.lands.reduce((n,l)=>n+l.blight,0);s.queue=[step('SPECIAL',s.players[0]!.playerId,null,2,'BCE13_POOL'),step('CHECK',s.players[0]!.playerId)];settle(s);assert.equal(s.blighted,true);assert.equal(s.blightPool,9);assert.equal(s.phase,'PLAYING');parseSpiritState(s);
});
for(const card of [null,'SPIRAL'] as const)test(`Sacred exhausted ${card??'no card'} supply ends in defeat`,()=>{
 let s=sacredGame();s.blightCard=card;s.blighted=card!==null;s.blightPool=1;s.blightTotal=1+s.lands.reduce((n,l)=>n+l.blight,0);s=drain(eventChoose(s,'섬의 힘'));assert.equal(s.phase,'FINISHED');assert.equal(s.blightPool,0);parseSpiritState(s);
});
test('Spirit speakers gain a minor only with four Dahan across own presence lands',()=>{
 let s=sacredGame(2);for(const l of s.lands)l.pieces=l.pieces.filter(p=>p.kind!=='DAHAN');const p=s.players[0]!,q=s.players[1]!,home=s.lands.find(l=>presence(l,p.playerId)>0)!,other=s.lands.find(l=>presence(l,q.playerId)>0&&presence(l,p.playerId)===0)!;for(let i=0;i<4;i++)makePiece(s,home,'DAHAN');for(let i=0;i<3;i++)makePiece(s,other,'DAHAN');const hands=s.players.map(p=>p.hand.length);s.queue=[step('SPECIAL',p.playerId,null,0,'BCE13_DAHAN')];settle(s);assert.equal(s.offered.length,4);s=drain(s);assert.equal(s.players[0]!.hand.length,hands[0]!+1);assert.equal(s.players[1]!.hand.length,hands[1]);parseSpiritState(s);
});
test('Sacred first round preserves blight supply and skips payment',()=>{const before=eventGame(1,'SACRED_SITES',1),pool=before.blightPool,s=drain(before);assert.equal(s.blightPool,pool);assert.equal(s.eventPayment,null);});

function warGame(n=1){let s=eventChoose(eventGame(n,'WAR'),'이벤트 선택 시작');for(const p of s.players)p.energy=20;return s;}
for(const paid of [false,true])for(const n of [1,2,3,4])test(`War event ${paid?'repel':'allow'} for ${n} spirits`,()=>{
 let s=warGame(n);s=eventChoose(s,paid?'격퇴':'공격을 허용');if(paid){while(view(s).eventPayment!.remaining)s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');}s=drain(s);assert.equal(s.queue.length,0);assert.equal(s.eventPayment,null);parseSpiritState(s);
});
test('War payment allows only energy, supports cancellation and rejects forged card support',()=>{
 let s=warGame(2);for(const p of s.players)p.elements=['FIRE','WATER','SUN','MOON'];s=eventChoose(s,'격퇴');assert.equal(view(s).eventPayment!.element,null);assert.equal(view(s).eventPayment!.support,0);assert.equal(view(s).eventPayment!.cost,2);assert.ok(!choiceOptions(s).some(o=>o.label.includes('망각')||o.label.includes('손패 버림')));const before=s.players.map(p=>p.energy);s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'지원 취소 · 이벤트');assert.deepEqual(s.players.map(p=>p.energy),before);s=eventChoose(s,'격퇴');const bad=structuredClone(s);bad.eventPayment!.pledges[0]!.cards=[{cardId:bad.players[0]!.hand[0]!,mode:'FORGET'}];assert.throws(()=>parseSpiritState(bad));const cost=structuredClone(s);cost.eventPayment!.cost=8;assert.throws(()=>parseSpiritState(cost));
 const actor=s.queue[0]!.target!,other=s.players.find(p=>p.playerId!==actor)!.playerId,o=choiceOptions(s)[0]!,saved=JSON.stringify(s);assert.equal(applySpiritAction(s,other,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:'stale',optionId:o.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),saved);
});
test('War adds a random unused fear card face-down using the injected shuffle, without earning it',()=>{
 let s=warGame(2);for(const l of s.lands)l.tokens.beasts=0;s=eventChoose(s,'격퇴');s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'다음 정령');s=eventChoose(s,'에너지 1 지원 추가');const unused=spiritFearKeys(s.settings.expansion).filter(k=>![...s.fearDeck,...s.fearEarned,...s.fearDiscard].includes(k)),before=s.fearDeck.length,earned=[...s.fearEarned],actor=s.queue[0]!.target!,option=choiceOptions(s).find(o=>o.label.includes('비용 확정'))!;let calls=0;const result=applySpiritAction(s,actor,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:option.id},now,v.parse(TurnIdSchema,`turn-${++seq}`),values=>{calls++;return [...values].reverse();});assert.ok(result.ok);s=result.state;assert.equal(calls,1);assert.equal(s.fearDeck[0],unused.at(-1));assert.equal(s.fearDeck.length,before+1);assert.deepEqual(s.fearEarned,earned);assert.ok(!s.revealedFear.includes(s.fearDeck[0]!));assert.equal(s.players.reduce((n,p)=>n+p.energy,0),38);assert.equal(view(s).revealedFear.length,0);parseSpiritState(s);
});
for(const terror of [1,2,3] as const)test(`War addition preserves terror ${terror} and delays the next fear threshold`,()=>{
 let s=warGame();for(const l of s.lands)l.tokens.beasts=0;s.terror=terror;s.fearDeck=s.fearDeck.slice(-(terror===1?7:terror===2?4:1));const before=s.fearDeck.length;s=eventChoose(s,'격퇴');s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');assert.equal(s.terror,terror);assert.equal(s.fearDeck.length,before+1);s=drain(s);s.queue=[step('FEAR',s.players[0]!.playerId,null,4)];settle(s);assert.equal(s.terror,terror);assert.equal(s.fearDeck.length,before);
});
test('War does not duplicate fear cards when every card is already in use',()=>{
 let s=warGame();for(const l of s.lands)l.tokens.beasts=0;s.fearDeck=spiritFearKeys(s.settings.expansion);s=eventChoose(s,'격퇴');s=eventChoose(s,'에너지 1 지원 추가');s=eventChoose(s,'비용 확정');assert.equal(s.fearDeck.length,22);assert.equal(new Set(s.fearDeck).size,22);assert.ok(s.log.some(e=>e.text.includes('미사용 공포 카드 없음')));
});
test('War discards a major per board, with public cost, before choosing that board coast',()=>{
 let s=warGame(2);const major=[...s.major],minor=[...s.minor];s=eventChoose(s,'공격을 허용');assert.equal(s.queue[0]!.key,'BCE14_ATTACK');assert.equal(s.queue[0]!.tags[0],'A');assert.equal(s.queue[0]!.n,cardPower(s,major[0]!).cost);assert.ok(s.majorDiscard.includes(major[0]!));assert.deepEqual(s.minor,minor);s=drain(s);assert.ok(s.log.some(e=>e.text.includes(`B 전쟁 피해 판정 · ${cardPower(s,major[1]!).title}`)));assert.deepEqual(s.minor,minor);
});
test('War coastal attack excludes inland and empty lands and permits tied building maxima',()=>{
 const s=warGame();for(const l of s.lands)l.pieces=[];for(const id of ['A1','A2']){makePiece(s,land(s,id),'TOWN');makePiece(s,land(s,id),'CITY');}for(let i=0;i<5;i++)makePiece(s,land(s,'A8'),'CITY');makePiece(s,land(s,'A3'),'EXPLORER');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,3,'BCE14_ATTACK',null,['A'])];settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1','A2']);
});
for(const defend of [0,2,3,5])test(`War damage 3 with defense ${defend} affects invaders and land, never Dahan`,()=>{
 let s=warGame();for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');const l=land(s,'A1');l.defend=defend;makePiece(s,l,'CITY');makePiece(s,l,'DAHAN');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,3,'BCE14_ATTACK',null,['A'])];settle(s);s=drain(eventChoose(s,'A1'));assert.equal(land(s,'A1').blight,defend===0?1:0);assert.equal(land(s,'A1').pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(land(s,'A1').pieces.find(p=>p.kind==='DAHAN')!.damage,0);assert.equal(land(s,'A1').pieces.find(p=>p.kind==='CITY')?.damage,defend===0?undefined:Math.max(0,3-defend));
});
test('War beast movement requires an unblighted destination and grants fear only on arrival at invaders',()=>{
 let s=warGame();for(const l of s.lands){l.tokens.beasts=0;l.blight=0;l.pieces=[];}const from=land(s,'A1'),to=land(s,from.adjacent[0]!);from.tokens.beasts=1;to.blight=1;s.blightTotal=s.blightPool+1;makePiece(s,to,'EXPLORER');makePiece(s,land(s,'A8'),'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE14_BEAST',null,['A'])];settle(s);assert.ok(!choiceOptions(s).some(o=>o.landId===to.id));to.blight=0;s.blightTotal=s.blightPool;const fear=s.fear;s=eventChoose(s,`→ ${to.id}`);assert.equal(land(s,to.id).tokens.beasts,1);assert.equal(s.fear,fear+1);
});
test('War Dahan reclaim movement is optional and deals damage in the destination',()=>{
 let s=warGame();for(const l of s.lands)l.pieces=[];const from=land(s,'A1'),to=land(s,from.adjacent[0]!);makePiece(s,from,'DAHAN');makePiece(s,to,'TOWN');makePiece(s,land(s,'A8'),'CITY');s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'BCE14_DAHAN',s.players[0]!.playerId)];settle(s);assert.ok(choiceOptions(s).some(o=>o.label.includes('생략')));s=drain(eventChoose(s,`A1 다한 → ${to.id}`));assert.equal(land(s,'A1').pieces.length,0);assert.equal(land(s,to.id).pieces.filter(p=>p.kind==='DAHAN').length,1);assert.equal(land(s,to.id).pieces.find(p=>p.kind==='TOWN')!.damage,1);
});
test('War first round does not discard a major or add a fear card',()=>{const s=eventGame(1,'WAR',1),major=[...s.major],fear=[...s.fearDeck],done=drain(s);assert.deepEqual(done.major,major);assert.deepEqual(done.fearDeck,fear);});
test('War partial land damage never accumulates and Earth sacred defense applies',()=>{
 let s=chosen(1,'EARTH');s.stage='FEAR';for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');const home=s.lands.find(l=>l.coastal&&presence(l,s.players[0]!.playerId)>=2)??land(s,'A1');sacredPresence(s,home.id,0);makePiece(s,home,'CITY');const actor=s.players[0]!.playerId;for(let i=0;i<2;i++){s.queue=[step('SPECIAL',actor,null,4,'BCE14_ATTACK',null,[home.board])];settle(s);assert.ok(choiceOptions(s).some(o=>o.label.includes('피해 1')));s=drain(eventChoose(s,home.id));}assert.equal(land(s,home.id).blight,0);assert.equal(land(s,home.id).pieces.find(p=>p.kind==='CITY')!.damage,2);parseSpiritState(s);
});
test('War still discards a major when the board has no coastal buildings',()=>{
 let s=warGame();for(const l of s.lands){if(l.coastal)l.pieces=[];l.tokens.beasts=0;}const top=s.major[0]!;s=eventChoose(s,'공격을 허용');assert.ok(s.majorDiscard.includes(top));assert.ok(!s.queue.some(e=>e.key==='BCE14_ATTACK'));s=drain(s);parseSpiritState(s);
});

function branchFearGame(key:string,level:1|2|3,n=1){const s=eventGame(n);s.queue=[];s.stage='FEAR';s.terror=level;s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'FEAR_CARD',null,[key])];return s;}
for(const key of SPIRIT_BRANCH_FEAR_KEYS)for(const level of [1,2,3] as const)for(const n of [1,2,3,4])test(`Branch fear ${key}, terror ${level}, ${n} spirits`,()=>{
 let s=branchFearGame(key,level,n);settle(s);s=drain(s);assert.equal(s.queue.length,0);assert.ok(s.fearDiscard.includes(key));assert.ok(s.log.some(l=>l.text.includes(`공포 수준 ${level}`)));parseSpiritState(s);
});
test('Expansion fear pool adds only completed cards and keeps deck size and core pool unchanged',()=>{
 assert.deepEqual(spiritFearKeys('CORE'),[...SPIRIT_FEAR_KEYS]);assert.equal(spiritFearKeys('BRANCH_CLAW').length,22);assert.equal(new Set(spiritFearKeys('BRANCH_CLAW')).size,22);let s=setup();const result=applySpiritAction(s,s.players[0]!.playerId,{kind:'CONFIGURE',settings:{...s.settings,expansion:'BRANCH_CLAW',blightCard:true,progression:false}},now,s.transitionId,values=>[...values].reverse());assert.ok(result.ok);s=result.state;assert.equal(s.fearDeck.length,9);for(const key of SPIRIT_BRANCH_FEAR_KEYS)assert.ok(s.fearDeck.includes(key));assert.equal(chosen().fearDeck.some(k=>SPIRIT_BRANCH_FEAR_KEYS.includes(k)),false);
});
test('Demoralized stacks defense and Time removes it',()=>{
 let s=branchFearGame('demoralized',3);land(s,'A1').defend=2;settle(s);assert.equal(land(s,'A1').defend,5);assert.equal(land(s,'A8').defend,3);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.ok(s.lands.every(l=>l.defend===0));
});
test('Departure selects only coastal destinations, permits declining and does not require presence',()=>{
 let s=branchFearGame('departure',3);for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');const to=land(s,'A1'),from=land(s,to.adjacent.find(id=>!land(s,id).coastal)!);makePiece(s,from,'TOWN');makePiece(s,from,'EXPLORER');settle(s);assert.ok(choiceOptions(s).filter(o=>o.landId).every(o=>land(s,o.landId).coastal));assert.ok(choiceOptions(s).some(o=>o.label.includes('생략')));s=eventChoose(s,'A1 해안');s=drain(s);assert.equal(land(s,'A1').pieces.length,2);assert.equal(land(s,'A1').defend,4);assert.equal(land(s,from.id).pieces.length,0);
});
test('Pestilent level one removal is mandatory, disease-scoped and generates no destruction fear',()=>{
 let s=branchFearGame('pestilent',1);for(const l of s.lands){l.tokens.disease=0;l.pieces=[];}land(s,'A1').tokens.disease=1;makePiece(s,land(s,'A1'),'TOWN');makePiece(s,land(s,'A2'),'TOWN');makePiece(s,land(s,'A8'),'CITY');const before=s.fear;settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1']);s=drain(eventChoose(s,'A1'));assert.equal(land(s,'A1').pieces.length,0);assert.equal(land(s,'A2').pieces.length,1);assert.equal(s.fear,before);
});
test('Pestilent offers health and inland alternatives without broadening either condition',()=>{
 const s=branchFearGame('pestilent',2);for(const l of s.lands){l.tokens.disease=0;l.pieces=[];}land(s,'A1').tokens.disease=1;makePiece(s,land(s,'A1'),'CITY');makePiece(s,land(s,'A2'),'EXPLORER');makePiece(s,land(s,'A4'),'EXPLORER');makePiece(s,land(s,'A5'),'TOWN');settle(s);const options=choiceOptions(s);assert.ok(options.some(o=>o.landId==='A1'&&o.label.includes('체력')));assert.ok(options.some(o=>o.landId==='A4'&&o.label.includes('탐험가')));assert.ok(!options.some(o=>o.landId==='A2'||o.landId==='A5'));
});
test('Pestilent health budget uses modified full health, not remaining health after damage',()=>{
 let s=branchFearGame('pestilent',2);for(const l of s.lands){l.tokens.disease=0;l.pieces=[];}const l=land(s,'A1');l.tokens.disease=1;const first=makePiece(s,l,'TOWN');first.damage=1;makePiece(s,l,'TOWN');makePiece(s,land(s,'A8'),'CITY');settle(s);s=eventChoose(s,'체력 합계 최대 3');s=eventChoose(s,'마을 제거');assert.equal(s.queue[0]!.n,1);assert.ok(!choiceOptions(s).some(o=>o.label.includes('마을 제거')));s=drain(s);assert.equal(land(s,'A1').pieces.length,1);
 const t=branchFearGame('pestilent',2);for(const l of t.lands){l.tokens.disease=0;l.pieces=[];}const a=land(t,'A1');a.tokens.disease=1;a.invaderHealth=1;makePiece(t,a,'CITY');settle(t);assert.ok(!choiceOptions(t).some(o=>o.landId==='A1'));
});
for(const condition of ['beasts','disease','dahan'] as const)test(`Dangerous land eligibility uses ${condition}`,()=>{
 let s=branchFearGame('dangerous',2);for(const l of s.lands){l.tokens.beasts=0;l.tokens.disease=0;l.pieces=[];}const a=land(s,'A1');if(condition==='dahan'){makePiece(s,a,'DAHAN');makePiece(s,a,'DAHAN');}else a.tokens[condition]=1;makePiece(s,a,'TOWN');makePiece(s,land(s,'A2'),'TOWN');makePiece(s,land(s,'A8'),'CITY');settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1']);s=drain(s);assert.ok(!land(s,'A1').pieces.some(p=>p.kind==='TOWN'));
});
test('Dangerous level three permits zero removal and excludes wilds and one Dahan alone',()=>{
 const s=branchFearGame('dangerous',3);for(const l of s.lands){l.tokens.beasts=0;l.tokens.disease=0;l.pieces=[];}land(s,'A1').tokens.wilds=1;makePiece(s,land(s,'A1'),'TOWN');makePiece(s,land(s,'A2'),'DAHAN');makePiece(s,land(s,'A2'),'CITY');settle(s);assert.equal(choiceOptions(s).length,1);assert.match(choiceOptions(s)[0]!.label,/생략/);
});
test('Branch fear choices enforce actor and revision and hide other player options',()=>{
 let s=branchFearGame('dangerous',3,2);land(s,'A1').tokens.beasts=1;makePiece(s,land(s,'A1'),'TOWN');settle(s);assert.match(view(s).pending!.title,/위험한 땅을 떠나다 · 공포 3/);const o=choiceOptions(s)[0]!,before=JSON.stringify(s);assert.equal(applySpiritAction(s,s.players[1]!.playerId,{kind:'CHOOSE',choiceId:`${s.transitionId}:${s.revision}`,optionId:o.id},now,s.transitionId).ok,false);assert.equal(applySpiritAction(s,s.players[0]!.playerId,{kind:'CHOOSE',choiceId:'stale',optionId:o.id},now,s.transitionId).ok,false);assert.equal(JSON.stringify(s),before);assert.deepEqual(view(s,1).pending?.options,[]);s=eventChoose(s,'선택 생략');assert.equal(s.queue[0]!.target,s.players[1]!.playerId);
});
test('Revealed expansion fear projects all three effects without exposing hidden deck cards',()=>{
 const s=branchFearGame('departure',2);s.queue=[];s.fearDeck=['pestilent','dangerous'];s.revealedFear=['pestilent'];const g=view(s);assert.equal(g.revealedFear.length,1);assert.equal(g.revealedFear[0]!.name,SPIRIT_BRANCH_FEAR.pestilent.name);assert.deepEqual(g.revealedFear[0]!.effects,[...SPIRIT_BRANCH_FEAR.pestilent.effects]);assert.ok(!JSON.stringify(g.revealedFear).includes(SPIRIT_BRANCH_FEAR.dangerous.name));assert.ok(v.safeParse(SpiritPlayingProjectionSchema,g).success);
});

for(const level of [2,3] as const)test(`Monsters level ${level} removes each kind in one beast land without destruction fear`,()=>{
 let s=branchFearGame('monsters',level);for(const l of s.lands){l.tokens.beasts=0;l.pieces=[];}const a=land(s,'A1');a.tokens.beasts=1;for(let i=0;i<3;i++){makePiece(s,a,'EXPLORER');makePiece(s,a,'TOWN');}makePiece(s,a,'DAHAN');makePiece(s,land(s,'A8'),'CITY');const fear=s.fear;settle(s);assert.equal(choiceOptions(s).length,1);s=eventChoose(s,'야수 지역');assert.ok(!choiceOptions(s).some(o=>o.label.includes('생략')));s=drain(s);assert.equal(countPieces(land(s,'A1'),['EXPLORER']),level===2?2:1);assert.equal(countPieces(land(s,'A1'),['TOWN']),level===2?2:1);assert.equal(countPieces(land(s,'A1'),['DAHAN']),1);assert.equal(s.fear,fear);parseSpiritState(s);
});
for(const level of [1,2,3] as const)test(`Monsters level ${level} restricts adjacent alternatives by piece kind`,()=>{
 const s=branchFearGame('monsters',level);for(const l of s.lands){l.tokens.beasts=0;l.pieces=[];}const a=land(s,'A1'),adj=land(s,a.adjacent.find(id=>land(s,id).number>0)!);a.tokens.beasts=1;makePiece(s,a,'CITY');makePiece(s,adj,'TOWN');makePiece(s,land(s,'A8'),'CITY');settle(s);assert.ok(!choiceOptions(s).some(o=>o.landId===a.id));assert.equal(choiceOptions(s).some(o=>o.landId===adj.id),level===3);
});
test('Monsters partial removal does not substitute explorers for missing towns and permits reusing land',()=>{
 let s=branchFearGame('monsters',3,2);for(const l of s.lands){l.tokens.beasts=0;l.pieces=[];}land(s,'A1').tokens.beasts=1;for(let i=0;i<5;i++)makePiece(s,land(s,'A1'),'EXPLORER');makePiece(s,land(s,'A8'),'CITY');settle(s);s=eventChoose(s,'야수 지역');s=eventChoose(s,'탐험가 제거');s=eventChoose(s,'탐험가 제거');assert.equal(countPieces(land(s,'A1'),['EXPLORER']),3);assert.equal(s.queue[0]!.target,s.players[1]!.playerId);assert.ok(choiceOptions(s).some(o=>o.landId==='A1'));s=drain(s);assert.equal(countPieces(land(s,'A1'),['EXPLORER']),1);parseSpiritState(s);
});

function attackFear(level:1|2|3,n=1){const s=branchFearGame('attack',level,n);for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');return s;}
test('Dahan Attack I requires Dahan and removes an explorer without fear',()=>{
 let s=attackFear(1);makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A1'),'EXPLORER');makePiece(s,land(s,'A2'),'EXPLORER');const fear=s.fear;settle(s);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A1']);s=drain(s);assert.equal(countPieces(land(s,'A1'),['EXPLORER']),0);assert.equal(countPieces(land(s,'A2'),['EXPLORER']),1);assert.equal(s.fear,fear);parseSpiritState(s);
});
test('Dahan Attack II allows peaceful lands but prevents repeated choices within the card',()=>{
 let s=attackFear(2,2);makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A2'),'DAHAN');settle(s);s=eventChoose(s,'A1');assert.equal(s.queue[0]!.target,s.players[1]!.playerId);assert.deepEqual(choiceOptions(s).map(o=>o.landId),['A2']);s=drain(s);s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'FEAR_CARD',null,['attack'])];settle(s);assert.ok(choiceOptions(s).some(o=>o.landId==='A1'));
});
test('Dahan Attack II deals one damage per Dahan and generates destruction fear',()=>{
 let s=attackFear(2);makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A1'),'TOWN');const fear=s.fear;settle(s);s=drain(eventChoose(s,'A1'));assert.equal(countPieces(land(s,'A1'),['TOWN']),0);assert.equal(countPieces(land(s,'A1'),['DAHAN']),2);assert.equal(s.fear,fear+1);parseSpiritState(s);
});
test('Dahan Attack III requires gathering one Dahan and counts it after arrival',()=>{
 let s=attackFear(3);const a=land(s,'A1'),from=land(s,a.adjacent.find(id=>land(s,id).number>0)!);makePiece(s,a,'DAHAN');makePiece(s,a,'CITY');makePiece(s,from,'DAHAN');const fear=s.fear;settle(s);s=eventChoose(s,'A1');assert.equal(s.queue[0]!.kind,'MOVE');assert.ok(!choiceOptions(s).some(o=>o.label.includes('생략')));s=eventChoose(s,`→ A1`);assert.equal(s.queue[0]!.kind,'DAMAGE');assert.equal(s.queue[0]!.n,4);s=drain(s);assert.equal(countPieces(land(s,'A1'),['CITY']),0);assert.equal(countPieces(land(s,'A1'),['DAHAN']),2);assert.equal(s.fear,fear+2);parseSpiritState(s);
});
test('Dahan Attack III continues with existing Dahan when gathering is impossible',()=>{
 let s=attackFear(3);makePiece(s,land(s,'A1'),'DAHAN');makePiece(s,land(s,'A1'),'CITY');makePiece(s,land(s,'A2'),'EXPLORER');settle(s);assert.ok(!choiceOptions(s).some(o=>o.landId==='A2'));s=eventChoose(s,'A1');assert.equal(s.queue[0]!.kind,'DAMAGE');assert.equal(s.queue[0]!.n,2);s=drain(s);assert.equal(land(s,'A1').pieces.find(p=>p.kind==='CITY')!.damage,2);parseSpiritState(s);
});
test('Dahan Attack III resolves Thunder presence follow before damage',()=>{
 let s=chosen(1,'THUNDER');s.stage='FEAR';s.terror=3;for(const l of s.lands)l.pieces=[];const a=land(s,'A1'),from=land(s,a.adjacent.find(id=>land(s,id).number>0)!);makePiece(s,land(s,'A8'),'CITY');makePiece(s,a,'CITY');makePiece(s,from,'DAHAN');sacredPresence(s,from.id,0,1);const before=presence(a,s.players[0]!.playerId);s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'FEAR_CARD',null,['attack'])];settle(s);s=eventChoose(s,'A1');s=eventChoose(s,'→ A1');assert.equal(s.queue[0]!.key,'FOLLOW_DAHAN');s=eventChoose(s,'현신 → A1');assert.equal(presence(land(s,'A1'),s.players[0]!.playerId),before+1);assert.equal(s.queue[0]!.kind,'DAMAGE');assert.equal(s.queue[0]!.n,2);s=drain(s);parseSpiritState(s);
});

for(const level of [1,2,3] as const)test(`Tread Carefully ${level} sums adjacent Dahan and permits skipping`,()=>{
 const s=branchFearGame('careful',level);for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');const a=land(s,'A1'),near=a.adjacent.filter(id=>land(s,id).number>0),need=level===1?5:level===2?3:1;for(let i=0;i<need-1;i++)makePiece(s,land(s,near[i%near.length]!),'DAHAN');settle(s);assert.ok(!choiceOptions(s).some(o=>o.landId==='A1'));makePiece(s,land(s,near[0]!),'DAHAN');assert.ok(choiceOptions(s).some(o=>o.landId==='A1'));assert.ok(choiceOptions(s).some(o=>o.label.includes('생략')&&!o.landId));
});
test('Tread Carefully remains on the chosen land after Dahan leave and blocks all ravages without consuming strife',()=>{
 let s=branchFearGame('careful',1);for(const l of s.lands)l.pieces=[];makePiece(s,land(s,'A8'),'CITY');const a=land(s,'A1');makePiece(s,a,'DAHAN');makePiece(s,a,'TOWN').strife=1;settle(s);s=eventChoose(s,'A1');land(s,'A1').pieces=land(s,'A1').pieces.filter(p=>p.kind!=='DAHAN');const before=JSON.stringify(land(s,'A1'));for(let i=0;i<2;i++){s.queue=[step('SPECIAL',s.players[0]!.playerId,'A1',0,'RAVAGE')];settle(s);assert.equal(JSON.stringify(land(s,'A1')),before);}assert.equal(view(s).lands.find(l=>l.id==='A1')!.ravageSkip,true);s.stage='TIME';s=drain(apply(s,{kind:'ADVANCE'}));assert.equal(land(s,'A1').ravageSkip,false);parseSpiritState(s);
});
test('Tread Carefully does not block building or exploring',()=>{
 let s=branchFearGame('careful',3);const a=land(s,'A1');makePiece(s,a,'DAHAN');settle(s);s=eventChoose(s,'A1');const buildings=countPieces(land(s,'A1'),['TOWN','CITY']);s.queue=[step('SPECIAL',s.players[0]!.playerId,'A1',0,'ESCALATE_BUILD')];settle(s);s=drain(s);assert.equal(countPieces(land(s,'A1'),['TOWN','CITY']),buildings+1);assert.equal(land(s,'A1').skip,false);const explorers=countPieces(land(s,'A1'),['EXPLORER']);land(s,'A1').tokens.wilds=0;s.invaderDeck.unshift({stage:1,terrains:[land(s,'A1').terrain],coastal:false});s.queue=[step('SPECIAL',s.players[0]!.playerId,null,0,'EXPLORE')];settle(s);s=drain(s);assert.equal(countPieces(land(s,'A1'),['EXPLORER']),explorers+1);parseSpiritState(s);
});
