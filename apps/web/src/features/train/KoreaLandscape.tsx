/** Original schematic mainland illustration; route geometry is rendered separately. */
export function KoreaLandscape() {
    return <>
        <path d="M120 95Q245 60 340 98L450 75 545 103 650 55 723 62Q746 138 810 205L841 320 893 397 938 474 1022 522Q1117 580 1085 698L1042 771 1067 842 1040 947 1016 1045 946 1098 865 1057 778 1060 722 1020 660 1066 629 1173 570 1191 530 1110 480 1122 441 1107 390 1142 350 1100 283 1126 255 1074 194 1111 145 1090 74 1108 58 1060 80 1005 60 940 87 894 65 852 98 805 78 750 105 689 85 641 105 599 87 539 105 505 87 443 113 400 93 356 118 320 99 279 144 219Z" fill="url(#tr-land)" stroke="#789785" strokeWidth="3"/>
        <path d="M360 108Q435 315 425 457T520 725Q570 880 700 1000" fill="none" stroke="#d4b279" strokeWidth="130" opacity=".08"/>
        <rect width="1200" height="1250" fill="url(#tr-paper)"/>
        <g fill="none" stroke="#9aab83" strokeWidth="1.7" opacity=".33">
            {Array.from({length: 17}, (_, index) => {
                const x = 610 + index * 15, y = 190 + index * 31;
                return <path key={index} d={`M${x - 27} ${y + 24}l27 -47 31 47M${x - 7} ${y - 10}l7 -13 9 15`}/>;
            })}
            <path d="M570 327Q475 318 435 296T320 290Q237 267 145 329" stroke="#609da9" strokeWidth="7"/>
            <path d="M795 604Q740 629 754 721T742 860Q750 951 928 1031" stroke="#609da9" strokeWidth="6"/>
            <path d="M515 626Q485 719 358 704T215 725" stroke="#609da9" strokeWidth="5"/>
        </g>
        <g fill="#7f9b91" opacity=".55">
            <ellipse cx="82" cy="675" rx="9" ry="17" transform="rotate(24 82 675)"/>
            <ellipse cx="48" cy="907" rx="12" ry="21" transform="rotate(-32 48 907)"/>
            <ellipse cx="172" cy="1150" rx="23" ry="9"/>
            <ellipse cx="350" cy="1160" rx="17" ry="8"/>
            <ellipse cx="737" cy="1105" rx="10" ry="18"/>
            <ellipse cx="862" cy="1119" rx="19" ry="8"/>
        </g>
        <g fill="#526f67" opacity=".72" fontFamily="Georgia,serif" fontStyle="italic">
            <text x="940" y="160" fontSize="28" textAnchor="middle">East Sea</text>
            <text x="940" y="186" fontSize="13" textAnchor="middle">동 해</text>
            <text x="42" y="600" fontSize="23" transform="rotate(-90 42 600)">Yellow Sea · 서해</text>
            <text x="810" y="1188" fontSize="24" textAnchor="middle">South Sea · 남해</text>
        </g>
        <g transform="translate(875 55)">
            <path d="M0 0H255M0 58H255" stroke="#a78a53" strokeWidth="1"/>
            <text x="127" y="26" fill="#405b4e" fontSize="21" letterSpacing="6" textAnchor="middle">KOREA</text>
            <text x="127" y="45" fill="#776646" fontSize="12" textAnchor="middle">한국 창작 지도 · 철도로 잇는 여정</text>
        </g>
    </>;
}
