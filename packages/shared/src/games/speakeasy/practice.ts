import * as v from 'valibot';
import {GameIdSchema, PlayerIdSchema, TileIdSchema} from '../../identifiers.js';
import {SpeakeasyBuildingKindSchema, SpeakeasyBuildingViewSchema} from './contracts.js';

/** Deliberately separate training rules; not an official Speakeasy setup or solo mode. */
export const SPEAKEASY_PRACTICE_RULES = [
  '컴퓨터 상대와 11턴을 진행합니다. 한 턴에 원하는 행동을 최대 2번 합니다. 원작의 카포 자리·카드 선택은 생략합니다.',
  '각자 현금 $15, 금고 $30, 증류소·주점 각 1개, 보호용 조직원 4명으로 시작합니다.',
  '생산은 주류 2개, 운송은 트럭 1대·이동 3칸·적재 2개입니다. 별도 이동 행동으로 트럭 위치를 바꿀 수 있습니다. 번호 지도는 연습용 4×4 격자이며 상하좌우로만 연결됩니다.',
  '판매는 한 번에 건물 1곳에서 합니다. 주점 $10, 나이트클럽·카지노 $15입니다. 건설은 주점 $3·나이트클럽 $12이며 증축 할인은 없으며 나이트클럽은 구역권마다 하나만 지을 수 있습니다.',
  '보호는 한 번에 자기 건물 1곳에 조직원 1명을 놓습니다. 현금을 우선 사용하고 부족하면 금고에서 부족액의 2배를 냅니다.',
  '4·7·10턴 종료 시 각각 4·8·12구역에 경찰이 진입합니다. 보호 없는 건물은 영업이 중단되며, 각 영업 건물당 $5를 금고로 받습니다.',
  '최종 점수는 현금+금고+보호된 건물 점수입니다. 운영 카드·도시 타일·장부·도우미·부두·마피아 충돌은 이번 연습에서 사용하지 않습니다.',
] as const;
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const district = v.pipe(count,v.minValue(1),v.maxValue(16));
export const SpeakeasyPracticeActionSchema = v.variant('type', [
  v.strictObject({type:v.literal('BUILD'),kind:v.picklist(['SPEAKEASY','NIGHTCLUB']),district,slot:v.picklist([0,1])}),
  v.strictObject({type:v.literal('PRODUCE')}),
  v.strictObject({type:v.literal('MOVE'),district}),
  v.strictObject({type:v.literal('DELIVER'),buildingId:TileIdSchema}),
  v.strictObject({type:v.literal('SELL'),buildingId:TileIdSchema}),
  v.strictObject({type:v.literal('PROTECT'),buildingId:TileIdSchema}),
  v.strictObject({type:v.literal('END_TURN')}),
]);
export type SpeakeasyPracticeAction = v.InferOutput<typeof SpeakeasyPracticeActionSchema>;
export const SpeakeasyPracticeCommandSchema = v.strictObject({
  gameId:GameIdSchema, revision:count, requestId:v.pipe(v.string(),v.minLength(1),v.maxLength(100)),action:SpeakeasyPracticeActionSchema,
});
export type SpeakeasyPracticeCommand = v.InferOutput<typeof SpeakeasyPracticeCommandSchema>;
export const SpeakeasyPracticeResourceChangeSchema = v.strictObject({
  cash:v.pipe(v.number(),v.safeInteger()),safe:v.pipe(v.number(),v.safeInteger()),
  stock:v.pipe(v.number(),v.safeInteger()),family:v.pipe(v.number(),v.safeInteger()),truckLoad:v.pipe(v.number(),v.safeInteger()),
});
export const SpeakeasyPracticeViewSchema = v.strictObject({
  gameId:GameIdSchema,revision:count,viewerId:PlayerIdSchema,opponentId:PlayerIdSchema,
  turn:v.pipe(count,v.minValue(1),v.maxValue(11)),actionsLeft:v.pipe(count,v.maxValue(2)),finished:v.boolean(),
  cash:count,safe:count,stock:count,family:count,
  truck:v.strictObject({district:v.nullable(district),load:count}),
  districts:v.array(v.strictObject({id:district,cop:v.boolean(),slots:v.array(v.nullable(SpeakeasyBuildingViewSchema))})),
  settlement:v.nullable(v.strictObject({turn:v.picklist([4,7,10]),district,income:count,atRisk:v.array(TileIdSchema)})),
  reserves:v.array(v.strictObject({kind:SpeakeasyBuildingKindSchema,count})),
  /** Only executable choices, computed by the authoritative server. */
  choices:v.array(v.strictObject({label:v.string(),detail:v.string(),action:SpeakeasyPracticeActionSchema,
    preview:v.strictObject({route:v.array(district),targets:v.array(v.strictObject({district,slot:v.nullable(v.picklist([0,1]))})),delta:SpeakeasyPracticeResourceChangeSchema})})),
  feedback:v.nullable(v.strictObject({title:v.string(),delta:SpeakeasyPracticeResourceChangeSchema,events:v.array(v.string())})),
  log:v.array(v.string()),
  scores:v.array(v.strictObject({playerId:PlayerIdSchema,cash:count,safe:count,buildings:count,total:count,winner:v.boolean()})),
});
export type SpeakeasyPracticeView = v.InferOutput<typeof SpeakeasyPracticeViewSchema>;
export const SpeakeasyPracticeReplySchema = v.union([
  v.strictObject({ok:v.literal(true),view:SpeakeasyPracticeViewSchema}),
  v.strictObject({ok:v.literal(false),reason:v.picklist(['INVALID_COMMAND','STALE_REVISION','SESSION_EXPIRED','CAPACITY','INTERNAL_ERROR'])}),
]);
export type SpeakeasyPracticeReply = v.InferOutput<typeof SpeakeasyPracticeReplySchema>;
