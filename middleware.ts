import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CONSULTORIA_PREFIXES = ["/consultoria", "/api/chat/consultoria", "/api/gmail", "/api/auth/google"];

/**
 * APP_MODE separa el despliegue en dos sitios independientes desde el mismo código:
 * - "bruna": solo Maker 3D; todo lo de Consultoría no existe (404), sin importar la URL.
 * - "consultoria": solo Consultoría (detrás del candado de abajo); Maker 3D no existe ahí.
 * - sin definir (desarrollo local): ambas secciones activas, sin bloqueo por modo.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isConsultoriaPath = CONSULTORIA_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const appMode = process.env.APP_MODE;

  if (appMode === "bruna" && isConsultoriaPath) {
    return new NextResponse(null, { status: 404 });
  }
  if (appMode === "consultoria") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/consultoria", request.url));
    }
    if (!isConsultoriaPath) {
      return new NextResponse(null, { status: 404 });
    }
  }

  if (!isConsultoriaPath) {
    return NextResponse.next();
  }

  const user = process.env.CONSULTORIA_AUTH_USER;
  const pass = process.env.CONSULTORIA_AUTH_PASSWORD;

  if (!user || !pass) {
    return new NextResponse("Consultoría: faltan CONSULTORIA_AUTH_USER/CONSULTORIA_AUTH_PASSWORD.", {
      status: 500,
    });
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const separatorIndex = decoded.indexOf(":");
    const reqUser = decoded.slice(0, separatorIndex);
    const reqPass = decoded.slice(separatorIndex + 1);
    if (reqUser === user && reqPass === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Consultoria"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-bruna.png).*)"],
};
