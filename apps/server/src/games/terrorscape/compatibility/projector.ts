import { TerrorscapePlayingProjectionSchema,TerrorscapeFinishedProjectionSchema,type PlayerId } from '@hangul-rummikub/shared';
import {parse} from 'valibot';
import type {TerrorscapeStoredGame} from './adapter.js';
import {terrorView} from '../domain/visibility.js';
export function projectTerrorscape(game:TerrorscapeStoredGame,viewer:PlayerId){if(!game.state.players.some(p=>p.playerId===viewer))throw new Error('Missing viewer');const view=terrorView(game.state,viewer);return view.phase==='FINISHED'?parse(TerrorscapeFinishedProjectionSchema,view):parse(TerrorscapePlayingProjectionSchema,view);}
