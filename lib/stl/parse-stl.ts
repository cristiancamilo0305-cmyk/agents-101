export type Vec3 = [number, number, number];
export type StlTriangle = [Vec3, Vec3, Vec3];

function isBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  return 84 + triangleCount * 50 === buffer.byteLength;
}

function parseBinaryStl(buffer: ArrayBuffer): StlTriangle[] {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const triangles: StlTriangle[] = [];
  let offset = 84;

  const readVec3 = (): Vec3 => {
    const v: Vec3 = [
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
    ];
    offset += 12;
    return v;
  };

  for (let i = 0; i < triangleCount; i++) {
    offset += 12; // normal (recomputado al analizar, no se usa el de archivo)
    triangles.push([readVec3(), readVec3(), readVec3()]);
    offset += 2; // attribute byte count
  }

  return triangles;
}

function parseAsciiStl(text: string): StlTriangle[] {
  const vertexRegex = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const coords: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = vertexRegex.exec(text))) {
    coords.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
  }

  const triangles: StlTriangle[] = [];
  for (let i = 0; i + 8 < coords.length; i += 9) {
    triangles.push([
      [coords[i], coords[i + 1], coords[i + 2]],
      [coords[i + 3], coords[i + 4], coords[i + 5]],
      [coords[i + 6], coords[i + 7], coords[i + 8]],
    ]);
  }

  return triangles;
}

const MAX_TRIANGLES = 2_000_000;

/** Parsea STL binario o ASCII a una lista de triángulos (cada uno con sus 3 vértices en mm). */
export function parseStl(buffer: ArrayBuffer): StlTriangle[] {
  const triangles = isBinaryStl(buffer)
    ? parseBinaryStl(buffer)
    : parseAsciiStl(new TextDecoder("utf-8").decode(buffer));

  if (triangles.length === 0) {
    throw new Error("El archivo no contiene triángulos válidos. ¿Es un STL exportado correctamente?");
  }
  if (triangles.length > MAX_TRIANGLES) {
    throw new Error(`La malla tiene demasiados triángulos (${triangles.length.toLocaleString()}). Simplifícala antes de subirla.`);
  }

  return triangles;
}
