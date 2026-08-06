import { NextResponse } from "next/server";
import { createImageToModelTask, uploadImageToTripo } from "@/lib/tripo3d";

const MAX_FILE_MB = 15;

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 });
  }

  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  if (!isPng && !isJpeg) {
    return NextResponse.json({ error: "Solo se aceptan imágenes JPEG o PNG." }, { status: 400 });
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Máximo ${MAX_FILE_MB} MB.` }, { status: 400 });
  }

  try {
    const imageToken = await uploadImageToTripo(file);
    const taskId = await createImageToModelTask(imageToken, isPng ? "png" : "jpg");
    return NextResponse.json({ taskId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo iniciar la generación 3D.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
