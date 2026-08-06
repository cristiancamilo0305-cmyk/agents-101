import { NextResponse } from "next/server";
import { createConvertTask } from "@/lib/tripo3d";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const taskId = body?.taskId;

  if (!taskId || typeof taskId !== "string") {
    return NextResponse.json({ error: "Falta el taskId del modelo a convertir." }, { status: 400 });
  }

  try {
    const convertTaskId = await createConvertTask(taskId, "STL");
    return NextResponse.json({ taskId: convertTaskId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo iniciar la conversión a STL.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
