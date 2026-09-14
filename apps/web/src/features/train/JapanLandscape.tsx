/** Original schematic archipelago. All playable links use ordinary route rules. */
export function JapanLandscape() {
    return <>
        <g fill="url(#tr-land)" stroke="#78978c" strokeWidth="3">
            <path d="M815 60L904 38 976 62 1045 60 1130 127 1100 210 992 191 935 239 900 289 818 273 785 235 816 188 797 116Z"/>
            <path d="M760 302L849 304 941 336 975 424 957 530 890 637 1010 676 1046 731 1055 860 1020 921 944 960 829 944 685 971 579 962 537 1017 464 994 370 976 300 958 223 1000 182 1090 88 1103 61 1030 75 951 101 891 230 840 241 752 320 692 428 649 448 593 565 563 640 494 708 407Z"/>
            <path d="M170 1118L246 1134 295 1100 395 1112 436 1168 399 1244 426 1340 380 1471 303 1475 265 1402 210 1381 156 1349 66 1368 35 1304 99 1231 114 1156Z"/>
            <path d="M423 1041L497 999 567 969 641 1002 709 1016 797 1065 791 1134 704 1171 655 1241 590 1257 521 1170 435 1151 402 1107Z"/>
        </g>
        <rect width="1200" height="1500" fill="url(#tr-paper)"/>
        <g fill="none" stroke="#a39572" strokeWidth="2" opacity=".28">
            {[[875,160],[830,440],[780,560],[690,680],[600,745],[550,900],[235,1200]].map(([x=0,y=0]) => <path key={`${x}:${y}`} d={`M${x-22} ${y+15}l22 -40 24 40M${x-5} ${y-15}l5 -10 6 12`}/>)}
            <path d="M833 822l31 -54 34 54M852 790l12 -22 15 24 -15 -6Z" fill="#faf6e6"/>
        </g>
        <g fill="#657f79" opacity=".7" fontFamily="Georgia,serif" fontStyle="italic">
            <text x="380" y="380" fontSize="31" textAnchor="middle">Sea of Japan</text>
            <text x="1000" y="1190" fontSize="32" textAnchor="middle">Pacific Ocean</text>
            <text x="1000" y="1220" fontSize="16" textAnchor="middle">태평양</text>
            <text x="175" y="1440" fontSize="18" textAnchor="middle">KYUSHU</text>
            <text x="570" y="1320" fontSize="18" textAnchor="middle">SHIKOKU</text>
        </g>
        <g transform="translate(100 110)">
            <path d="M0 0H425M0 105H425" stroke="#ad8b59"/>
            <text x="212" y="49" textAnchor="middle" fill="#425d58" fontSize="40" letterSpacing="10">JAPAN</text>
            <text x="212" y="83" textAnchor="middle" fill="#76674f" fontSize="17">일본 창작 지도 · 벚꽃 따라 잇는 여정</text>
        </g>
        <g fill="#d5a6a4" opacity=".45">
            {[0,1,2,3,4].map(i => <circle key={i} cx={130+Math.cos(i*1.2566)*13} cy={290+Math.sin(i*1.2566)*13} r="10"/>)}
        </g>
    </>;
}
