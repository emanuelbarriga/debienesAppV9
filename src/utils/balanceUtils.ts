/**
 * Utilidades para trabajar con OwnerMonthlyBalance y BalanceDistribution
 * Creado como parte de la solución al bug de lotes de pago múltiples
 */

import { OwnerMonthlyBalance, BalanceDistribution } from '../types';

/**
 * Verifica si una distribución específica está incluida en un lote de pago
 */
export function isDistributionInBatch(dist: BalanceDistribution): boolean {
  return !!dist.batchId;
}

/**
 * Verifica si una distribución específica está pagada
 */
export function isDistributionPaid(dist: BalanceDistribution): boolean {
  return dist.batchStatus === 'pagado';
}

/**
 * Verifica si una distribución está pendiente (en lote pero no pagada)
 */
export function isDistributionPending(dist: BalanceDistribution): boolean {
  return !!dist.batchId && dist.batchStatus === 'pendiente';
}

/**
 * Obtiene el estado consolidado de todas las distribuciones de un saldo
 */
export function getBalanceStatus(balance: OwnerMonthlyBalance): {
  allInBatch: boolean;
  someInBatch: boolean;
  noneInBatch: boolean;
  allPaid: boolean;
  somePaid: boolean;
  allPending: boolean;
  availableDistributions: BalanceDistribution[];
  inBatchDistributions: BalanceDistribution[];
  paidDistributions: BalanceDistribution[];
  pendingDistributions: BalanceDistribution[];
} {
  const distribuciones = balance.distribucion || [];
  
  const inBatch = distribuciones.filter(d => d.batchId);
  const available = distribuciones.filter(d => !d.batchId);
  const paid = distribuciones.filter(d => d.batchStatus === 'pagado');
  const pending = distribuciones.filter(d => d.batchId && d.batchStatus === 'pendiente');
  
  return {
    allInBatch: distribuciones.length > 0 && distribuciones.every(d => d.batchId),
    someInBatch: distribuciones.some(d => d.batchId),
    noneInBatch: distribuciones.every(d => !d.batchId),
    allPaid: distribuciones.length > 0 && distribuciones.every(d => d.batchStatus === 'pagado'),
    somePaid: distribuciones.some(d => d.batchStatus === 'pagado'),
    allPending: distribuciones.length > 0 && distribuciones.every(d => d.batchId && d.batchStatus === 'pendiente'),
    availableDistributions: available,
    inBatchDistributions: inBatch,
    paidDistributions: paid,
    pendingDistributions: pending
  };
}

/**
 * Calcula el monto total pendiente de pago
 * (distribuciones que no están en lote o están en lote pero no pagadas)
 */
export function getPendingAmount(balance: OwnerMonthlyBalance): number {
  return (balance.distribucion || [])
    .filter(d => !d.batchId || d.batchStatus !== 'pagado')
    .reduce((sum, d) => sum + Math.abs(d.monto), 0);
}

/**
 * Calcula el monto total ya pagado
 * (distribuciones con batchStatus = 'pagado')
 */
export function getPaidAmount(balance: OwnerMonthlyBalance): number {
  return (balance.distribucion || [])
    .filter(d => d.batchStatus === 'pagado')
    .reduce((sum, d) => sum + Math.abs(d.monto), 0);
}

/**
 * Calcula el monto total en lotes pendientes
 * (distribuciones en lote pero no pagadas)
 */
export function getPendingInBatchAmount(balance: OwnerMonthlyBalance): number {
  return (balance.distribucion || [])
    .filter(d => d.batchId && d.batchStatus === 'pendiente')
    .reduce((sum, d) => sum + Math.abs(d.monto), 0);
}

/**
 * Calcula el monto total disponible para crear lotes
 * (distribuciones sin batchId)
 */
export function getAvailableAmount(balance: OwnerMonthlyBalance): number {
  return (balance.distribucion || [])
    .filter(d => !d.batchId)
    .reduce((sum, d) => sum + Math.abs(d.monto), 0);
}

/**
 * Verifica si un saldo puede ser editado
 * (puede editarse si NO todas las distribuciones están en lote)
 */
export function canEditBalance(balance: OwnerMonthlyBalance): boolean {
  const status = getBalanceStatus(balance);
  return !status.allInBatch;
}

/**
 * Verifica si un saldo puede ser eliminado
 * (puede eliminarse solo si NINGUNA distribución está en lote)
 */
export function canDeleteBalance(balance: OwnerMonthlyBalance): boolean {
  const status = getBalanceStatus(balance);
  return status.noneInBatch;
}

/**
 * Obtiene mensaje descriptivo del estado de un saldo
 */
export function getBalanceStatusMessage(balance: OwnerMonthlyBalance): string {
  const status = getBalanceStatus(balance);
  
  if (status.allPaid) {
    return 'Todas las distribuciones han sido pagadas';
  }
  
  if (status.allPending) {
    return 'Todas las distribuciones están en lotes pendientes';
  }
  
  if (status.allInBatch) {
    const paid = status.paidDistributions.length;
    const pending = status.pendingDistributions.length;
    return `${paid} pagada(s), ${pending} pendiente(s)`;
  }
  
  if (status.someInBatch) {
    const available = status.availableDistributions.length;
    const inBatch = status.inBatchDistributions.length;
    return `${inBatch} en lote, ${available} disponible(s)`;
  }
  
  return 'Todas las distribuciones disponibles';
}

/**
 * Obtiene las distribuciones que pertenecen a un lote específico
 */
export function getDistributionsByBatchId(
  balance: OwnerMonthlyBalance,
  batchId: string
): BalanceDistribution[] {
  return (balance.distribucion || []).filter(d => d.batchId === batchId);
}

/**
 * Verifica si un saldo tiene distribuciones en un lote específico
 */
export function hasDistributionsInBatch(
  balance: OwnerMonthlyBalance,
  batchId: string
): boolean {
  return (balance.distribucion || []).some(d => d.batchId === batchId);
}

/**
 * Cuenta cuántas distribuciones de un saldo están en un lote específico
 */
export function countDistributionsInBatch(
  balance: OwnerMonthlyBalance,
  batchId: string
): number {
  return (balance.distribucion || []).filter(d => d.batchId === batchId).length;
}

/**
 * Obtiene un resumen legible del estado de las distribuciones
 */
export function getDistributionsSummary(balance: OwnerMonthlyBalance): {
  total: number;
  available: number;
  inBatch: number;
  paid: number;
  pending: number;
} {
  const status = getBalanceStatus(balance);
  
  return {
    total: balance.distribucion?.length || 0,
    available: status.availableDistributions.length,
    inBatch: status.inBatchDistributions.length,
    paid: status.paidDistributions.length,
    pending: status.pendingDistributions.length
  };
}
