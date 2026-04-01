export interface BalanceDistributionLite {
  ownerAccountId: string;
  banco?: string;
  numeroCuenta?: string;
  monto: number;
  batchId?: string | null;
  batchStatus?: string | null;
  batchRef?: string | null;
  paidAt?: Date | null;
  paidBy?: string | null;
}

/**
 * Revierte el pago de las distribuciones de un batchId, manteniendo el lote pero poniéndolo pendiente.
 */
export function applyBatchRevertPaid(
  balances: BalanceLite[],
  batchId: string
): BalanceLite[] {
  return balances.map(bal => ({
    ...bal,
    distribucion: bal.distribucion.map(dist => {
      if (dist.batchId === batchId) {
        return {
          ...dist,
          batchStatus: 'pendiente',
          paidAt: null,
          paidBy: null,
        };
      }
      return dist;
    })
  }));
}

export interface BalanceLite {
  id: string;
  distribucion: BalanceDistributionLite[];
}

export interface BatchItemLite {
  balanceId: string;
  ownerAccountId: string;
  referencia: string;
}

/**
 * Asigna batchId/batchStatus/batchRef a las distribuciones coincidentes (ownerAccountId) de los balances.
 * No crea nuevas distribuciones, solo actualiza las existentes que aparezcan en items.
 */
export function applyBatchCreate(
  balances: BalanceLite[],
  items: BatchItemLite[],
  batchId: string,
  batchRef: string
): BalanceLite[] {
  const map = new Map(balances.map(b => [b.id, { ...b, distribucion: [...b.distribucion] }]));

  for (const item of items) {
    const bal = map.get(item.balanceId);
    if (!bal) continue;

    bal.distribucion = bal.distribucion.map(dist => {
      if (dist.ownerAccountId === item.ownerAccountId) {
        return {
          ...dist,
          batchId,
          batchStatus: 'pendiente',
          batchRef,
        };
      }
      return dist;
    });
  }

  return Array.from(map.values());
}

/**
 * Marca como pagadas las distribuciones que pertenezcan a un batchId.
 */
export function applyBatchPaid(
  balances: BalanceLite[],
  batchId: string,
  paidAt: Date,
  paidBy: string
): BalanceLite[] {
  return balances.map(bal => ({
    ...bal,
    distribucion: bal.distribucion.map(dist => {
      if (dist.batchId === batchId) {
        return {
          ...dist,
          batchStatus: 'pagado',
          paidAt,
          paidBy,
        };
      }
      return dist;
    })
  }));
}

/**
 * Libera distribuciones de un batchId (al eliminar lote).
 */
export function applyBatchDelete(
  balances: BalanceLite[],
  batchId: string
): BalanceLite[] {
  return balances.map(bal => ({
    ...bal,
    distribucion: bal.distribucion.map(dist => {
      if (dist.batchId === batchId) {
        return {
          ...dist,
          batchId: null,
          batchStatus: null,
          batchRef: null,
          paidAt: null,
          paidBy: null,
        };
      }
      return dist;
    })
  }));
}
