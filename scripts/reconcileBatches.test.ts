import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcile } from './reconcileBatches';
import * as firestore from 'firebase/firestore';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    writeBatch: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
  };
});

describe('reconcileBatches logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect desynchronized balance in a paid batch', async () => {
    const mockBatch = {
      id: 'batch123',
      data: () => ({
        status: 'pagado',
        referencia: 'REF123',
        items: [{ balanceId: 'bal1', ownerAccountId: 'acc1' }]
      })
    };

    const mockBalance = {
      exists: () => true,
      id: 'bal1',
      data: () => ({
        distribucion: [
          { ownerAccountId: 'acc1', monto: 1000, batchId: null, batchStatus: null }
        ]
      })
    };

    (firestore.getDocs as any).mockResolvedValueOnce({ docs: [mockBatch] }); // batches
    (firestore.getDoc as any).mockResolvedValueOnce(mockBalance); // first balance lookup
    (firestore.getDocs as any).mockResolvedValueOnce({ docs: [mockBalance] }); // orphan check

    const mockBatchOp = {
      update: vi.fn(),
      commit: vi.fn(),
      _mutations: []
    };
    (firestore.writeBatch as any).mockReturnValue(mockBatchOp);

    const issues = await reconcile({ fix: false });

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('balance_update');
    expect(issues[0].balId).toBe('bal1');
  });

  it('should identify orphan distributions', async () => {
    (firestore.getDocs as any).mockResolvedValueOnce({ docs: [] }); // No batches

    const mockBalance = {
      id: 'bal_orphan',
      data: () => ({
        distribucion: [
          { ownerAccountId: 'acc_orphan', batchId: 'non_existent_batch' }
        ]
      })
    };
    (firestore.getDocs as any).mockResolvedValueOnce({ docs: [mockBalance] }); // All balances
    
    // Mock for orphan check: the batch lookup should return non-existent
    (firestore.getDoc as any).mockResolvedValueOnce({ exists: () => false });

    const issues = await reconcile({ fix: false });

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('batch_orphan');
    expect(issues[0].balId).toBe('bal_orphan');
  });
});
