import { normalizeDocumento } from './ownerAccountUtils';

/**
 * Construye el ID determinístico para saldos mensuales: {NIT_NORMALIZADO}_{YYYYMM}
 */
export function buildBalanceId(nit: string, year: number, month: number): string {
  const norm = normalizeDocumento(nit);
  const mm = month.toString().padStart(2, '0');
  return `${norm}_${year}${mm}`;
}

/**
 * Lógica pura para avanzar/terminar al omitir en el modal de distribución.
 */
export function getNextIndexOnSkip(currentIndex: number, total: number): { next: number; done: boolean } {
  if (total <= 0) return { next: 0, done: true };
  if (currentIndex < total - 1) {
    return { next: currentIndex + 1, done: false };
  }
  // Último elemento: quedarse en último índice pero marcar done
  return { next: total - 1, done: true };
}
