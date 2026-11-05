"use client";
import { FILL_MN, SHAPE_MN, type Fig, type Fill, type Glyph, type Grid, type Iso, type Seq, type Shape, type Stem } from "@/lib/figures";
import { useApp } from "./Providers";

const INK = "var(--violet)";

function shapeEl(shape: Shape, fill: Fill) {
  const common =
    fill === "solid"
      ? { fill: INK, stroke: INK, strokeWidth: 3 }
      : fill === "light"
        ? { fill: INK, fillOpacity: 0.28, stroke: INK, strokeWidth: 3 }
        : { fill: "none", stroke: INK, strokeWidth: 3.5 };
  switch (shape) {
    case "square": return <rect x="12" y="12" width="36" height="36" rx="3" {...common} />;
    case "circle": return <circle cx="30" cy="30" r="18" {...common} />;
    case "triangle": return <polygon points="30,9 51,49 9,49" strokeLinejoin="round" {...common} />;
    case "diamond": return <polygon points="30,7 53,30 30,53 7,30" strokeLinejoin="round" {...common} />;
    case "star": return <polygon points="30,7 36.5,22.5 53,24 40.5,35 44.5,52 30,43 15.5,52 19.5,35 7,24 23.5,22.5" strokeLinejoin="round" {...common} />;
    case "cross": return <polygon points="22,9 38,9 38,22 51,22 51,38 38,38 38,51 22,51 22,38 9,38 9,22 22,22" strokeLinejoin="round" {...common} />;
    case "arrow": return <polygon points="30,6 49,27 36,27 36,53 24,53 24,27 11,27" strokeLinejoin="round" {...common} />;
  }
}

function GlyphSvg({ g, size }: { g: Glyph; size: number }) {
  const { lang } = useApp();
  const n = Math.max(1, g.n ?? 1);
  const fill = g.fill ?? "solid";
  const rot = g.rot ?? 0;
  const rotates = g.shape === "arrow" || g.shape === "triangle";
  const one = (key: string, tx: number, ty: number, scale: number) => (
    <g key={key} transform={`translate(${tx} ${ty}) scale(${scale})`}>
      <g transform={rotates ? `rotate(${rot} 30 30)` : undefined}>{shapeEl(g.shape, fill)}</g>
    </g>
  );
  let kids: React.ReactNode;
  if (n === 1) kids = one("a", 0, 0, 1);
  else {
    const cols = n <= 3 ? n : Math.ceil(n / 2);
    const rows = n <= 3 ? 1 : 2;
    const cell = 60 / Math.max(cols, 2);
    const scale = cell / 60;
    const top = (60 - rows * cell) / 2;
    kids = Array.from({ length: n }, (_, i) => {
      const r = n <= 3 ? 0 : Math.floor(i / cols);
      const c = n <= 3 ? i : i % cols;
      const inRow = n <= 3 ? n : r === 0 ? cols : n - cols;
      const left = (60 - inRow * cell) / 2;
      return one(String(i), left + c * cell, top + r * cell, scale);
    });
  }
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" role="img" aria-label={lang === "mn" ? `${SHAPE_MN[g.shape]}${rotates ? `, ${rot}°-аар эргүүлсэн` : ""}${n > 1 ? `, ${n} хувь` : ""}, ${FILL_MN[fill]}` : `${g.shape}${rotates ? ` rotated ${rot} degrees` : ""}${n > 1 ? `, ${n} copies` : ""}, ${fill}`}>
      {kids}
    </svg>
  );
}

function GridSvg({ g, size }: { g: Grid; size: number }) {
  const { lang } = useApp();
  const rows = g.cells.length;
  const cols = g.cells[0].length;
  const unit = 10;
  const scale = size / (Math.max(rows, cols) * unit);
  return (
    <svg width={cols * unit * scale} height={rows * unit * scale} viewBox={`0 0 ${cols * unit} ${rows * unit}`} role="img" aria-label={lang === "mn" ? `${rows}×${cols} торны дүрс` : `${rows} by ${cols} grid shape`}>
      {g.cells.flatMap((row, r) =>
        row.map((v, c) =>
          v ? (
            <rect key={`${r}-${c}`} x={c * unit + 0.8} y={r * unit + 0.8} width={unit - 1.6} height={unit - 1.6} rx="1.6" fill={INK} />
          ) : g.full ? (
            <rect key={`${r}-${c}`} x={c * unit + 0.8} y={r * unit + 0.8} width={unit - 1.6} height={unit - 1.6} rx="1.6" fill="none" stroke="var(--border)" strokeWidth="0.8" />
          ) : null,
        ),
      )}
    </svg>
  );
}

/**
 * Isometric cube stack. Cubes are painted back-to-front (increasing x + y, then z) so nearer cubes occlude
 * farther ones. The accessible name deliberately does not reveal the cube count.
 */
function IsoSvg({ f, size }: { f: Iso; size: number }) {
  const { lang } = useApp();
  const W = 28, H = 14, Z = 15;
  const cubes: { sx: number; sy: number }[] = [];
  const rows = f.heights.length, cols = f.heights[0].length;
  for (let s = 0; s <= rows + cols - 2; s++) {
    for (let y = 0; y < rows; y++) {
      const x = s - y;
      if (x < 0 || x >= cols) continue;
      for (let z = 0; z < f.heights[y][x]; z++) cubes.push({ sx: ((x - y) * W) / 2, sy: ((x + y) * H) / 2 - (z + 1) * Z });
    }
  }
  const xs = cubes.flatMap((c) => [c.sx - W / 2, c.sx + W / 2]);
  const ys = cubes.flatMap((c) => [c.sy - H / 2, c.sy + H / 2 + Z]);
  const pad = 3;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const vw = Math.max(...xs) - minX + pad, vh = Math.max(...ys) - minY + pad;
  const k = size / Math.max(vw, vh);
  const pts = (...p: number[][]) => p.map((q) => q.join(",")).join(" ");
  return (
    <svg width={vw * k} height={vh * k} viewBox={`${minX} ${minY} ${vw} ${vh}`} role="img" aria-label={lang === "mn" ? "шооны бүтэц (изометр харагдац)" : "isometric cube structure"}>
      {cubes.map(({ sx, sy }, i) => (
        <g key={i} stroke="rgba(0,0,0,0.4)" strokeWidth="0.9" strokeLinejoin="round">
          <polygon points={pts([sx - W / 2, sy], [sx, sy + H / 2], [sx, sy + H / 2 + Z], [sx - W / 2, sy + Z])} style={{ fill: "var(--violet)" }} />
          <polygon points={pts([sx, sy + H / 2], [sx + W / 2, sy], [sx + W / 2, sy + Z], [sx, sy + H / 2 + Z])} style={{ fill: "color-mix(in srgb, var(--violet) 62%, black)" }} />
          <polygon points={pts([sx, sy - H / 2], [sx + W / 2, sy], [sx, sy + H / 2], [sx - W / 2, sy])} style={{ fill: "color-mix(in srgb, var(--violet) 52%, white)" }} />
        </g>
      ))}
    </svg>
  );
}

export function FigureView({ fig, size = 72 }: { fig: Fig; size?: number }) {
  if (fig.k === "glyph") return <GlyphSvg g={fig} size={size} />;
  if (fig.k === "iso") return <IsoSvg f={fig} size={size} />;
  return <GridSvg g={fig} size={size} />;
}

function SeqView({ seq }: { seq: Seq }) {
  const { lang } = useApp();
  const many = seq.items.length > 5;
  const size = many ? 56 : 72;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {seq.items.map((f, i) => (
        <div key={i} className="grid place-items-center rounded-xl border border-line bg-deep p-2" style={{ width: size + 16, height: size + 16 }}>
          {f ? <FigureView fig={f} size={size} /> : <span role="img" className="font-display text-3xl font-bold text-cyan-fg" aria-label={lang === "mn" ? "дутуу дүрс" : "missing figure"}>?</span>}
        </div>
      ))}
    </div>
  );
}

export function StemView({ stem }: { stem: Stem }) {
  if (stem.k === "seq") return <SeqView seq={stem} />;
  if (stem.k === "reaction") return null; // rendered by the test runner as pads, not as a picture
  return (
    <div className="mx-auto grid w-fit place-items-center rounded-xl border border-line bg-deep p-4">
      <FigureView fig={stem} size={120} />
    </div>
  );
}
