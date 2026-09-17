import {safeParse} from 'valibot';
import {SpeakeasyPracticeCommandSchema,type SpeakeasyPracticeReply} from '@hangul-rummikub/shared';
import {actPractice,startPractice,projectPractice,type PracticeGame} from './game.js';

type Session={game:PracticeGame;touched:number;receipts:Map<string,string>};
/** Ephemeral training sessions only. Synchronous prepare/commit serializes each command. */
export class SpeakeasyPracticeService {
  private readonly sessions=new Map<string,Session>();
  constructor(private readonly ids:()=>string,private readonly now:()=>number){}
  create():{token:string;view:ReturnType<typeof projectPractice>}|null {
    this.prune();if(this.sessions.size>=100)return null;
    const token=this.ids(),game=startPractice(this.ids);
    this.sessions.set(token,{game,touched:this.now(),receipts:new Map()});
    return {token,view:projectPractice(game)};
  }
  read(token:string):SpeakeasyPracticeReply {
    const session=this.find(token);return session?{ok:true,view:projectPractice(session.game)}:{ok:false,reason:'SESSION_EXPIRED'};
  }
  command(token:string,input:unknown):SpeakeasyPracticeReply {
    const session=this.find(token);if(!session)return {ok:false,reason:'SESSION_EXPIRED'};
    const parsed=safeParse(SpeakeasyPracticeCommandSchema,input);
    if(!parsed.success)return {ok:false,reason:'INVALID_COMMAND'};
    const command=parsed.output,signature=JSON.stringify(command),prior=session.receipts.get(command.requestId);
    if(prior)return prior===signature?{ok:true,view:projectPractice(session.game)}:{ok:false,reason:'INVALID_COMMAND'};
    if(command.revision!==session.game.revision)return {ok:false,reason:'STALE_REVISION'};
    const next=actPractice(session.game,session.game.player,command);
    if(!next)return {ok:false,reason:'INVALID_COMMAND'};
    // Build the public view before changing the live session.
    const view=projectPractice(next);session.game=next;session.receipts.set(command.requestId,signature);
    if(session.receipts.size>64)session.receipts.delete(session.receipts.keys().next().value!);
    return {ok:true,view};
  }
  remove(token:string):void{this.sessions.delete(token);}
  private prune(){const cutoff=this.now()-2*60*60*1000;for(const [key,s] of this.sessions)if(s.touched<=cutoff)this.sessions.delete(key);}
  private find(token:string){this.prune();const s=this.sessions.get(token);if(s)s.touched=this.now();return s;}
}
