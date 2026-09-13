import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import { StateSyncWireAckSchema } from '@hangul-rummikub/shared';
import { getSpaceCrewAvailableActions, getSpaceCrewActionPrompt } from '../apps/web/.test-dist/features/space-crew/selectors.js';
import { getSpaceCrewMissionCopy } from '../apps/web/.test-dist/features/space-crew/mission-copy.js';
import { createCrewHarness, assertCrewViews, gameOf } from './space-crew-harness.mjs';

// Independent audited expectations, intentionally separate from production UI copy.
const FIVE_PLAYER_TRANSFER_MISSIONS = new Set([25, 27, 28, 30, 31, 32, 35, 36, 37, 38, 39, 40, 42, 43, 45, 47, 48, 49]);
const FULL_HAND_MISSIONS = new Set([5, 16, 29, 33, 34, 41, 48, 50]);

function actionKey(action) { return action.kind === 'TASK' || action.kind === 'DISTRESS' ? `${action.kind}:${action.action.kind}` : action.kind; }

/** Fixed, deliberately nonstrategic choices exercise the UI contract, not a solver. */
function chooseNext(snapshots, trace) {
  const available = snapshots.flatMap((snapshot, index) => getSpaceCrewAvailableActions(gameOf(snapshot)).map(action => ({ index, snapshot, action })));
  const first = predicate => available.find(({ action }) => predicate(action));
  for (const key of ['TASK:SWAP_TOKENS', 'TASK:MOVE_TOKEN', 'SPECIAL_RESPOND', 'SPECIAL_SELECT', 'SPECIAL_PREFERENCE',
    'SPECIAL_PROPOSE_ROLES', 'SPECIAL_VOTE_ROLES', 'TASK:CHOOSE', 'TASK:RESPOND', 'TASK:ASSIGN', 'TASK:TRANSFER', 'DISTRESS:PROPOSE', 'DISTRESS:VOTE', 'DISTRESS:SELECT', 'COMMUNICATE', 'PLAY']) {
    if (key === 'SPECIAL_VOTE_ROLES' && !trace.rejectedRoleProposal) {
      const reject = first(action => action.kind === 'SPECIAL_VOTE_ROLES' && !action.accept);
      if (reject) { trace.rejectedRoleProposal = true; return reject; }
    }
    const chosen = first(action => actionKey(action) === key);
    if (chosen) return chosen;
  }
  return null;
}

for (const count of [3, 4, 5]) {
  test(`${count} players: all fifty missions traverse real wire → web decoder/selectors → wire to a terminal result`, { timeout: 240000 }, async t => {
    const harness = await createCrewHarness(t, count);
    let snapshots = await harness.startPractice(1);
    const coverage = new Set(), results = [], historicalIds = new Set();
    for (let missionNumber = 1; missionNumber <= 50; missionNumber++) {
      await t.test(`mission ${String(missionNumber).padStart(2, '0')}`, async () => {
        if (missionNumber > 1) snapshots = await harness.practiceMission(missionNumber);
        const start = assertCrewViews(harness, snapshots);
        assert.equal(start.missionNumber, missionNumber);
        assert.equal(getSpaceCrewMissionCopy(missionNumber).fivePlayerTransfer, FIVE_PLAYER_TRANSFER_MISSIONS.has(missionNumber), 'UI transfer eligibility must match the independently audited mission list');
        assert.equal(start.attemptNumber, 1);
        assert.equal(start.totalTricks, Math.floor(40 / count));
        assert.equal(start.campaign.actualAttempts, 1);
        assert.equal(start.campaign.distressActive, false);
        for (const card of snapshots.flatMap(snapshot => gameOf(snapshot).privateState.hand)) {
          assert.equal(historicalIds.has(card.cardId), false, 'a new attempt must receive new opaque playing-card identities'); historicalIds.add(card.cardId);
        }
        const trace = { rejectedRoleProposal: false }, rowCoverage = new Set();
        let steps = 0, lastRevision = start.gameRevision;
        while (gameOf(snapshots[0]).phase !== 'FINISHED') {
          assert.ok(steps++ < 250, `bounded progression failed at mission ${missionNumber}`);
          const chosen = chooseNext(snapshots, trace);
          assert.ok(chosen, `nonterminal mission ${missionNumber} has no progress action: ${getSpaceCrewActionPrompt(gameOf(snapshots[0]))}`);
          const { index, snapshot, action } = chosen;
          const key = actionKey(action); coverage.add(key); rowCoverage.add(key);
          // An unknown playing-card reference must neither consume a card nor a revision.
          if (key === 'PLAY' && !rowCoverage.has('REJECTED_UNKNOWN_CARD')) {
            const before = snapshots.map(view => structuredClone(view.game));
            const rejected = v.parse(StateSyncWireAckSchema, await harness.send(harness.members[index], harness.actionCommand(snapshot, { kind: 'PLAY', cardId: 'not-an-owned-card' })));
            assert.equal(rejected.ok, false);
            assert.equal(rejected.error.code, 'RULE_VIOLATION', 'unknown owned-card reference must fail as a rule rejection, not an internal error');
            rowCoverage.add('REJECTED_UNKNOWN_CARD');
            const unchanged = await harness.syncAll(); assert.deepEqual(unchanged.map(view => view.game), before);
          }
          snapshots = await harness.act(index, snapshot, action);
          const next = assertCrewViews(harness, snapshots);
          assert.equal(next.gameRevision, lastRevision + 1); lastRevision = next.gameRevision;
          assert.equal(next.gameId, start.gameId); assert.equal(next.attemptId, start.attemptId);
        }
        const terminal = assertCrewViews(harness, snapshots);
        assert.ok(terminal.missionStatus === 'SUCCESS' || terminal.missionStatus === 'FAILURE');
        assert.deepEqual(getSpaceCrewAvailableActions(terminal), []);
        assert.equal(terminal.campaign.actualAttempts, 1);
        assert.equal(terminal.campaign.recordedAttempts, 2, 'one use of distress signal charges one extra attempt point');
        assert.equal(terminal.campaign.distressActive, true);
        const checkpoint = await harness.campaigns.read(terminal.campaign.campaignId); assert.ok(checkpoint);
        assert.equal(checkpoint.pendingInterruption, null); assert.equal(checkpoint.lease.active, false);
        assert.equal(checkpoint.attempts.length, missionNumber);
        assert.equal(checkpoint.attempts.at(-1).status, terminal.missionStatus);
        assert.equal(checkpoint.attempts.at(-1).missionNumber, missionNumber);
        assert.equal(checkpoint.attempts.at(-1).attemptId, terminal.attemptId);
        if (terminal.missionStatus === 'SUCCESS' && FULL_HAND_MISSIONS.has(missionNumber)) assert.equal(terminal.completedTrickCount, terminal.totalTricks);
        if (count === 5 && FIVE_PLAYER_TRANSFER_MISSIONS.has(missionNumber)) assert.ok(rowCoverage.has('TASK:TRANSFER'));
        if (missionNumber === 23) assert.ok(rowCoverage.has('TASK:SWAP_TOKENS'));
        if (missionNumber === 40) assert.ok(rowCoverage.has('TASK:MOVE_TOKEN'));
        if (missionNumber === 50) assert.equal(trace.rejectedRoleProposal, true);
        results.push({ missionNumber, outcome: terminal.missionStatus, steps, tricks: terminal.completedTrickCount });
      });
    }
    assert.equal(results.length, 50);
    if (count === 5) assert.ok(coverage.has('TASK:TRANSFER'), 'five-player wire coverage must include task transfer');
    for (const key of ['PLAY', 'COMMUNICATE', 'TASK:CHOOSE', 'TASK:RESPOND', 'TASK:ASSIGN', 'TASK:SWAP_TOKENS', 'TASK:MOVE_TOKEN',
      'DISTRESS:PROPOSE', 'DISTRESS:VOTE', 'DISTRESS:SELECT', 'SPECIAL_RESPOND', 'SPECIAL_SELECT', 'SPECIAL_PREFERENCE', 'SPECIAL_PROPOSE_ROLES', 'SPECIAL_VOTE_ROLES']) assert.ok(coverage.has(key), `missing wire action family ${key}`);
    t.diagnostic(`${count} players: 50 terminal missions; ${results.filter(row => row.outcome === 'SUCCESS').length} succeeded under fixed nonstrategic choices; ${results.reduce((sum, row) => sum + row.steps, 0)} accepted UI actions.`);
    await harness.close();
  });
}
