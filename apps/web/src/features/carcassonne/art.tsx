import { useId } from "react";
import {
  CARCASSONNE_CATALOG,
  rotateCarcassonnePoint,
  type CarcassonneTileKind,
  type CarcassonnePiece,
  type CarcassonneRotation,
} from "@hangul-rummikub/shared";
export function CarcassonneMeepleArt({
  color,
  farmer = false,
  number,
  piece = "NORMAL",
}: {
  color: string;
  farmer?: boolean;
  number?: number;
  piece?: CarcassonnePiece;
}) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="cc-meeple-art">
      <g transform={farmer && piece !== "PIG" ? "rotate(90 24 24)" : ""}>
        <ellipse cx="24" cy="42" rx="16" ry="3" fill="#16281c" opacity=".22" />
        <path
          d={
            piece === "PIG"
              ? "M9 19Q8 8 17 15Q29 9 36 20H44V31H37L34 41H28V34H17L14 41H8V30Q2 29 3 21Z"
              : piece === "BUILDER"
                ? "M18 14V6H30V14L39 20V27H32V36H38V43H10V36H16V27H9V20Z"
                : piece === "BIG"
                  ? "M16 14C10 3 35 0 32 14L46 24L39 33L32 29L38 45H10L16 29L9 33L2 24Z"
                  : "M18 15c-4-6-1-12 6-12s10 6 6 12l12 10-5 7-7-5 5 15H13l5-15-7 5-5-7Z"
          }
          fill={color}
          stroke="#fff2cb"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M20 7q4-3 8 0M12 25l7-6M18 36h12"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          opacity=".3"
        />
        {number !== undefined && (
          <text
            x="24"
            y="29"
            textAnchor="middle"
            fill="#fff"
            fontSize="13"
            fontWeight="800"
          >
            {number}
          </text>
        )}
      </g>
    </svg>
  );
}
export function CarcassonneTileArt({
  kind,
  rotation = 0,
  highlight = [],
  secondaryHighlight = [],
  tokens = [],
}: {
  kind: CarcassonneTileKind;
  rotation?: CarcassonneRotation;
  highlight?: readonly string[];
  secondaryHighlight?: readonly string[];
  tokens?: readonly {
    regionId: string;
    color: string;
    number: number;
    piece?: CarcassonnePiece;
  }[];
}) {
  const id = useId().replace(/:/g, ""),
    tile = CARCASSONNE_CATALOG[kind],
    cities = tile.regions.filter((r) => r.kind === "CITY"),
    roads = tile.regions.filter((r) => r.kind === "ROAD");
  const speck = kind.charCodeAt(0);
  return (
    <svg
      viewBox="0 0 100 100"
      className="cc-tile-art"
      role="img"
      aria-label={tile.label + " 타일 " + rotation + "도"}
    >
      <defs>
        <linearGradient id={id + "grass"} x2="1" y2="1">
          <stop stopColor="#cad491" />
          <stop offset=".52" stopColor="#a7bf76" />
          <stop offset="1" stopColor="#90ab64" />
        </linearGradient>
        <linearGradient id={id + "stone"} x2=".5" y2="1">
          <stop stopColor="#e2cda3" />
          <stop offset="1" stopColor="#c4a477" />
        </linearGradient>
        <pattern
          id={id + "grain"}
          width="9"
          height="11"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m2 4 1-2m3 6 2-1"
            stroke="#536f3b"
            strokeWidth=".6"
            opacity=".2"
          />
          <circle cx="7" cy="2" r=".55" fill="#f8f0cc" opacity=".6" />
        </pattern>
        <mask id={id + "field"}>
          <rect width="100" height="100" fill="white" />
          {cities.map((r) => (
            <path
              key={r.id}
              d={r.path}
              fill="black"
              stroke="black"
              strokeWidth="3"
            />
          ))}
          {roads.map((r) => (
            <path
              key={r.id}
              d={r.path}
              stroke="black"
              strokeWidth="8"
              fill="none"
            />
          ))}
          {tile.regions.some((r) => r.kind === "MONASTERY") && (
            <rect x="28" y="25" width="44" height="42" fill="black" />
          )}
        </mask>
        {cities.map((r) => (
          <clipPath key={r.id} id={id + r.id}>
            <path d={r.path} />
          </clipPath>
        ))}
      </defs>
      <g transform={"rotate(" + rotation + " 50 50)"}>
        <rect width="100" height="100" fill={"url(#" + id + "grass)"} />
        <rect width="100" height="100" fill={"url(#" + id + "grain)"} />
        <g mask={"url(#" + id + "field)"}>
          <path
            d="M0 71Q30 59 58 72T100 69M0 75Q30 63 58 76T100 73"
            stroke="#d9dfa4"
            strokeWidth="1"
            opacity=".55"
            fill="none"
          />
          {Array.from({ length: 9 }, (_, i) => {
            const x = ((speck * 7 + i * 31) % 92) + 4,
              y = ((speck * 11 + i * 23) % 92) + 4;
            return (
              <g key={i} transform={"translate(" + x + " " + y + ")"}>
                <ellipse cy="3" rx="3.4" ry="1.6" fill="#476437" opacity=".2" />
                <path d="M0 3v-6" stroke="#705b37" strokeWidth="1" />
                <path d="M-3 0 0-7 3 0Z" fill={i % 2 ? "#547346" : "#6e8c4f"} />
                <path d="M0-6v5" stroke="#93aa65" strokeWidth=".6" />
              </g>
            );
          })}
        </g>
        {cities.map((r) => (
          <g key={r.id}>
            <path
              d={r.path}
              fill={"url(#" + id + "stone)"}
              stroke="#8b7454"
              strokeWidth="3.4"
            />
            <path d={r.path} fill="none" stroke="#f6e7bc" strokeWidth="1.1" />
            <path
              d={r.path}
              fill="none"
              stroke="#897456"
              strokeWidth="4"
              strokeDasharray="2 4"
            />
            <g clipPath={"url(#" + id + r.id + ")"}>
              {Array.from({ length: 16 }, (_, i) => {
                const x = 10 + (i % 4) * 25 + (i % 2 ? 3 : 0),
                  y = 9 + Math.floor(i / 4) * 25;
                return (
                  <g
                    key={i}
                    transform={
                      "translate(" +
                      x +
                      " " +
                      y +
                      ") rotate(" +
                      (i % 2 ? 9 : -7) +
                      ")"
                    }
                  >
                    <rect
                      x="-6"
                      y="-3"
                      width="12"
                      height="12"
                      rx="1"
                      fill="#9a805d"
                      opacity=".25"
                    />
                    <rect x="-6" y="-7" width="10" height="12" fill="#ecd5a4" />
                    <path
                      d="m-8-7 7-6 7 6Z"
                      fill={i % 3 ? "#ad6447" : "#805c43"}
                    />
                    <path d="M-3-2h3v4h-3Z" fill="#716349" />
                    <path d="m-7-8 6-4" stroke="#da9d69" strokeWidth="1" />
                  </g>
                );
              })}
            </g>
            {r.shields > 0 && (
              <g transform={"translate(" + r.point[0] + " " + r.point[1] + ")"}>
                <path
                  d="M-6-8H6V1Q5 6 0 9Q-5 6-6 1Z"
                  fill="#386685"
                  stroke="#f8e5a5"
                  strokeWidth="1.7"
                />
                <path d="M0-6V6M-4-1H4" stroke="#f8e5a5" strokeWidth="1.5" />
              </g>
            )}
          </g>
        ))}
        {roads.map((r) => (
          <g key={r.id}>
            <path d={r.path} stroke="#7e8a59" strokeWidth="9" fill="none" />
            <path d={r.path} stroke="#f5e7bd" strokeWidth="6.5" fill="none" />
            <path
              d={r.path}
              stroke="#d8c299"
              strokeWidth=".9"
              strokeDasharray="2 3"
              fill="none"
            />
          </g>
        ))}
        {roads.length > 1 && (
          <g>
            <circle cx="50" cy="50" r="7" fill="#c9b084" />
            <path d="M43 52V44l7-5 7 5v8Z" fill="#e8cc91" />
            <path d="m41 44 9-7 9 7Z" fill="#a35f41" />
            <path d="M48 52v-6h4v6" fill="#715f44" />
          </g>
        )}
        {tile.regions.some((r) => r.kind === "MONASTERY") && (
          <g>
            <ellipse
              cx="51"
              cy="63"
              rx="24"
              ry="6"
              fill="#566c3e"
              opacity=".3"
            />
            <path d="M30 40H70V63H30Z" fill="#eee0b5" stroke="#a38d66" />
            <path d="m27 40 22-15 25 15Z" fill="#a46848" />
            <path d="M42 24h14v36H42Z" fill="#f5e7bd" stroke="#a38d66" />
            <path d="m39 24 10-12 10 12Z" fill="#80553e" />
            <path
              d="M47 34v-6h4v6M46 61V49q3-6 6 0v12M34 46h4v6h-4M60 46h4v6h-4"
              fill="#736a4e"
            />
            <path d="M49 13V6m-3 3h6" stroke="#826445" strokeWidth="1.5" />
          </g>
        )}
        {tile.regions
          .filter((r) => r.inn)
          .map((r) => (
            <g
              key={"inn" + r.id}
              transform={`translate(${Math.min(72, r.point[0] + 10)} ${Math.max(8, r.point[1] - 20)})`}
            >
              <ellipse
                cx="0"
                cy="10"
                rx="11"
                ry="8"
                fill="#71b5c0"
                stroke="#326f78"
                strokeWidth="1.3"
              />
              <path d="M-7 1H6V10H-7Z" fill="#f3d8a1" stroke="#6c5842" />
              <path d="M-10 1L-1 -7L9 1Z" fill="#985b45" />
              <path d="M-2 10V5H1V10" fill="#594e3c" />
            </g>
          ))}
        {tile.regions.some((r) => r.cathedral) && (
          <g>
            <path
              d="M27 65V31L35 18L43 31V40H57V31L65 18L73 31V65Z"
              fill="#ede4c9"
              stroke="#776955"
              strokeWidth="1.4"
            />
            <path
              d="M24 31L35 13L46 31M54 31L65 13L76 31M42 40L50 28L58 40"
              fill="#6b7790"
              stroke="#475b68"
            />
            <path
              d="M45 65V51Q50 42 55 51V65M31 34H38V43H31M61 34H68V43H61"
              fill="#485e6a"
            />
            <path d="M50 25V17M46 20H54" stroke="#e6be61" strokeWidth="2" />
          </g>
        )}
        {tile.regions
          .filter((r) => r.goods)
          .map((r) => (
            <g
              key={"goods" + r.id}
              transform={`translate(${Math.min(82, Math.max(18, r.point[0]))} ${Math.min(80, Math.max(20, r.point[1] + 14))})`}
            >
              <path
                d="M-9 -8L0 -13L9 -8V10H-9Z"
                fill="#fff0c5"
                stroke="#745934"
                strokeWidth="1.3"
              />
              {r.goods === "WINE" ? (
                <g>
                  <path
                    d="M-4 -6Q-7 0 -4 6H4Q7 0 4 -6Z"
                    fill="#a06d43"
                    stroke="#65492f"
                  />
                  <path d="M-5 -3H5M-5 3H5" stroke="#e3c58c" />
                </g>
              ) : r.goods === "GRAIN" ? (
                <g stroke="#95712e" strokeWidth="1.8">
                  <path d="M0 7V-8M0 -3L-4 -6M0 1L4 -3M0 4L-4 1" />
                </g>
              ) : (
                <path
                  d="M-6 -6L0 -3L5 -6L6 6L0 8L-6 4Z"
                  fill="#b44951"
                  stroke="#753f42"
                />
              )}
            </g>
          ))}
        {(kind === "HB" || kind === "HC") && (
          <g>
            <path
              d="M37 47Q50 37 63 47M37 54Q50 44 63 54"
              fill="none"
              stroke="#8f6945"
              strokeWidth="2"
            />
            <path d="M37 45V56M63 45V56" stroke="#806244" strokeWidth="3" />
          </g>
        )}
        {kind.length > 1 && (
          <text
            x="94"
            y="95"
            textAnchor="end"
            fontSize="6"
            fill="#31472e"
            fontWeight="bold"
          >
            {kind.startsWith("E") ? "I" : "II"}
          </text>
        )}
        {tile.regions
          .filter(
            (r) =>
              highlight.includes(r.id) || secondaryHighlight.includes(r.id),
          )
          .map((r) => (
            <path
              key={r.id}
              d={r.path}
              mask={r.kind === "FIELD" ? "url(#" + id + "field)" : undefined}
              fill={
                r.kind === "ROAD"
                  ? "none"
                  : secondaryHighlight.includes(r.id)
                    ? "#79d6e5"
                    : "#fff397"
              }
              fillOpacity=".45"
              stroke={secondaryHighlight.includes(r.id) ? "#136578" : "#fff7ba"}
              strokeWidth={r.kind === "ROAD" ? 5 : 2.2}
              strokeDasharray={r.kind === "ROAD" ? undefined : "4 2"}
            />
          ))}
        <rect
          x=".6"
          y=".6"
          width="98.8"
          height="98.8"
          fill="none"
          stroke="#f5eac5"
          strokeWidth="1.2"
          opacity=".7"
        />
      </g>
      {tokens.map((token, i) => {
        const region = tile.regions.find((r) => r.id === token.regionId);
        if (!region) return null;
        const [x, y] = rotateCarcassonnePoint(region.point, rotation);
        return (
          <svg
            key={i}
            x={Math.min(72, Math.max(0, x - 14))}
            y={Math.min(72, Math.max(0, y - 14))}
            width="28"
            height="28"
          >
            <CarcassonneMeepleArt
              color={token.color}
              piece={token.piece ?? "NORMAL"}
              farmer={region.kind === "FIELD"}
              number={token.number}
            />
          </svg>
        );
      })}
    </svg>
  );
}
