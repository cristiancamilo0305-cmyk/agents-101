# agents-101

Proyecto educativo para aprender a construir **agentes de IA** usando el **AI SDK de Vercel** integrado nativamente en una **aplicación Next.js**.

> Este archivo es el contrato entre tú (el usuario) y Codex. Define el contexto del proyecto, las reglas que Codex debe respetar y sirve como guía paso a paso para alguien que está empezando.

---

## 1. Contexto del proyecto

- **Objetivo**: construir un agente de IA con AI SDK y exponerlo a través de una UI web hecha en Next.js, aprovechando la integración nativa del AI SDK con React (hooks como `useChat`, streaming, tool calling, structured output).
- **Audiencia**: desarrolladores nuevos en agentes de IA. Las explicaciones deben ser claras, sin asumir conocimiento previo del AI SDK ni de patrones agénticos.
- **Estado actual**: scaffold base de Next.js ya montado. El próximo paso es construir el route handler del chat y conectar la UI con el AI SDK.
- **Stack**:
  - Next.js 15 (App Router + Turbopack)
  - AI SDK de Vercel (`ai`, `@ai-sdk/react`, `@ai-sdk/google`) — Gemini como provider por defecto
  - TypeScript
  - Tailwind v4

---

## 2. Reglas de trabajo con Codex

Estas reglas aplican a **toda** interacción dentro del repo.

### Idioma
- Responde en **español** salvo que se pida explícitamente lo contrario.
- En el código (identificadores, comentarios necesarios, commits): **inglés**.

### Antes de codificar
- Si la tarea es ambigua o tiene más de una interpretación razonable, **pregunta antes de implementar**. Ejemplo: "¿quieres que el agente use tools del lado servidor o que el modelo solo responda texto?".
- Cuando el scaffold ya esté presente, **lee primero la estructura** (`app/`, `package.json`, `components/`) antes de proponer cambios.

### Al implementar
- **Usa la skill `ai-sdk`** siempre que el cambio toque generación de texto, streaming, tools, agentes, embeddings o hooks de React del AI SDK (`useChat`, `useCompletion`). Es la fuente de verdad sobre la API actual del SDK.
- **Usa la skill `web-design-guidelines`** cuando revises o construyas componentes de UI, accesibilidad o experiencia visual.
- Prefiere **editar archivos existentes** antes que crear nuevos. No introduzcas archivos de documentación (`.md`) salvo que se pida.
- **No sobre-diseñes**: nada de abstracciones especulativas, capas de adaptadores prematuras, ni manejo de errores para casos imposibles. Tres líneas repetidas es mejor que una abstracción innecesaria.
- **Comentarios**: solo cuando el *por qué* no sea obvio. Nada de comentarios que narren lo que ya dice el código.

### Modelos y proveedores
- Proveedor por defecto: **Google (Gemini)** vía `@ai-sdk/google`. Ya está instalado en el scaffold.
- Modelos sugeridos al ejemplificar: `gemini-2.5-flash` (rápido / económico) y `gemini-2.5-pro` (razonamiento).
- API key en `.env.local` como `GOOGLE_GENERATIVE_AI_API_KEY` — el provider la lee automáticamente.
- Si el usuario pide otro provider (Anthropic, OpenAI, etc.), confirma antes de instalar paquetes adicionales.
- **Nunca** hardcodees API keys. Usa `.env.local` y referencia `process.env.NOMBRE_DE_LA_KEY`.

### Seguridad y operaciones
- No ejecutes comandos destructivos (`rm -rf`, `git reset --hard`, force-push) sin confirmación explícita.
- No hagas commit ni push automático. Solo cuando se pida.
- No instales dependencias pesadas sin avisar qué se va a instalar y por qué.

### Estilo de respuesta
- Respuestas **cortas y al grano**. El usuario es novato pero no necesita párrafos largos.
- Cuando expliques un concepto nuevo (ej. "qué es un tool en AI SDK"), hazlo en 2-4 líneas + un ejemplo mínimo.
- Usa `path/al/archivo.ts:42` cuando referencies código.