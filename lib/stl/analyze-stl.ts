import type { StlTriangle, Vec3 } from "@/lib/stl/parse-stl";

const PRINTERS = [
  { name: "A1 / A1 Combo", volumeMm: 256 },
  { name: "A1 mini", volumeMm: 180 },
] as const;

export type StlReport = {
  triangles: number;
  vertices: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  degenerateTriangles: number;
  isWatertight: boolean;
  boundingBoxMm: { x: number; y: number; z: number };
  volumeCm3: number;
  fitsPrinter: Record<string, boolean>;
  warnings: string[];
  suggestions: string[];
};

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/** Funde vértices casi idénticos (redondeo a 1/10000 mm) para poder detectar aristas compartidas entre triángulos. */
function quantizeKey(v: Vec3): string {
  const p = 1e4;
  return `${Math.round(v[0] * p)}_${Math.round(v[1] * p)}_${Math.round(v[2] * p)}`;
}

function buildIndexedMesh(triangles: StlTriangle[]) {
  const vertexMap = new Map<string, number>();
  const vertices: Vec3[] = [];
  const indices: [number, number, number][] = [];

  const indexOf = (v: Vec3): number => {
    const key = quantizeKey(v);
    let idx = vertexMap.get(key);
    if (idx === undefined) {
      idx = vertices.length;
      vertices.push(v);
      vertexMap.set(key, idx);
    }
    return idx;
  };

  for (const [v0, v1, v2] of triangles) {
    indices.push([indexOf(v0), indexOf(v1), indexOf(v2)]);
  }

  return { vertices, indices };
}

function analyzeEdges(indices: [number, number, number][]) {
  const edgeCounts = new Map<string, number>();
  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  };

  for (const [a, b, c] of indices) {
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  let boundary = 0;
  let nonManifold = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundary++;
    else if (count > 2) nonManifold++;
  }

  return { boundary, nonManifold };
}

function analyzeGeometry(vertices: Vec3[], indices: [number, number, number][]) {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of vertices) {
    for (let axis = 0; axis < 3; axis++) {
      if (v[axis] < min[axis]) min[axis] = v[axis];
      if (v[axis] > max[axis]) max[axis] = v[axis];
    }
  }

  let degenerate = 0;
  let signedVolume6 = 0;
  for (const [ia, ib, ic] of indices) {
    const a = vertices[ia];
    const b = vertices[ib];
    const c = vertices[ic];
    const area = length(cross(sub(b, a), sub(c, a))) / 2;
    if (area < 1e-6) degenerate++;
    signedVolume6 += dot(a, cross(b, c));
  }

  return {
    degenerate,
    isInverted: signedVolume6 < 0,
    volumeCm3: Math.abs(signedVolume6) / 6 / 1000,
    boundingBoxMm: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] },
  };
}

export function analyzeStl(triangles: StlTriangle[]): StlReport {
  const { vertices, indices } = buildIndexedMesh(triangles);
  const edges = analyzeEdges(indices);
  const geometry = analyzeGeometry(vertices, indices);
  const { x, y, z } = geometry.boundingBoxMm;
  const maxDim = Math.max(x, y, z);

  const fitsPrinter = Object.fromEntries(
    PRINTERS.map((p) => [p.name, x <= p.volumeMm && y <= p.volumeMm && z <= p.volumeMm]),
  );

  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (edges.boundary > 0) {
    warnings.push(`Malla no cerrada: ${edges.boundary} borde(s) abierto(s) (posibles agujeros).`);
    suggestions.push(
      "Repara agujeros: en Bambu Studio clic derecho al modelo → Fix model, o en Blender → 3D Print Toolbox → Make Manifold.",
    );
  }
  if (edges.nonManifold > 0) {
    warnings.push(`${edges.nonManifold} arista(s) no-manifold (compartidas por más de 2 caras).`);
    suggestions.push("Limpia la geometría en Blender (3D Print Toolbox) o Meshmixer (Analysis → Inspector).");
  }
  if (geometry.degenerate > 0) {
    warnings.push(`${geometry.degenerate} triángulo(s) degenerado(s) (área casi cero).`);
    suggestions.push("Aplica un Remesh o Decimate suave en Blender para limpiar triángulos degenerados.");
  }
  if (geometry.isInverted) {
    warnings.push("El volumen calculado da negativo — posibles normales invertidas.");
    suggestions.push("En Blender: selecciona todo (A) y usa Shift+N (Recalculate Normals).");
  }
  if (maxDim < 5) {
    warnings.push(`El modelo mide apenas ${maxDim.toFixed(2)} mm en su lado más largo.`);
    suggestions.push("Si el diseño se hizo en metros, revisa la escala antes de exportar (1 m ≠ 1 mm).");
  }
  if (!Object.values(fitsPrinter).some(Boolean)) {
    warnings.push(`El modelo (${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)} mm) no cabe en ninguna impresora Bambu A1.`);
    suggestions.push("Escala el modelo o divídelo en piezas para imprimir por partes.");
  }

  return {
    triangles: triangles.length,
    vertices: vertices.length,
    boundaryEdges: edges.boundary,
    nonManifoldEdges: edges.nonManifold,
    degenerateTriangles: geometry.degenerate,
    isWatertight: edges.boundary === 0 && edges.nonManifold === 0,
    boundingBoxMm: geometry.boundingBoxMm,
    volumeCm3: geometry.volumeCm3,
    fitsPrinter,
    warnings,
    suggestions,
  };
}
