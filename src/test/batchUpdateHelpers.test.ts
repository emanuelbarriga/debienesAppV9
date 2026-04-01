import { describe, it, expect } from 'vitest';
import { applyBatchRevertPaid } from '../utils/batchUpdateHelpers';

describe('batchUpdateHelpers', () => {
  it('applyBatchRevertPaid (WIP) debería volver a pendiente las distribuciones pagadas', () => {
    const seed = [
      {
        id: 'balance-1',
        distribucion: [
          {
            ownerAccountId: 'owner-1',
            monto: 1000,
            batchId: 'batch-123',
            batchStatus: 'pagado',
            batchRef: 'LOTE-123',
            paidAt: new Date('2025-01-15'),
            paidBy: 'user@example.com'
          },
          {
            ownerAccountId: 'owner-2',
            monto: 500,
            batchId: null,
            batchStatus: null
          }
        ]
      }
    ];

    const result = applyBatchRevertPaid(seed as any, 'batch-123');

    expect(result[0].distribucion[0]).toMatchObject({
      batchId: 'batch-123',
      batchStatus: 'pendiente',
      paidAt: null,
      paidBy: null
    });
  });
});
