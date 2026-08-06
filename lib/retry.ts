/**
 * Reintenta una operación de filesystem ante fallos transitorios (ENOENT/EBUSY/EAGAIN),
 * comunes en carpetas montadas vía Google Drive Desktop (macOS CloudStorage) cuando el
 * proveedor de archivos tiene un bache breve de sincronización.
 */
export async function retryOnTransientFsError<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 600,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      const isTransient = code === "ENOENT" || code === "EBUSY" || code === "EAGAIN";
      if (!isTransient || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
