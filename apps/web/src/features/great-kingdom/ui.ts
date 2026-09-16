import type {GreatKingdomProjection} from "@hangul-rummikub/shared";
export function greatKingdomScope(g: GreatKingdomProjection): string {return `${g.gameId}:${g.gameRevision}:${g.phase === 'PLAYING' ? g.turnId : 'FINISHED'}`;}
export function greatKingdomSelection(g: GreatKingdomProjection, selfId: string, position: number | null): number | null {
  return g.phase === 'PLAYING' && g.activePlayerId === selfId && position !== null && g.legalPositions.includes(position) ? position : null;
}
export function greatKingdomCellReason(g: GreatKingdomProjection, position: number): string {
  const piece = g.board[position];
  if (piece) return piece.color === 'NEUTRAL' ? '중립 성' : `${piece.color === 'BLUE' ? '파랑' : '주황'} 성`;
  const owner = g.territoryOwners[position];
  return owner ? `${owner === 'BLUE' ? '파랑' : '주황'} 영토` : '빈칸';
}
