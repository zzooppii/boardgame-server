/** A numbered flag distinguishes reservations from completed tiles without relying on color. */
export function LandClaimMarker({color,seat}:{color:string;seat:number}){
 return <g className="tm-land-claim" aria-hidden="true"><path d="M-14 20V-8L15-8V9H-14" fill={color} stroke="#191d22" strokeWidth="3" strokeLinejoin="round"/><text x="0" y="5" textAnchor="middle" fill="#191d22" fontSize="13" fontWeight="800">{seat}</text></g>;
}
