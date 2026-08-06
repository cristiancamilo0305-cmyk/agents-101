const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

function apiKey(): string {
  const key = process.env.TRIPO3D_API_KEY;
  if (!key) throw new Error("Falta TRIPO3D_API_KEY en .env.local (cuenta en tripo3d.ai).");
  return key;
}

async function tripoFetch(path: string, init: RequestInit) {
  const res = await fetch(`${TRIPO_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, ...init.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message ?? `Tripo3D respondió ${res.status}.`);
  }
  return data;
}

/** Sube una imagen a Tripo3D y devuelve el image_token para usarlo en una tarea de generación. */
export async function uploadImageToTripo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const data = await tripoFetch("/upload", { method: "POST", body: formData });
  const imageToken = data?.data?.image_token;
  if (!imageToken) throw new Error("Tripo3D no devolvió un image_token válido.");
  return imageToken as string;
}

/** Crea una tarea image_to_model a partir de un image_token ya subido. Devuelve el task_id. */
export async function createImageToModelTask(imageToken: string, fileType: "jpg" | "png"): Promise<string> {
  const data = await tripoFetch("/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image_to_model",
      file: { type: fileType, file_token: imageToken },
    }),
  });
  const taskId = data?.data?.task_id;
  if (!taskId) throw new Error("Tripo3D no devolvió un task_id válido.");
  return taskId as string;
}

/** Convierte un modelo ya generado (por su task_id) a STL/OBJ/3MF. Devuelve el task_id de la conversión. */
export async function createConvertTask(
  originalModelTaskId: string,
  format: "STL" | "OBJ" | "3MF" = "STL",
): Promise<string> {
  const data = await tripoFetch("/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "convert_model",
      format,
      original_model_task_id: originalModelTaskId,
    }),
  });
  const taskId = data?.data?.task_id;
  if (!taskId) throw new Error("Tripo3D no devolvió un task_id para la conversión.");
  return taskId as string;
}

export type TripoTaskStatus = {
  status: string;
  progress: number;
  modelUrl: string | null;
};

/** Consulta el estado de una tarea de generación en Tripo3D. */
export async function getTripoTaskStatus(taskId: string): Promise<TripoTaskStatus> {
  const data = await tripoFetch(`/task/${taskId}`, { method: "GET" });
  const task = data?.data ?? {};
  return {
    status: task.status ?? "unknown",
    progress: typeof task.progress === "number" ? task.progress : 0,
    modelUrl: task.output?.model ?? task.output?.pbr_model ?? null,
  };
}
