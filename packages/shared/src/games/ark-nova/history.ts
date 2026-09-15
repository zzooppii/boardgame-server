import * as v from 'valibot';
import {GameRevisionSchema} from '../../protocol.js';
const text=v.pipe(v.string(),v.maxLength(200));
const count=v.pipe(v.number(),v.safeInteger(),v.minValue(0));
export const ArkHistoryEntrySchema=v.strictObject({
  revision:GameRevisionSchema,round:v.pipe(count,v.minValue(1),v.maxValue(1000000)),turn:v.pipe(count,v.maxValue(1000000)),
  label:text,notes:v.pipe(v.array(text),v.maxLength(20)),
  changes:v.pipe(v.array(v.strictObject({resource:v.picklist(['돈','매력','보전','평판','X','직원']),before:count,after:count})),v.maxLength(6)),
});
export const ArkHistorySchema=v.pipe(v.array(ArkHistoryEntrySchema),v.maxLength(100),v.check(entries=>entries.every((entry,index)=>index===0||entry.revision>entries[index-1]!.revision)));
export type ArkHistoryEntry=v.InferOutput<typeof ArkHistoryEntrySchema>;
