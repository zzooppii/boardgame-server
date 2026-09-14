import * as v from 'valibot';
import { GameRevisionSchema, PERCH_LOCATIONS, PERCH_LOCATION_INFO, PERCH_OBJECTIVES, PERCH_OBJECTIVE_INFO, PERCH_CREATURE_INFO, PERCH_FLOCK_NAMES, perchFountainCells, perchAdjacent, perchStrength, perchController, perchRanks, PerchActionSchema, type PerchAction, type PerchBird, type PerchTile, type PerchCreature, type PerchChoice, type PerchLog, type PerchObjective, type PlayerId, type TileId, type GameId, type TurnId, type ServerTime, type PerchLocation } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import { parsePerchState, type PerchState, type PerchTask } from './state.js';
export { parsePerchState, type PerchState } from './state.js';
type Choice = PerchChoice & {
    path?: TileId[];
    targetBirdId?: TileId;
    flock?: number;
    skip?: boolean;
};
const DEFAULT_SETTINGS = { randomBoard: false, objectives: true };
function shuffled<T>(xs: readonly T[], random: RandomSource): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) {
    const j = random.nextInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
} return a; }
function task(kind: PerchTask['kind'], actor: PlayerId, extra: Partial<Omit<PerchTask, 'kind' | 'actor'>> = {}): PerchTask { return { kind, actor, tiles: [], birdId: null, creature: null, flock: null, ...extra }; }
function log(s: PerchState, text: string, sound: PerchLog['sound'] = 'NONE', tileId: TileId | null = null) { s.sequence++; s.history.push({ id: s.sequence, text, sound, tileId }); s.history = s.history.slice(-100); }
export function activePerchPlayer(s: PerchState) { const p = s.players.find(p => p.playerId === s.turnOrder[s.activeIndex]); if (!p)
    throw new Error('Missing Perch active player.'); return p; }
function player(s: PerchState, id: PlayerId) { const p = s.players.find(p => p.playerId === id); if (!p)
    throw new Error('Missing Perch player.'); return p; }
function tile(s: PerchState, id: TileId) { const t = s.board.find(t => t.tileId === id); if (!t)
    throw new Error('Missing Perch tile.'); return t; }
function location(s: PerchState, id: PerchLocation) { return s.board.find(t => t.definitionId === id && !t.removed); }
function total(t: PerchTile) { return t.stacks.reduce((n, st) => n + perchStrength(st), 0); }
function owner(s: PerchState, t: PerchTile | undefined) { return t ? s.players.find(p => p.flock === perchController(t)) : undefined; }
function add(_s: PerchState, t: PerchTile, bird: PerchBird, nest: number | null = null) { let st = t.stacks.find(st => st.flock === bird.flock); if (st?.house || t.removed)
    throw new Error('Protected Perch destination.'); if (!st) {
    st = { flock: bird.flock, birds: [], nest: null, house: false };
    t.stacks.push(st);
} st.birds.push(bird); if (nest !== null)
    st.nest = nest; }
function canAdd(t: PerchTile, flock: number) { return !t.removed && !t.stacks.some(st => st.flock === flock && st.house); }
function remove(t: PerchTile, id: TileId): PerchBird { const st = t.stacks.find(st => st.birds.some(b => b.birdId === id)); if (!st || st.house)
    throw new Error('Protected or absent Perch bird.'); const i = st.birds.findIndex(b => b.birdId === id), b = st.birds.splice(i, 1)[0]!; if (!st.birds.length)
    t.stacks = t.stacks.filter(x => x !== st); return b; }
function birdLabel(b: PerchBird) { return `${PERCH_FLOCK_NAMES[b.flock]} 새`; }
function tileLabel(s: PerchState, id: TileId) { return PERCH_LOCATION_INFO[tile(s, id).definitionId].name; }
function exposed(t: PerchTile) { return t.stacks.filter(st => !st.house).flatMap(st => st.birds.slice(0, 1)); }
function send(s: PerchState, t: PerchTile, id: TileId, actor: PlayerId, fromLocation = false) { const b = remove(t, id); if (fromLocation && b.flock >= s.players.length) {
    s.supply[b.flock]!.push(b);
    return;
} s.pool.push(b); const chooser = s.players.find(p => p.flock === b.flock)?.playerId ?? actor; s.queue.unshift(task('FOUNTAIN', chooser, { birdId: b.birdId })); log(s, `${birdLabel(b)}가 분수로 날아갑니다.`, 'WING', t.tileId); }
function takeSupply(s: PerchState, flock: number, n: number) { return s.supply[flock]!.splice(0, n); }
function sortedBoard(s: PerchState) { return [...s.board].filter(t => !t.removed).sort((a, b) => a.col - b.col || a.row - b.row); }
function directions() { return [[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]] as const; }
function neighbors(s: PerchState, t: PerchTile) { return s.board.filter(b => perchAdjacent(t, b)); }
export function perchEdgeTiles(s: Pick<PerchState, 'board'>): PerchTile[] { return s.board.filter(t => !t.removed && directions().some(([dx, dy]) => !s.board.some(b => !b.removed && b.col === t.col + dx && b.row === t.row + dy))); }
function perimeter(s: PerchState) { const edge = perchEdgeTiles(s), cx = edge.reduce((n, t) => n + t.col, 0) / edge.length, cy = edge.reduce((n, t) => n + t.row, 0) / edge.length; return edge.sort((a, b) => Math.atan2(a.row - cy, (a.col - cx) * 1.7) - Math.atan2(b.row - cy, (b.col - cx) * 1.7)); }
function intersections(s: PerchState): TileId[][] { const ts = sortedBoard(s), out: TileId[][] = []; for (let i = 0; i < ts.length; i++)
    for (let j = i + 1; j < ts.length; j++)
        for (let k = j + 1; k < ts.length; k++) {
            const a = ts[i]!, b = ts[j]!, c = ts[k]!;
            if (perchAdjacent(a, b) && perchAdjacent(b, c) && perchAdjacent(a, c))
                out.push([a.tileId, b.tileId, c.tileId]);
        } return out; }
function sameSet(a: readonly TileId[], b: readonly TileId[]) { return a.length === b.length && a.every(id => b.includes(id)); }
export function makePerchBirds(generate: () => TileId, flocks: number): PerchBird[] { return Array.from({ length: flocks }, (_, flock) => Array.from({ length: 28 }, () => ({ birdId: generate(), flock }))).flat(); }
function buildBoard(count: number, random: RandomSource, id: () => TileId, randomBoard: boolean): PerchTile[] {
    let defs: PerchLocation[];
    if (randomBoard) {
        const sizes = count <= 3 ? [3, 2, 3] : count === 4 ? [4, 2, 4] : [5, 3, 5];
        defs = (['BASIC', 'SPECIAL', 'CREATURE'] as const).flatMap((kind, i) => shuffled(PERCH_LOCATIONS.filter(d => PERCH_LOCATION_INFO[d].kind === kind), random).slice(0, sizes[i]));
        defs = shuffled(defs, random);
    }
    else {
        defs = ['PINE', 'ASH', 'DOGHOUSE', 'COTTAGE', 'HANGING', 'EARLY', 'ELM', 'HAWK_NEST'];
        if (count >= 4)
            defs.push('OAK', 'CORN');
        if (count === 5)
            defs.push('BIRCH', 'BIRDBATH', 'DEN');
    }
    const lengths = count <= 3 ? [3, 2, 3] : count === 4 ? [2, 3, 2, 3] : [3, 2, 3, 2, 3];
    let n = 0;
    const board = lengths.flatMap((length, col) => Array.from({ length }, (_, r) => { const definitionId = defs[n++]!; return { tileId: id(), definitionId, col, row: r * 2 + (length === 2 ? 1 : 0), removed: false, nests: Array.from({ length: PERCH_LOCATION_INFO[definitionId].nests }, () => true), stacks: [] }; }));
    const barn = board.find(t => t.definitionId === 'BARN');
    if (barn && !perchEdgeTiles({ board }).some(t => t === barn)) {
        const peer = board.find(t => t.col === barn.col && t.row === Math.min(...board.filter(t => t.col === barn.col).map(t => t.row)))!;
        [barn.definitionId, peer.definitionId] = [peer.definitionId, barn.definitionId];
        barn.nests = Array.from({ length: PERCH_LOCATION_INFO[barn.definitionId].nests }, () => true);
        peer.nests = Array.from({ length: PERCH_LOCATION_INFO[peer.definitionId].nests }, () => true);
    }
    return board;
}
export function createPerchGame(input: {
    gameId: GameId;
    playerIds: readonly PlayerId[];
    now: ServerTime;
    turnId: TurnId;
    random: RandomSource;
    generateTileId: () => TileId;
}): PerchState {
    const { playerIds, random } = input;
    if (playerIds.length < 2 || playerIds.length > 5 || new Set(playerIds).size !== playerIds.length)
        throw new Error('Perch needs 2–5 players.');
    const flocks = Math.max(3, playerIds.length), birds = makePerchBirds(input.generateTileId, flocks);
    return parsePerchState({ rulesVersion: 'perch-base-v1', gameId: input.gameId, revision: 0, transitionId: input.turnId, startedAt: input.now, finishedAt: null, phase: 'SETUP', settings: { ...DEFAULT_SETTINGS }, players: playerIds.map((playerId, flock) => ({ playerId, flock, score: 0, hand: [], objective: null, objectiveChoices: [], house: false, lightning: false })), supply: Array.from({ length: flocks }, (_, f) => birds.filter(b => b.flock === f)), bag: [], pool: [], board: buildBoard(playerIds.length, random, input.generateTileId, false), creatures: [], fountain: perchFountainCells(playerIds.length).map(() => null), plaza: [], round: 1, turnOrder: [...playerIds], activeIndex: 0, placed: false, bonusUsed: false, queue: [], roundScores: [], history: [], sequence: 0, scoreTrack: [...playerIds], result: null });
}
function creaturePaths(s: PerchState, kind: PerchCreature): TileId[][] {
    const c = s.creatures.find(c => c.creature === kind);
    if (!c?.tileId)
        return [];
    const from = tile(s, c.tileId), near = neighbors(s, from);
    if (kind === 'HAWK')
        return sortedBoard(s).filter(t => t !== from).map(t => [t.tileId]);
    if (kind === 'BEE')
        return sortedBoard(s).filter(t => t !== from && !near.includes(t)).map(t => [t.tileId]);
    if (kind === 'FOX')
        return near.flatMap(t => neighbors(s, t).filter(b => b !== from).map(b => [t.tileId, b.tileId]));
    if (kind === 'OWL') {
        const edge = perimeter(s), i = edge.findIndex(t => t === from);
        if (i < 0)
            return [];
        return [1, 2, 3, 4].filter(n => n < edge.length).map(n => Array.from({ length: n }, (_, j) => edge[(i + j + 1) % edge.length]!.tileId));
    }
    if (kind === 'CAT') {
        const max = Math.max(...near.map(total));
        return near.filter(t => total(t) === max).map(t => [t.tileId]);
    }
    if (kind === 'SQUIRREL') {
        const home = location(s, 'BENCH');
        return near.filter(t => home && (t === home || perchAdjacent(t, home))).map(t => [t.tileId]);
    }
    return near.map(t => [t.tileId]);
}
function swapPossible(_s: PerchState, source: PerchTile, b: PerchBird, target: PerchTile, other: PerchBird) { return source !== target && canAdd(target, b.flock) && canAdd(source, other.flock); }
function candidateChoices(s: PerchState, t: PerchTask): Choice[] {
    const make = (label: string, tiles: TileId[] = [], birdId: TileId | null = null, slot: number | null = null, extra: Partial<Choice> = {}): Choice => ({ id: '', label, tileIds: tiles, birdId, slot, ...extra });
    const birdChoices = (ts: PerchTile[], filter: (b: PerchBird, tile: PerchTile) => boolean = () => true) => ts.flatMap(loc => exposed(loc).filter(b => filter(b, loc)).map(b => make(`${PERCH_LOCATION_INFO[loc.definitionId].name} · ${birdLabel(b)}`, [loc.tileId], b.birdId)));
    const source = t.tiles[0] ? tile(s, t.tiles[0]) : undefined;
    let choices: Choice[] = [];
    switch (t.kind) {
        case 'FOUNTAIN':
            choices = perchFountainCells(s.players.length).filter(c => !s.fountain[c.id] && c.supports.every(id => s.fountain[id])).map(c => make(`${c.level + 1}층 · ${c.points}점 · 자리 ${c.id + 1}`, [], t.birdId, c.id));
            break;
        case 'ROOKERY_ADD':
            choices = [make('주머니에 내 새 1마리 추가'), make('추가하지 않기', [], null, null, { skip: true })];
            break;
        case 'SEND_OWN':
            choices = birdChoices(source ? [source] : [], b => b.flock === player(s, t.actor).flock);
            break;
        case 'BATH_RETURN':
            choices = s.pool.map(b => make(`${birdLabel(b)}를 주머니로 돌려놓기`, [], b.birdId));
            break;
        case 'FEEDER_FIRST':
            choices = player(s, t.actor).hand.map(b => make(`${birdLabel(b)} 내보내기`, [], b.birdId));
            break;
        case 'FEEDER_SECOND':
            choices = s.players.filter(p => p.playerId !== t.actor).flatMap(p => p.hand.map(b => make(`${PERCH_FLOCK_NAMES[p.flock]} 플레이어의 ${birdLabel(b)} 받기`, [], b.birdId)));
            break;
        case 'CREATURE_MOVE':
            choices = t.creature ? creaturePaths(s, t.creature).map(path => make(path.map(id => tileLabel(s, id)).join(' → '), path, null, null, { path })) : [];
            break;
        case 'EFFECT_CONFIRM':
            choices = [make('동물의 효과 사용'), make('이동만 하고 효과 생략', [], null, null, { skip: true })];
            break;
        case 'SEND':
            choices = birdChoices(t.tiles.map(id => tile(s, id)).filter(loc => !loc.removed));
            break;
        case 'MOVE_FROM':
            choices = birdChoices(source ? [source] : [], (b, loc) => directions().some(([dx, dy]) => { const dest = s.board.find(x => !x.removed && x.col === loc.col + dx && x.row === loc.row + dy); return dest ? canAdd(dest, b.flock) : t.creature === 'DOG'; }));
            break;
        case 'MOVE_TO':
            if (source) {
                const b = source.stacks.flatMap(st => st.birds).find(b => b.birdId === t.birdId);
                if (b) {
                    choices = neighbors(s, source).filter(dest => canAdd(dest, b.flock)).map(dest => make(`${PERCH_LOCATION_INFO[dest.definitionId].name}로 이동`, [dest.tileId], b.birdId));
                    if (t.creature === 'DOG' && directions().some(([dx, dy]) => !s.board.some(x => !x.removed && x.col === source.col + dx && x.row === source.row + dy)))
                        choices.push(make('보드 밖으로 밀어 분수로 보내기', [], b.birdId));
                }
            }
            break;
        case 'SWAP_FROM':
            choices = birdChoices(source ? [source] : [], (b, loc) => sortedBoard(s).some(dest => exposed(dest).some(other => swapPossible(s, loc, b, dest, other))));
            break;
        case 'SWAP_TO':
            if (source) {
                const b = source.stacks.flatMap(st => st.birds).find(b => b.birdId === t.birdId);
                if (b)
                    choices = birdChoices(sortedBoard(s), (other, dest) => swapPossible(s, source, b, dest, other));
            }
            break;
        case 'SQUIRREL':
            if (source)
                choices = exposed(source).flatMap(b => s.fountain.flatMap((f, i) => f && canAdd(source, f.flock) ? [make(`${birdLabel(b)} ↔ 분수 ${i + 1}번의 ${birdLabel(f)}`, [source.tileId], b.birdId, i)] : []));
            break;
        case 'BEE':
            if (source)
                choices = birdChoices(sortedBoard(s), (b, loc) => loc !== source && source.stacks.some(st => st.flock === b.flock) && canAdd(source, b.flock));
            break;
        case 'SCARECROW_HOME': {
            const c = s.creatures.find(c => c.creature === 'SCARECROW');
            choices = intersections(s).filter(xs => !sameSet(xs, c?.intersection ?? [])).map(xs => make(xs.map(id => tileLabel(s, id)).join(' · '), xs));
            break;
        }
        default: break;
    }
    return choices.map((c, i) => ({ ...c, id: `choice-${i}` }));
}
const TITLES: Partial<Record<PerchTask['kind'], string>> = { FOUNTAIN: '내 새가 앉을 분수 자리를 선택하세요', ROOKERY_ADD: '주머니에 새를 추가할까요?', SEND_OWN: '분수로 보낼 내 새를 선택하세요', BATH_RETURN: '뽑은 새 중 돌려놓을 1마리를 선택하세요', FEEDER_FIRST: '모이통 · 교환할 내 모집 새를 선택하세요', FEEDER_SECOND: '모이통 · 받을 상대 모집 새를 선택하세요', CREATURE_MOVE: '동물이 이동할 경로를 선택하세요', EFFECT_CONFIRM: '동물의 효과를 사용할까요?', SEND: '분수로 보낼 새를 선택하세요', MOVE_FROM: '이동시킬 새를 선택하세요', MOVE_TO: '새의 이동 목적지를 선택하세요', SWAP_FROM: '교환할 첫 번째 새를 선택하세요', SWAP_TO: '교환할 두 번째 새를 선택하세요', SQUIRREL: '장소와 분수 사이에서 교환할 새를 선택하세요', BEE: '벌이 데려올 같은 색 새를 선택하세요', SCARECROW_HOME: '허수아비를 놓을 교차점을 선택하세요' };
export function perchPending(s: PerchState, viewer: PlayerId) { const t = s.queue[0]; if (!t)
    return null; return { actor: t.actor, title: TITLES[t.kind] ?? '다음 단계 준비', kind: t.kind, choices: t.actor === viewer ? candidateChoices(s, t).map(({ id, label, tileIds, birdId, slot }) => ({ id, label, tileIds, birdId, slot })) : [] }; }
function addScore(s: PerchState, id: PlayerId, points: number, source: string, round = true) { if (round)
    s.roundScores.push({ playerId: id, points, source }); const p = player(s, id); if (points > 0) {
    p.score += points;
    s.scoreTrack = s.scoreTrack.filter(x => x !== id);
    s.scoreTrack.push(id);
} }
function beginRecruitRest(s: PerchState, random: RandomSource, skip: PlayerId | null) { s.bag = shuffled(s.bag, random); for (const id of s.turnOrder)
    if (id !== skip)
        player(s, id).hand.push(...s.bag.splice(0, 2)); const feeder = location(s, 'FEEDER'), controller = owner(s, feeder); if (controller)
    s.queue.push(task('FEEDER_FIRST', controller.playerId)); s.queue.push(task('PERCH_BEGIN', activePerchPlayer(s).playerId)); }
function effectTasks(_s: PerchState, t: PerchTask): PerchTask[] {
    const base = { creature: t.creature, tiles: t.tiles };
    if (!t.creature)
        return [];
    const dest = t.tiles.at(-1);
    if (!dest && t.creature !== 'SCARECROW')
        return [];
    switch (t.creature) {
        case 'BEE': return [task('BEE', t.actor, { ...base, tiles: [dest!] })];
        case 'CAT': return [task('SEND', t.actor, { ...base, tiles: [dest!] }), task('MOVE_FROM', t.actor, { ...base, tiles: [dest!] })];
        case 'DOG': return [task('MOVE_FROM', t.actor, { ...base, tiles: [dest!] })];
        case 'CUCKOO': return [task('SWAP_FROM', t.actor, { ...base, tiles: [dest!] })];
        case 'SQUIRREL': return [task('SQUIRREL', t.actor, { ...base, tiles: [dest!] })];
        case 'FOX': return t.tiles.map(id => task('SEND', t.actor, { ...base, tiles: [id] }));
        case 'HAWK':
        case 'OWL': return [task('SEND', t.actor, base)];
        case 'SCARECROW': return [task('SEND', t.actor, { ...base, flock: 1 })];
    }
}
function resolveChoice(s: PerchState, t: PerchTask, c: Choice, random: RandomSource) {
    const source = t.tiles[0] ? tile(s, t.tiles[0]) : undefined;
    switch (t.kind) {
        case 'FOUNTAIN': {
            const i = s.pool.findIndex(b => b.birdId === t.birdId);
            if (i < 0 || c.slot === null)
                throw new Error('Missing fountain bird.');
            s.fountain[c.slot] = s.pool.splice(i, 1)[0]!;
            log(s, `${birdLabel(s.fountain[c.slot]!)}가 분수 ${c.slot + 1}번 자리에 앉았습니다.`, 'WATER');
            break;
        }
        case 'ROOKERY_ADD':
            if (!c.skip)
                s.bag.push(...takeSupply(s, player(s, t.actor).flock, 1));
            break;
        case 'SEND_OWN':
            if (source && c.birdId)
                send(s, source, c.birdId, t.actor, true);
            break;
        case 'BATH_RETURN': {
            const i = s.pool.findIndex(b => b.birdId === c.birdId);
            s.bag.push(...s.pool.splice(i, 1));
            player(s, t.actor).hand.push(...s.pool.splice(0));
            beginRecruitRest(s, random, t.actor);
            break;
        }
        case 'FEEDER_FIRST':
            s.queue.unshift(task('FEEDER_SECOND', t.actor, { birdId: c.birdId }));
            break;
        case 'FEEDER_SECOND': {
            const a = player(s, t.actor), b = s.players.find(p => p.hand.some(b => b.birdId === c.birdId));
            if (!b)
                throw new Error('Missing feeder partner.');
            const ai = a.hand.findIndex(b => b.birdId === t.birdId), bi = b.hand.findIndex(b => b.birdId === c.birdId);
            [a.hand[ai], b.hand[bi]] = [b.hand[bi]!, a.hand[ai]!];
            log(s, '모이통에서 모집한 새를 교환했습니다.', 'DEAL');
            break;
        }
        case 'CREATURE_MOVE': {
            const cr = s.creatures.find(x => x.creature === t.creature);
            if (!cr || !c.path?.length)
                throw new Error('Missing creature path.');
            cr.tileId = c.path.at(-1)!;
            log(s, `${PERCH_CREATURE_INFO[cr.creature].name} 이동: ${c.label}`, 'CREATURE', cr.tileId);
            s.queue.unshift(task('EFFECT_CONFIRM', t.actor, { creature: cr.creature, tiles: c.path }));
            break;
        }
        case 'EFFECT_CONFIRM':
            if (!c.skip)
                s.queue.unshift(...effectTasks(s, t));
            break;
        case 'SEND':
            if (c.birdId && c.tileIds[0]) {
                if (t.creature === 'SCARECROW' && t.flock === 1)
                    s.queue.unshift(task('SEND', t.actor, { ...t, tiles: t.tiles.filter(id => id !== c.tileIds[0]), flock: null }));
                send(s, tile(s, c.tileIds[0]), c.birdId, t.actor);
            }
            break;
        case 'MOVE_FROM':
            s.queue.unshift({ ...t, kind: 'MOVE_TO', birdId: c.birdId });
            break;
        case 'MOVE_TO':
            if (source && c.birdId) {
                if (c.tileIds[0]) {
                    add(s, tile(s, c.tileIds[0]), remove(source, c.birdId));
                    log(s, '새가 이웃 장소로 이동했습니다.', 'WING', c.tileIds[0]);
                }
                else
                    send(s, source, c.birdId, t.actor);
            }
            break;
        case 'SWAP_FROM':
            s.queue.unshift({ ...t, kind: 'SWAP_TO', birdId: c.birdId });
            break;
        case 'SWAP_TO':
            if (source && t.birdId && c.birdId && c.tileIds[0]) {
                const dest = tile(s, c.tileIds[0]), a = remove(source, t.birdId), b = remove(dest, c.birdId);
                add(s, source, b);
                add(s, dest, a);
                log(s, '뻐꾸기가 두 장소의 새를 교환했습니다.', 'WING', source.tileId);
            }
            break;
        case 'SQUIRREL':
            if (source && c.birdId && c.slot !== null) {
                const other = s.fountain[c.slot];
                if (!other)
                    throw new Error('Missing fountain exchange.');
                s.fountain[c.slot] = remove(source, c.birdId);
                add(s, source, other);
                log(s, '다람쥐가 분수와 장소의 새를 교환했습니다.', 'WATER', source.tileId);
            }
            break;
        case 'BEE':
            if (source && c.birdId && c.tileIds[0]) {
                add(s, source, remove(tile(s, c.tileIds[0]), c.birdId));
                log(s, '벌이 같은 색의 새를 데려왔습니다.', 'WING', source.tileId);
            }
            break;
        case 'SCARECROW_HOME': {
            const cr = s.creatures.find(x => x.creature === 'SCARECROW');
            if (cr) {
                cr.intersection = c.tileIds;
                cr.tileId = null;
                log(s, '허수아비가 새로운 교차점에 자리 잡았습니다.', 'CREATURE');
            }
            break;
        }
        default: throw new Error('Unexpected Perch choice.');
    }
}
function upkeepTile(s: PerchState, t: PerchTile, actor: PlayerId) {
    if (t.removed)
        return;
    const info = PERCH_LOCATION_INFO[t.definitionId], p = owner(s, t);
    if (info.creature) {
        const cr = s.creatures.find(c => c.creature === info.creature)!;
        const changed = cr.controller !== (p?.playerId ?? null);
        cr.controller = p?.playerId ?? null;
        cr.used = false;
        if (p) {
            if (cr.creature === 'SCARECROW') {
                if (changed)
                    s.queue.unshift(task('SCARECROW_HOME', p.playerId));
            }
            else if (cr.tileId === null)
                cr.tileId = t.tileId;
        }
        return;
    }
    if (t.definitionId === 'WIRES') {
        if (p)
            s.queue.unshift(task('SEND_OWN', p.playerId, { tiles: [t.tileId] }));
        else if (perchController(t) === s.players.length) {
            const st = t.stacks.find(st => st.flock === s.players.length && !st.house);
            if (st)
                s.supply[st.flock]!.push(remove(t, st.birds[0]!.birdId));
        }
    }
    if ((t.definitionId === 'HANGING' && total(t) >= 4) || (t.definitionId === 'OVERSTUFFED' && total(t) >= 7)) {
        for (const st of [...t.stacks])
            if (!st.house) {
                for (const b of [...st.birds]) {
                    const bird = remove(t, b.birdId);
                    if (bird.flock >= s.players.length)
                        s.supply[bird.flock]!.push(bird);
                    else
                        s.plaza.push(bird);
                }
            }
        if (t.definitionId === 'OVERSTUFFED') {
            // Location removal is not a creature/lightning effect: protected birds also leave the removed tile.
            for (const st of t.stacks) {
                for (const b of st.birds) {
                    if (b.flock >= s.players.length)
                        s.supply[b.flock]!.push(b);
                    else
                        s.plaza.push(b);
                }
            }
            t.stacks = [];
            t.removed = true;
            t.nests = t.nests.map(() => false);
            for (const cr of s.creatures) {
                if (cr.tileId === t.tileId)
                    cr.tileId = location(s, PERCH_CREATURE_INFO[cr.creature].home)?.tileId ?? null;
                if (cr.intersection.includes(t.tileId))
                    cr.intersection = cr.intersection.filter(id => id !== t.tileId);
            }
        }
        log(s, `${info.name}의 새들이 광장으로 이동했습니다.`, 'WING', t.tileId);
    }
    void actor;
}
export function perchObjectiveAchieved(s: PerchState, flock: number, id: PerchObjective): boolean {
    const ts = sortedBoard(s), mine = (t: PerchTile) => perchStrength(t.stacks.find(st => st.flock === flock)), control = (t: PerchTile) => perchController(t) === flock, controlled = ts.filter(control), owned = s.creatures.filter(c => c.controller === s.players.find(p => p.flock === flock)?.playerId).length;
    const originalColumns = [...new Set(s.board.map(t => t.col))].sort((a, b) => a - b), corners = s.board.filter(t => (t.col === originalColumns[0] || t.col === originalColumns.at(-1)) && (t.row === Math.min(...s.board.filter(b => b.col === t.col).map(b => b.row)) || t.row === Math.max(...s.board.filter(b => b.col === t.col).map(b => b.row))));
    const rank = (n: number) => ts.filter(t => perchRanks(t).some(r => r.flock === flock && r.rank === n)).length;
    switch (id) {
        case 'WISE': return controlled.some(a => [1, -1].some(dy => [1, 2].every(n => controlled.some(b => b.col === a.col + n && b.row === a.row + dy * n))));
        case 'CHIRP': return originalColumns.some(col => ts.filter(t => t.col === col && mine(t) >= 2).length >= 3);
        case 'TOUCAN': return corners.filter(t => !t.removed && control(t)).length >= 2;
        case 'LORD': return corners.every(t => !t.removed && mine(t) >= 1);
        case 'IMPECKABLE': return controlled.some(t => t.nests.some(Boolean));
        case 'ILLEAGLE': return controlled.some(t => t.stacks.some(st => st.flock !== flock && st.nest !== null));
        case 'OSTRICH': return controlled.filter(t => PERCH_LOCATION_INFO[t.definitionId].kind === 'BASIC').length >= 2;
        case 'EGGS': return controlled.some(t => PERCH_LOCATION_INFO[t.definitionId].kind === 'BASIC');
        case 'JACK': return owned >= 2;
        case 'BIRDEN': return owned >= 1;
        case 'WING': return owned === 0;
        case 'UNPHEASANT': return rank(2) >= 2;
        case 'QUACK': return rank(3) >= 2;
        case 'COMEDIHEN': return rank(4) >= 3;
        case 'CROWBAR': return controlled.some(t => total(t) === Math.max(...ts.map(total)));
        case 'STORK': return ts.every(t => mine(t) >= 1);
        case 'TWEET': return ts.filter(t => mine(t) >= 2).length >= 5;
        case 'HIDDEN': return ts.some(t => t.stacks.length === 0);
        case 'EGRETS': return ts.filter(t => mine(t) === 0).length >= 3;
        case 'MYSELF': return controlled.some(t => t.stacks.length === 1);
        case 'ROBIN': return controlled.filter(t => t.nests.some(Boolean)).length >= 2;
        case 'EMU': return controlled.some(t => PERCH_LOCATION_INFO[t.definitionId].kind === 'SPECIAL');
    }
}
function finish(s: PerchState, now: ServerTime) {
    s.plaza.push(...s.bag.splice(0));
    const bonuses: Array<{
        playerId: PlayerId;
        source: string;
        points: number;
    }> = [], objectives = s.players.map(p => ({ playerId: p.playerId, objective: p.objective, achieved: p.objective !== null && perchObjectiveAchieved(s, p.flock, p.objective) }));
    const maxes = Array.from({ length: s.supply.length }, (_, f) => Math.max(0, ...s.board.filter(t => !t.removed).map(t => perchStrength(t.stacks.find(st => st.flock === f))))), largest = Math.max(...maxes), cells = perchFountainCells(s.players.length);
    for (const p of s.players) {
        const obj = objectives.find(o => o.playerId === p.playerId)!;
        const lines = [{ source: '개인 목표', points: obj.achieved && p.objective ? PERCH_OBJECTIVE_INFO[p.objective].points : 0 }, { source: '가장 큰 무리', points: largest > 0 && maxes[p.flock] === largest && maxes.filter(n => n === largest).length === 1 ? 10 : 0 }, { source: '조종 동물', points: s.creatures.filter(c => c.controller === p.playerId).length * 3 }, { source: '분수', points: cells.reduce((n, c) => n + (s.fountain[c.id]?.flock === p.flock ? c.points : 0), 0) }, { source: '광장', points: s.plaza.filter(b => b.flock === p.flock).length }];
        for (const l of lines) {
            addScore(s, p.playerId, l.points, l.source, false);
            bonuses.push({ playerId: p.playerId, ...l });
        }
    }
    let winners = s.players.filter(p => p.score === Math.max(...s.players.map(p => p.score)));
    if (winners.length > 1) {
        const n = Math.max(...winners.map(p => maxes[p.flock]!));
        winners = winners.filter(p => maxes[p.flock] === n);
    }
    if (winners.length > 1) {
        const n = Math.max(...winners.map(p => s.fountain.filter(b => b?.flock === p.flock).length));
        winners = winners.filter(p => s.fountain.filter(b => b?.flock === p.flock).length === n);
    }
    s.result = { reason: 'SCORED', winnerPlayerIds: winners.map(p => p.playerId), bonuses, objectives };
    s.phase = 'FINISHED';
    s.finishedAt = now;
    s.queue = [];
    log(s, '다섯 번의 계절이 끝났습니다. 최종 점수를 확인하세요.', 'WIN');
}
function drain(s: PerchState, random: RandomSource, now: ServerTime) {
    for (let guard = 0; guard < 200; guard++) {
        const t = s.queue[0];
        if (!t)
            return;
        if (TITLES[t.kind]) {
            const choices = candidateChoices(s, t);
            if (choices.length)
                return;
            s.queue.shift();
            if (t.kind === 'FOUNTAIN') {
                const i = s.pool.findIndex(b => b.birdId === t.birdId);
                if (i >= 0)
                    s.plaza.push(...s.pool.splice(i, 1));
            }
            continue;
        }
        s.queue.shift();
        const actor = activePerchPlayer(s).playerId;
        switch (t.kind) {
            case 'MIGRATE': {
                s.phase = 'MIGRATION';
                for (let f = 0; f < s.supply.length; f++)
                    s.bag.push(...takeSupply(s, f, s.players.length === 2 && f === 2 && s.round === 1 ? 4 : 2));
                const early = owner(s, location(s, 'EARLY'));
                if (early)
                    s.bag.push(...takeSupply(s, early.flock, 1));
                const rookery = location(s, 'ROOKERY');
                if (rookery) {
                    for (const p of s.players)
                        if (perchStrength(rookery.stacks.find(st => st.flock === p.flock)) === 2 && s.supply[p.flock]!.length)
                            s.queue.push(task('ROOKERY_ADD', p.playerId));
                    const p = owner(s, rookery);
                    if (p)
                        s.queue.push(task('SEND_OWN', p.playerId, { tiles: [rookery.tileId] }));
                    else if (perchController(rookery) === s.players.length) {
                        const st = rookery.stacks.find(st => st.flock === s.players.length && !st.house);
                        if (st)
                            s.supply[st.flock]!.push(remove(rookery, st.birds[0]!.birdId));
                    }
                }
                s.queue.push(task('RECRUIT', actor));
                log(s, `${s.round}라운드 · 새들이 이동 주머니에 모입니다.`, 'DEAL');
                break;
            }
            case 'RECRUIT': {
                s.phase = 'RECRUIT';
                for (const p of s.players)
                    p.hand.push(...takeSupply(s, p.flock, 2));
                const bath = owner(s, location(s, 'BIRDBATH'));
                s.bag = shuffled(s.bag, random);
                if (bath && s.bag.length >= 3) {
                    s.pool.push(...s.bag.splice(0, 3));
                    s.queue.push(task('BATH_RETURN', bath.playerId));
                }
                else
                    beginRecruitRest(s, random, null);
                break;
            }
            case 'PERCH_BEGIN':
                s.phase = 'PERCH';
                s.activeIndex = 0;
                s.placed = false;
                s.bonusUsed = false;
                while (s.activeIndex < s.turnOrder.length - 1 && !activePerchPlayer(s).hand.length)
                    s.activeIndex++;
                if (!s.players.some(p => p.hand.length))
                    s.queue.push(task('UPKEEP', actor));
                else
                    log(s, `${PERCH_FLOCK_NAMES[activePerchPlayer(s).flock]} 플레이어의 차례입니다.`, 'TURN');
                break;
            case 'UPKEEP': {
                s.phase = 'UPKEEP';
                s.roundScores = [];
                for (const loc of sortedBoard(s)) {
                    const ranks = perchRanks(loc);
                    for (const id of s.turnOrder) {
                        const p = player(s, id), points = ranks.find(r => r.flock === p.flock)?.points ?? 0;
                        addScore(s, id, points, PERCH_LOCATION_INFO[loc.definitionId].name);
                    }
                }
                const old = [...s.scoreTrack];
                s.turnOrder = s.players.map(p => p.playerId).sort((a, b) => player(s, b).score - player(s, a).score || old.indexOf(a) - old.indexOf(b));
                const high = owner(s, location(s, 'HIGH'));
                if (high)
                    s.turnOrder = [...s.turnOrder.filter(id => id !== high.playerId), high.playerId];
                s.activeIndex = 0;
                for (const loc of sortedBoard(s))
                    s.queue.push(task('UPKEEP_TILE', activePerchPlayer(s).playerId, { tiles: [loc.tileId] }));
                s.queue.push(task('ROUND_FINISH', activePerchPlayer(s).playerId));
                log(s, `${s.round}라운드 장소 점수를 정산했습니다.`, 'SCORE');
                break;
            }
            case 'UPKEEP_TILE':
                if (t.tiles[0])
                    upkeepTile(s, tile(s, t.tiles[0]), t.actor);
                break;
            case 'ROUND_FINISH':
                if (s.round === 5)
                    finish(s, now);
                else
                    s.phase = 'ROUND_END';
                break;
            default: throw new Error('Invalid automatic Perch task.');
        }
    }
    throw new Error('Perch effect queue exceeded bound.');
}
export function applyPerchAction(state: PerchState, actor: PlayerId, input: PerchAction, now: ServerTime, turnId: TurnId, random: RandomSource, host: PlayerId | null, generateTileId: () => TileId): {
    ok: true;
    state: PerchState;
} | {
    ok: false;
    reason: 'INVALID_ACTION' | 'NOT_YOUR_TURN' | 'INVALID_PHASE';
} {
    const parsed = v.safeParse(PerchActionSchema, input);
    if (!parsed.success)
        return { ok: false, reason: 'INVALID_ACTION' };
    const a = parsed.output;
    if (state.phase === 'FINISHED')
        return { ok: false, reason: 'INVALID_PHASE' };
    if (!state.players.some(p => p.playerId === actor))
        return { ok: false, reason: 'NOT_YOUR_TURN' };
    const s = parsePerchState(state), p = player(s, actor);
    const reject = () => ({ ok: false as const, reason: 'INVALID_ACTION' as const });
    if (a.type === 'CONFIGURE') {
        if (s.phase !== 'SETUP' || actor !== host)
            return reject();
        s.settings = { randomBoard: a.randomBoard, objectives: a.objectives };
        s.board = buildBoard(s.players.length, random, generateTileId, a.randomBoard);
    }
    else if (a.type === 'BEGIN') {
        if (s.phase !== 'SETUP' || actor !== host)
            return reject();
        s.turnOrder = shuffled(s.turnOrder, random);
        s.scoreTrack = [...s.turnOrder];
        s.creatures = s.board.flatMap(t => { const kind = PERCH_LOCATION_INFO[t.definitionId].creature; return kind ? [{ creature: kind, controller: null, tileId: null, intersection: [], used: false }] : []; });
        if (s.settings.objectives) {
            const cards = shuffled(PERCH_OBJECTIVES.filter(id => { const i = PERCH_OBJECTIVE_INFO[id]; return s.players.length >= i.min && s.players.length <= i.max; }), random);
            for (const pl of s.players)
                pl.objectiveChoices = cards.splice(0, 2);
            s.phase = 'OBJECTIVES';
        }
        else
            s.queue.push(task('MIGRATE', activePerchPlayer(s).playerId));
    }
    else if (a.type === 'OBJECTIVE') {
        if (s.phase !== 'OBJECTIVES' || p.objective !== null || !p.objectiveChoices.includes(a.objective))
            return reject();
        p.objective = a.objective;
        p.objectiveChoices = [];
        if (s.players.every(p => p.objective !== null))
            s.queue.push(task('MIGRATE', activePerchPlayer(s).playerId));
    }
    else if (a.type === 'CHOOSE') {
        const t = s.queue[0];
        if (!t || t.actor !== actor)
            return { ok: false, reason: 'NOT_YOUR_TURN' };
        const choice = candidateChoices(s, t).find(c => c.id === a.choiceId);
        if (!choice)
            return reject();
        s.queue.shift();
        resolveChoice(s, t, choice, random);
    }
    else if (a.type === 'CONTINUE') {
        if (s.phase !== 'ROUND_END' || s.queue.length || actor !== activePerchPlayer(s).playerId)
            return reject();
        s.round++;
        for (const pl of s.players) {
            if (s.round === 4)
                pl.house = true;
            if (s.round === 5)
                pl.lightning = true;
        }
        s.queue.push(task('MIGRATE', actor));
    }
    else {
        if (s.phase !== 'PERCH' || s.queue.length)
            return { ok: false, reason: 'INVALID_PHASE' };
        if (activePerchPlayer(s).playerId !== actor)
            return { ok: false, reason: 'NOT_YOUR_TURN' };
        if (a.type === 'PLACE') {
            if (s.placed)
                return reject();
            const b = p.hand.find(b => b.birdId === a.birdId), dest = s.board.find(t => t.tileId === a.tileId);
            if (!b || !dest || !canAdd(dest, b.flock))
                return reject();
            const st = dest.stacks.find(st => st.flock === b.flock);
            if (a.nest !== null && (!dest.nests[a.nest] || dest.stacks.some(x => x.nest === a.nest && x.flock !== b.flock) || st?.nest !== null && st?.nest !== undefined && st.nest !== a.nest))
                return reject();
            p.hand = p.hand.filter(x => x !== b);
            add(s, dest, b, a.nest);
            s.placed = true;
            log(s, `${PERCH_FLOCK_NAMES[p.flock]} 플레이어가 ${birdLabel(b)}를 ${PERCH_LOCATION_INFO[dest.definitionId].name}에 배치했습니다.`, 'PLACE', dest.tileId);
        }
        else if (a.type === 'HOUSE') {
            const dest = s.board.find(t => t.tileId === a.tileId), st = dest?.stacks.find(st => st.flock === a.flock);
            if (s.bonusUsed || !p.house || !dest || dest.removed || !st || st.house)
                return reject();
            st.house = true;
            p.house = false;
            s.bonusUsed = true;
            log(s, '새집이 무리를 따뜻하게 보호합니다.', 'HOUSE', dest.tileId);
        }
        else if (a.type === 'ZAP') {
            const dest = s.board.find(t => t.tileId === a.tileId);
            if (s.bonusUsed || !p.lightning || !dest || dest.removed)
                return reject();
            if (a.birdId !== null && a.nest === null) {
                const st = dest.stacks.find(st => st.birds.some(b => b.birdId === a.birdId));
                if (!st || st.house)
                    return reject();
                send(s, dest, a.birdId, actor);
            }
            else if (a.birdId === null && a.nest !== null && dest.nests[a.nest] && !dest.stacks.some(st => st.nest === a.nest)) {
                dest.nests[a.nest] = false;
            }
            else
                return reject();
            p.lightning = false;
            s.bonusUsed = true;
            log(s, '번개 토큰을 사용했습니다.', 'ZAP', dest.tileId);
        }
        else if (a.type === 'CREATURE') {
            const cr = s.creatures.find(c => c.creature === a.creature);
            if (s.bonusUsed || !cr || cr.used || cr.controller !== actor)
                return reject();
            if (cr.creature === 'SCARECROW') {
                if (!cr.intersection.length)
                    return reject();
                s.queue.push(task('EFFECT_CONFIRM', actor, { creature: a.creature, tiles: [...cr.intersection] }));
            }
            else {
                if (!creaturePaths(s, a.creature).length)
                    return reject();
                s.queue.push(task('CREATURE_MOVE', actor, { creature: a.creature }));
            }
            cr.used = true;
            s.bonusUsed = true;
        }
        else if (a.type === 'END_TURN') {
            if (!s.placed)
                return reject();
            if (!s.players.some(p => p.hand.length))
                s.queue.push(task('UPKEEP', actor));
            else {
                do {
                    s.activeIndex = (s.activeIndex + 1) % s.turnOrder.length;
                } while (!activePerchPlayer(s).hand.length);
                s.placed = false;
                s.bonusUsed = false;
                log(s, `${PERCH_FLOCK_NAMES[activePerchPlayer(s).flock]} 플레이어의 차례입니다.`, 'TURN');
            }
        }
        else
            return reject();
    }
    drain(s, random, now);
    s.revision = v.parse(GameRevisionSchema, s.revision + 1);
    s.transitionId = turnId;
    return { ok: true, state: parsePerchState(s) };
}
export function cancelPerch(state: PerchState, now: ServerTime): PerchState { const s = parsePerchState(state); s.phase = 'FINISHED'; s.finishedAt = now; s.revision = v.parse(GameRevisionSchema, s.revision + 1); s.queue = []; s.result = { reason: 'CANCELLED', winnerPlayerIds: [], bonuses: [], objectives: [] }; for (const p of s.players)
    p.objectiveChoices = []; log(s, '참가자가 나가 게임을 종료했습니다. 대기실에서 다시 시작할 수 있습니다.'); return s; }
