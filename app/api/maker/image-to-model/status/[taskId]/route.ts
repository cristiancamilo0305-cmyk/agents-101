import { NextResponse } from "next/server";
import { getTripoTaskStatus } from "@/lib/tripo3d";

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  try {
    const status = await getTripoTaskStatus(taskId);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo consultar el estado de la tarea.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
