import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';

// Config Firebase (reemplaza con tus credenciales o usa .env)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || 'debienes-appv2-1',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  paidAt?: Date | null;
  paidBy?: string | null;
}

interface Balance {
  id: string;
  distribucion: BalanceDistribution[];
}

interface Batch {
  id: string;
  status: string;
  referencia?: string;
  fechaPago?: Date;
  paidBy?: string;
  createdBy?: string;
  items?: BatchItem[];
}

interface Issue {
  type: 'balance_missing' | 'balance_update' | 'batch_orphan';
  batchId?: string;
  balId?: string;
  details?: any;
}

/**
 * Detecta y opcionalmente repara desincronización entre lotes y balances.
 * @param options.fix Si true, aplica cambios; si false, solo reporta.
 */
async function reconcile({ fix = false }: { fix?: boolean } = {}): Promise<Issue[]> {
  const batchesSnap = await getDocs(collection(db, 'bankPaymentBatches'));
  const issues: Issue[] = [];

  for (const bDoc of batchesSnap.docs) {
    const batch = { id: bDoc.id, ...bDoc.data() } as Batch;
    const batchId = batch.id;
    const isPaid = batch.status === 'pagado';
    const ref = batch.referencia || '';

    if (!Array.isArray(batch.items)) continue;

    const uniqueBalances = Array.from(new Set(batch.items.map((i: BatchItem) => i.balanceId)));
    const batchOp = writeBatch(db);

    for (const balId of uniqueBalances) {
      const balRef = doc(db, 'ownerMonthlyBalances', balId);
      const balSnap = await getDoc(balRef);
      if (!balSnap.exists()) {
        issues.push({ type: 'balance_missing', batchId, balId });
        continue;
      }

      const bal = { id: balId, ...balSnap.data() } as Balance;
      const dist = Array.isArray(bal.distribucion) ? bal.distribucion : [];
      let changed = false;

      const newDist = dist.map((d: BalanceDistribution) => {
        // Coincidencia por ownerAccountId o numeroCuenta con items del lote
        const item = batch.items!.find((it: BatchItem) =>
          it.balanceId === balId &&
          (it.ownerAccountId && d.ownerAccountId === it.ownerAccountId ||
           (it.numeroCuenta && d.numeroCuenta === it.numeroCuenta))
        );
        if (!item) return d;

        // Si ya está alineado, no tocar
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
        issues.push({ type: 'balance_update', batchId, balId, details: { before: dist, after: newDist } });
        if (fix) batchOp.update(balRef, { distribucion: newDist });
      }
    }

    if (fix && batchOp._mutations && batchOp._mutations.length > 0) {
      await batchOp.commit();
    }
  }

  // Detectar distribuciones huérfanas (batchId sin lote)
  const balancesSnap = await getDocs(collection(db, 'ownerMonthlyBalances'));
  for (const balDoc of balancesSnap.docs) {
    const bal = { id: balDoc.id, ...balDoc.data() } as Balance;
    const dist = Array.isArray(bal.distribucion) ? bal.distribucion : [];
    for (const d of dist) {
      if (d.batchId) {
        const batchRef = doc(db, 'bankPaymentBatches', d.batchId);
        const batchSnap = await getDoc(batchRef);
        if (!batchSnap.exists()) {
          issues.push({ type: 'batch_orphan', balId: bal.id, details: { ownerAccountId: d.ownerAccountId, batchId: d.batchId } });
        }
      }
    }
  }

  return issues;
}

/**
 * Reporte legible para consola.
 */
function report(issues: Issue[]) {
  console.log(`\n=== Resumen de inconsistencias ===`);
  console.log(`Total detectados: ${issues.length}`);
  const byType = issues.reduce((m, i) => {
    m[i.type] = (m[i.type] || 0) + 1;
    return m;
  }, {} as Record<string, number>);
  console.log('Por tipo:', byType);
  console.log('\nEjemplos (primeros 10):');
  issues.slice(0, 10).forEach((i, idx) => {
    console.log(`${idx + 1}. ${i.type} | batchId=${i.batchId} | balId=${i.balId}`);
    if (i.details) console.log('   details:', JSON.stringify(i.details, null, 2));
  });
}

import { fileURLToPath } from 'url';

// ... (resto del código)

/**
 * CLI wrapper.
 */
async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  console.log(`=== ReconcileBatches ===`);
  console.log(`Modo: ${fix ? 'FIX' : 'DRY-RUN'}`);
  const issues = await reconcile({ fix });
  report(issues);
  if (fix) {
    console.log('\nCambios aplicados. Verifica en Firestore.');
  } else {
    console.log('\nModo dry-run. Para aplicar cambios, ejecuta con --fix');
  }
}

const isMain = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('reconcileBatches.ts'));

if (isMain) {
  main().catch((e) => {
    console.log('Error en reconcileBatches:', e);
    process.exit(1);
  });
}

export { reconcile, report };
