import type { RoomId } from '@hangul-rummikub/shared';
import { ArkNovaCommandService } from './command-service.js';
import { ArkNovaRoomCommandStore } from './room-command-store.js';
import { ArkNovaStartService, type ArkNovaStartDependencies } from './start-service.js';

export class ArkNovaService extends ArkNovaStartService {
  private readonly listeners=new Set<(roomId:RoomId)=>void|Promise<void>>();
  private readonly commands:ArkNovaCommandService;
  constructor(deps:ArkNovaStartDependencies) {
    super(deps);
    this.commands=new ArkNovaCommandService({...deps,
      commandStore:new ArkNovaRoomCommandStore(deps.roomRepository,deps.roomUnitOfWork),
      notify:roomId=>this.notify(roomId)});
  }
  subscribe(listener:(roomId:RoomId)=>void|Promise<void>) {
    this.listeners.add(listener);
    return ()=>{this.listeners.delete(listener);};
  }
  async notify(roomId:RoomId):Promise<void> {
    await Promise.allSettled([...this.listeners].map(listener=>Promise.resolve().then(()=>listener(roomId))));
  }
  command(input:Parameters<ArkNovaCommandService['command']>[0]) {return this.commands.command(input);}
}
