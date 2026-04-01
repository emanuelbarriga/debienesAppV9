import { initializeApp, cert, ServiceAccount, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar variables de entorno
dotenv.config();

// Inicializar Firebase Admin
let app;
try {
  // Intentar cargar credenciales de archivo de servicio primero
  const serviceAccountPath = resolve(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  app = initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'debienes-appv2-1',
  });
  console.log('Firebase Admin inicializado con serviceAccountKey.json');
} catch (e) {
  // Si no hay archivo, usar Application Default Credentials (del login de firebase CLI)
  app = initializeApp({
    credential: applicationDefault(),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'debienes-appv2-1',
  });
  console.log('Firebase Admin inicializado con Application Default Credentials');
}

const db = getFirestore(app);

interface Transaction {
  id: string;
  importId: string;
  rowIndex: number;
  descripcion: string;
  fechaStr: string;
  valor: number;
}

/**
 * Corrige los rowIndex de transacciones para que sean consecutivos
 * después de un rowIndex inicial dado.
 * @param importId - El ID de importación a corregir
 * @param startRowIndex - El rowIndex inicial (las transacciones empezarán en startRowIndex + 1)
 * @param fix - Si true, aplica cambios; si false, solo reporta
 */
async function fixRowIndexes({
  importId,
  startRowIndex,
  fix = false,
}: {
  importId: string;
  startRowIndex: number;
  fix?: boolean;
}): Promise<void> {
  console.log(`=== FixRowIndexes ===`);
  console.log(`ImportId: ${importId}`);
  console.log(`StartRowIndex: ${startRowIndex}`);
  console.log(`Modo: ${fix ? 'FIX' : 'DRY-RUN'}`);
  console.log('');

  // Buscar todas las transacciones de este importId
  const q = db
    .collection('transactions')
    .where('importId', '==', importId)
    .orderBy('rowIndex', 'asc');

  const snapshot = await q.get();

  if (snapshot.empty) {
    console.log('No se encontraron transacciones con ese importId');
    return;
  }

  const transactions: Transaction[] = snapshot.docs.map((docSnap: any) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Transaction[];

  console.log(`Transacciones encontradas: ${transactions.length}`);
  console.log('');

  // Mostrar estado actual
  console.log('=== Estado actual ===');
  transactions.forEach((t, i) => {
    const newRowIndex = startRowIndex + i + 1;
    const marker = t.rowIndex !== newRowIndex ? ' [CAMBIO]' : '';
    console.log(`${t.rowIndex} -> ${newRowIndex} | ${t.fechaStr} | ${t.descripcion.substring(0, 30).padEnd(30)} | $${t.valor}${marker}`);
  });

  if (!fix) {
    console.log('');
    console.log('Modo dry-run. Para aplicar cambios, ejecuta con fix=true');
    return;
  }

  // Aplicar cambios en batches de 500 (límite de Firestore)
  const BATCH_SIZE = 500;
  let currentBatch = db.batch();
  let operationCount = 0;
  let totalUpdated = 0;

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const newRowIndex = startRowIndex + i + 1;

    if (t.rowIndex !== newRowIndex) {
      const ref = db.collection('transactions').doc(t.id);
      currentBatch.update(ref, { rowIndex: newRowIndex });
      operationCount++;
      totalUpdated++;

      // Commit cada BATCH_SIZE operaciones
      if (operationCount >= BATCH_SIZE) {
        await currentBatch.commit();
        console.log(`Batch commit: ${operationCount} operaciones`);
        currentBatch = db.batch();
        operationCount = 0;
      }
    }
  }

  // Commit final si quedan operaciones pendientes
  if (operationCount > 0) {
    await currentBatch.commit();
    console.log(`Batch commit final: ${operationCount} operaciones`);
  }

  console.log('');
  console.log(`✓ Actualizadas ${totalUpdated} transacciones`);
  console.log(`RowIndex ahora van de ${startRowIndex + 1} a ${startRowIndex + transactions.length}`);
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');

  // Configuración específica para el caso del usuario
  const importId = 'JHTfhpLS1AXRFshDj9d3'; // Import del 31/03/2026
  const lastRowIndex = 452; // Último rowIndex del 30/03/2026

  await fixRowIndexes({ importId, startRowIndex: lastRowIndex, fix });
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
