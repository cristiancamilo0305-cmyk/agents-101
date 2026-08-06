/** Enlaces de búsqueda (no un catálogo curado) para comparar precio/marca antes de comprar. */
export function buildShoppingLinks(query: string) {
  const q = encodeURIComponent(query);
  return {
    amazon: `https://www.amazon.com/s?k=${q}`,
    aliexpress: `https://www.aliexpress.com/wholesale?SearchText=${q}`,
  };
}
