import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, SPIRITS, SPIRIT_POWERS, SpiritPlayingProjectionSchema, spiritProjectionIsConsistent, type SpiritAction, type SpiritId } from '@hangul-rummikub/shared';
import { createSpiritGame, applySpiritAction, parseSpiritState, powerOptions, type SpiritState } from './games/spirit-island/domain/game.js';
import { projectSpirit } from './games/spirit-island/compatibility/projector.js';
import { choiceOptions, settle, SPIRIT_FEAR_KEYS } from './games/spirit-island/domain/resolver.js';
import { powerSteps } from './games/spirit-island/domain/powers.js';
import { step, makePiece, land, defense, presence, innateLevel, cardPower } from './games/spirit-island/domain/primitives.js';
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
