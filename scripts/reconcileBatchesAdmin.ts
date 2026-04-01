import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';

const projectId = 'debienes-appv2-1';

// Usar Application Default Credentials si están disponibles
if (!getApps().length) {
  initializeApp({
    projectId: projectId,
  });
}

const db = getFirestore();

interface BatchItem {
  balanceId: string;
  ownerAccountId: string;
  numeroCuenta?: string;
}

interface BalanceDistribution {
  ownerAccountId: string;
  banco?: string;
  numeroCuenta?: string;
  monto: number;
  batchId?: string | null;
  batchStatus?: string | null;
  batchRef?: string | null;
  paidAt?: any;
  paidBy?: string | null;
}

interface Issue {
  type: 'balance_missing' | 'balance_update' | 'batch_orphan';
  batchId?: string;
  balId?: string;
  details?: any;
}

async function reconcile({ fix = false }: { fix?: boolean } = {}): Promise<Issue[]> {
  const batchesSnap = await db.collection('bankPaymentBatches').get();
  const issues: Issue[] = [];

  for (const bDoc of batchesSnap.docs) {
    const batch = { id: bDoc.id, ...bDoc.data() } as any;
    const batchId = batch.id;
    const isPaid = batch.status === 'pagado';
    const ref = batch.referencia || '';

    if (!Array.isArray(batch.items)) continue;

    const uniqueBalances = Array.from(new Set(batch.items.map((i: BatchItem) => i.balanceId)));
    const batchOp = db.batch();
    let batchHasChanges = false;

    for (const balId of uniqueBalances) {
      const balRef = db.collection('ownerMonthlyBalances').doc(balId as string);
      const balSnap = await balRef.get();
      
      if (!balSnap.exists) {
        issues.push({ type: 'balance_missing', batchId, balId: balId as string });
        continue;
      }

      const bal = balSnap.data() as any;
      const dist = Array.isArray(bal.distribucion) ? bal.distribucion : [];
      let changed = false;

      const newDist = dist.map((d: BalanceDistribution) => {
        const item = batch.items!.find((it: BatchItem) =>
          it.balanceId === balId &&
          (it.ownerAccountId && d.ownerAccountId === it.ownerAccountId ||
           (it.numeroCuenta && d.numeroCuenta === it.numeroCuenta))
        );
        if (!item) return d;

        if (d.batchId === batchId && d.batchStatus === batch.status) return d;

        changed = true;
        return {
          ...d,
          batchId,
          batchStatus: isPaid ? 'pagado' : 'pendiente',
          batchRef: ref || d.batchRef || null,
          paidAt: isPaid ? (batch.fechaPago || new Date()) : null,
          paidBy: isPaid ? (batch.paidBy || batch.createdBy || null) : null,
        };
      });

      if (changed) {
        issues.push({ type: 'balance_update', batchId, balId: balId as string, details: { owner: bal.propietario } });
        if (fix) {
          batchOp.update(balRef, { distribucion: newDist });
          batchHasChanges = true;
        }
      }
    }

    if (fix && batchHasChanges) {
      await batchOp.commit();
    }
  }

  // Huérfanos
  const balancesSnap = await db.collection('ownerMonthlyBalances').get();
  for (const balDoc of balancesSnap.docs) {
    const bal = balDoc.data() as any;
    const dist = Array.isArray(bal.distribucion) ? bal.distribucion : [];
    let orphanDetected = false;
    
    for (const d of dist) {
      if (d.batchId) {
        const batchSnap = await db.collection('bankPaymentBatches').doc(d.batchId).get();
        if (!batchSnap.exists) {
          issues.push({ type: 'batch_orphan', balId: balDoc.id, details: { ownerAccountId: d.ownerAccountId, batchId: d.batchId } });
          orphanDetected = true;
        }
      }
    }
  }

  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  console.log(`=== ReconcileBatches (Admin SDK) ===`);
  console.log(`Modo: ${fix ? 'FIX' : 'DRY-RUN'}`);
  
  try {
    const issues = await reconcile({ fix });
    console.log(`\nTotal inconsistencias: ${issues.length}`);
    issues.forEach((i, idx) => {
      console.log(`${idx+1}. ${i.type} | Batch: ${i.batchId} | Bal: ${i.balId} | ${JSON.stringify(i.details || '')}`);
    });
    if (fix) console.log('\n¡Corrección completada!');
  } catch (error) {
    console.error('Error durante la ejecución:', error);
  }
}

if (process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('reconcileBatchesAdmin.ts'))) {
  main();
}
