const ALLOWED_HOST_SUFFIX = ".tripo3d.com";

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) {
    return new Response("Falta el parámetro url.", { status: 400 });
  }

  let hostname: string;
  try {
    hostname = new URL(target).hostname;
  } catch {
    return new Response("URL inválida.", { status: 400 });
  }
  if (!hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return new Response("Host no permitido.", { status: 400 });
  }

  const upstream = await fetch(target);
  if (!upstream.ok || !upstream.body) {
    return new Response("No se pudo descargar el archivo desde Tripo3D.", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
