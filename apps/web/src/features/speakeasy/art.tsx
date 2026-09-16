import type {SpeakeasyBuildingKind} from '@hangul-rummikub/shared';

export function SpeakeasyBuildingArt({kind, ghost = false}: {kind: SpeakeasyBuildingKind; ghost?: boolean}) {
  const tall = kind === 'CASINO' || kind === 'NIGHTCLUB';
  return <svg className={`sp-building-art ${ghost ? 'is-ghost' : ''}`} viewBox="0 0 80 86" aria-hidden="true">
    <ellipse cx="41" cy="78" rx="31" ry="5" fill="#263b3526"/>
    <path d={`M12 ${tall ? 24 : 38} 40 ${tall ? 14 : 28} 68 ${tall ? 24 : 38}V70L40 80 12 70Z`} fill="currentColor" stroke="#32423a" strokeWidth="1.2"/>
    <path d={`M40 ${tall ? 34 : 48} 68 ${tall ? 24 : 38}V70L40 80Z`} fill="#172f3244"/>
    <path d={`M12 ${tall ? 24 : 38} 40 ${tall ? 14 : 28} 68 ${tall ? 24 : 38} 40 ${tall ? 34 : 48}Z`} fill="#f5e9c6" stroke="#32423a" strokeWidth="1.2"/>
    {[0, 1, 2].map(i => <g key={i}><path d={`M${18 + i * 7} ${tall ? 35 : 49}v9l4 1.5v-9Z`} fill="#ffe8a5"/><path d={`M${46 + i * 7} ${tall ? 38 : 52}v9l4-1.5v-9Z`} fill="#ffe8a5"/></g>)}
    {tall && [0, 1, 2].map(i => <path key={i} d={`M${18 + i * 7} 51v9l4 1.5v-9Z`} fill="#ffe8a5"/>)}
    <path d="M28 66v10l8 3V68Z" fill="#293b35"/>
    {kind === 'SPEAKEASY' && <path d="M12 47 40 57v5L12 52Z" fill="#e6cf95"/>}
    {kind === 'CASINO' && <><path d="M37 4h6v17h-6Z" fill="#ca9a4b"/><path d="m40 3 3 5-3 5-3-5Z" fill="#edc679"/></>}
    {kind === 'NIGHTCLUB' && <><path d="M20 10v24M20 10l9-3v20" fill="none" stroke="#cf9b45" strokeWidth="3"/><ellipse cx="17" cy="34" rx="5" ry="3" fill="#cf9b45"/><ellipse cx="26" cy="27" rx="5" ry="3" fill="#cf9b45"/></>}
    {kind === 'STILLS' && <><path d="M21 17v26l9 3V14Z" fill="#b28c69" stroke="#32423a"/><ellipse cx="25.5" cy="16" rx="4.5" ry="2.5" fill="#e3c4a0"/><path d="M24 8q-4-3 0-6" fill="none" stroke="#7a8b8466" strokeWidth="3"/></>}
  </svg>;
}
export function SpeakeasyToken({kind}: {kind: 'BARREL' | 'FAMILY' | 'COP' | 'TRUCK' | 'BOOK'}) {
  return <svg viewBox="0 0 32 32" className="sp-token-art" aria-hidden="true">
    {kind === 'BARREL' ? <><path d="M9 6Q16 3 23 6L25 25Q16 30 7 25Z" fill="#a97b45" stroke="#4d4133"/><path d="M8 11h16M7 23h18M12 6l-1 20M20 6l1 20" stroke="#ecd4a4" strokeWidth="2"/></>
      : kind === 'FAMILY' ? <><circle cx="16" cy="7" r="4" fill="currentColor"/><path d="m11 12-5 9 4 2 2-4-1 11h10l-1-11 2 4 4-2-5-9Z" fill="currentColor"/></>
      : kind === 'COP' ? <><path d="m7 10-2-5L16 1l11 4-2 5Z" fill="#33475c"/><circle cx="16" cy="12" r="5" fill="#c9aa7e"/><path d="M8 20q8-7 16 0v10H8Z" fill="#33475c"/><path d="m20 19 2 3-2 3-2-3Z" fill="#e5c776"/></>
      : kind === 'TRUCK' ? <><path d="M2 10h17v13H2ZM19 15h7l4 5v3H19Z" fill="currentColor"/><path d="M21 16h4l3 4h-7Z" fill="#e5ddb9"/><circle cx="8" cy="25" r="4" fill="#263733"/><circle cx="25" cy="25" r="4" fill="#263733"/><circle cx="8" cy="25" r="1.6" fill="#e5ddb9"/><circle cx="25" cy="25" r="1.6" fill="#e5ddb9"/></>
      : <><path d="M4 5h24v24H4Z" fill="#b3985f" stroke="#4c4432"/><path d="M8 5v24M12 10h12M12 15h12M12 20h8" stroke="#efdfb7" strokeWidth="2"/></>}
  </svg>;
}
