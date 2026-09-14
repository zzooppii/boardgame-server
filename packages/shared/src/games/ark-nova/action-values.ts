/** Shared public track calculations. Callers validate inputs; the server owns action admission. */
export const arkReputationRange=(reputation:number):number=>reputation<2?1:reputation<4?2:reputation<7?3:reputation<10?4:reputation<13?5:6;
export const arkActionStrength=(position:number,xSpent:number,constriction:boolean):number=>position+xSpent-(constriction?2:0);
