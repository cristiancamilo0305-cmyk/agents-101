import { NextResponse } from "next/server";
import { analyzeStl } from "@/lib/stl/analyze-stl";
import { parseStl } from "@/lib/stl/parse-stl";

const MAX_FILE_MB = 50;

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (!/\.stl$/i.test(file.name)) {
    return NextResponse.json({ error: "Solo se aceptan archivos .stl" }, { status: 400 });
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Máximo ${MAX_FILE_MB} MB por archivo.` }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const triangles = parseStl(buffer);
    const report = analyzeStl(triangles);
    return NextResponse.json({ fileName: file.name, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo analizar el archivo STL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
