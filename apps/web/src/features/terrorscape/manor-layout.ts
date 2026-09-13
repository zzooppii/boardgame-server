import type {TerrorRoom} from '@hangul-rummikub/shared';
// Top-down layout transcribed from the user's base-game board photo.
// Coordinates describe presentation only; shared board.ts owns legal adjacency.
export type Point=readonly [number,number];
export const MANOR_ROOMS:Record<TerrorRoom,{polygon:string;label:Point;furniture:Point}>={
 B1:{polygon:'60,0 335,0 335,150 270,230 60,230',label:[190,193],furniture:[190,90]},
 B2:{polygon:'335,0 615,0 615,150 690,150 690,280 400,280 350,310 270,230 335,150',label:[505,247],furniture:[470,115]},
 B3:{polygon:'615,0 925,0 925,150 615,150',label:[770,120],furniture:[770,55]},
 B4:{polygon:'925,0 1080,0 1155,80 1155,220 1000,220 925,150',label:[1040,188],furniture:[1040,95]},
 B5:{polygon:'690,150 925,150 990,220 990,490 925,550 690,550',label:[837,513],furniture:[835,320]},
 R1:{polygon:'60,230 270,230 350,310 350,430 270,510 60,510 0,450 0,290',label:[175,469],furniture:[175,355]},
 R2:{polygon:'60,510 270,510 270,540 350,620 350,730 130,730 60,660',label:[210,696],furniture:[185,600]},
 R3:{polygon:'350,310 400,280 690,280 690,420 500,420 500,470 350,620 270,540 270,510 350,430',label:[548,383],furniture:[540,320]},
 R4:{polygon:'500,420 690,420 690,610 500,610 430,540 500,470',label:[586,574],furniture:[570,483]},
 R5:{polygon:'350,620 430,540 500,610 690,610 690,730 350,730',label:[540,696],furniture:[555,640]},
 G1:{polygon:'210,730 540,730 540,840 280,840 210,790',label:[397,811],furniture:[395,765]},
 G2:{polygon:'540,730 850,730 850,840 540,840',label:[700,811],furniture:[665,770]},
 G3:{polygon:'925,550 990,490 1020,490 1100,580 1220,585 1220,820 1170,840 850,840 850,730 925,700',label:[1087,805],furniture:[1100,706]},
 G4:{polygon:'690,550 925,550 925,700 850,730 690,730',label:[802,693],furniture:[800,608]},
 G5:{polygon:'990,220 1155,220 1220,290 1220,585 1100,580 1020,490 990,490',label:[1103,529],furniture:[1110,346]},
};
// Centers and orientation of the 17 physical doors. Outdoor boundaries are not doors.
export const MANOR_DOORS:Record<string,{at:Point;angle:number}>={
 'B1-B2':{at:[335,75],angle:90},'B1-R1':{at:[160,230],angle:0},
 'B2-B3':{at:[615,75],angle:90},'B3-B4':{at:[925,75],angle:90},
 'B4-G5':{at:[1070,220],angle:0},'B2-R1':{at:[310,270],angle:45},
 'B2-B5':{at:[690,215],angle:90},'B5-R3':{at:[690,350],angle:90},
 'B5-R4':{at:[690,482],angle:90},'R1-R3':{at:[310,470],angle:-45},
 'R1-R2':{at:[160,510],angle:0},'R2-R3':{at:[310,580],angle:45},
 'R2-R5':{at:[350,675],angle:90},'R4-R5':{at:[590,610],angle:0},
 'G4-R5':{at:[690,674],angle:90},'G3-G4':{at:[925,631],angle:90},
 'G1-R2':{at:[278,730],angle:0},
};
export const MANOR_OUTDOOR:Record<string,Point>={'G1-G2':[540,785],'G2-G3':[850,785],'G3-G5':[1110,579]};
