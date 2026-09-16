import {useId} from "react";
import type {GreatKingdomCastle} from "@hangul-rummikub/shared";
export function Castle({color, ghost = false}: {color: GreatKingdomCastle['color']; ghost?: boolean}) {
  const id = useId();
  return <svg className={`gk-castle gk-${color.toLowerCase()} ${ghost ? 'gk-ghost' : ''}`} viewBox="0 0 84 90" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" x2=".85" y2="1"><stop stopColor="var(--castle-light)"/><stop offset="1" stopColor="var(--castle-main)"/></linearGradient></defs>
    <ellipse cx="43" cy="79" rx="29" ry="7" fill="#172d3a" opacity=".18"/>
    <path d="m14 68 41-7 18 13-42 10-19-8Z" fill="var(--castle-dark)"/>
    <path d="M20 35 57 27v43l-37 8Z" fill={`url(#${id})`}/><path d="m57 27 13 9v40l-13-6Z" fill="var(--castle-dark)"/>
    <path d="m19 27 9-2v10l7-2V22l9-2v11l7-2V18l9 6v16l-41 9Z" fill={`url(#${id})`} stroke="var(--castle-light)" strokeWidth="1.1"/>
    <path d="m60 24 11 9v14l-11-7Z" fill="var(--castle-dark)"/>
    <path d="M33 75V60c0-10 13-13 13-3v15Z" fill="var(--castle-dark)"/>
    <path d="M37 62v10l5-1V60c0-3-5-2-5 2Z" fill="#142e3a" opacity=".7"/>
    <path d="m24 49 3-.6v11l-3 .6Zm28-6 3-.6v11l-3 .6Z" fill="var(--castle-light)" opacity=".9"/>
    {color === 'NEUTRAL' ? <path d="m43 4 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z" fill="var(--castle-light)" stroke="var(--castle-dark)"/> : <><path d="M43 27V5" stroke="var(--castle-dark)" strokeWidth="2"/><path d="m44 5 17 2-6 6 6 4-17-2Z" fill="var(--castle-light)"/>{color === 'BLUE' ? <circle cx="49" cy="10" r="2" fill="var(--castle-dark)"/> : <path d="m49 7 3 3-3 3-3-3Z" fill="var(--castle-dark)"/>}</>}
  </svg>;
}
export function KingdomIllustration() {
  return <div className="gk-illustration" aria-hidden="true"><div className="gk-mini-board"><span/><span/><span/><span/><span/><span/><span/><span/><span/></div><div className="gk-hero-blue"><Castle color="BLUE"/></div><div className="gk-hero-neutral"><Castle color="NEUTRAL"/></div><div className="gk-hero-orange"><Castle color="ORANGE"/></div><span className="gk-hero-caption">하나의 성, 수많은 가능성</span></div>;
}
