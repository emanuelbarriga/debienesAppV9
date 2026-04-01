/**
 * Script de migración para estandarizar nombres de bancos
 * Normaliza todos los nombres de bancos en ownerAccounts y ownerMonthlyBalances
 * 
 * IMPORTANTE: Ejecutar este script UNA SOLA VEZ después del despliegue
 * 
 * Uso:
 * 1. Importar este archivo en un componente temporal
 * 2. Llamar migrateBankNames() desde la consola o un botón temporal
 * 3. Verificar los resultados en Firestore
 * 4. Eliminar el botón/código temporal
 */

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeBancoName } from '../constants/banks';

interface MigrationResult {
  totalAccounts: number;
  updatedAccounts: number;
  totalBalances: number;
  updatedBalances: number;
  errors: string[];
  changes: Array<{ id: string; oldBank: string; newBank: string }>;
}

/**
 * Migra los nombres de bancos en ownerAccounts
 */
async function migrateOwnerAccounts(): Promise<{
  total: number;
  updated: number;
  errors: string[];
  changes: Array<{ id: string; oldBank: string; newBank: string }>;
}> {
  const result = {
    total: 0,
    updated: 0,
    errors: [] as string[],
    changes: [] as Array<{ id: string; oldBank: string; newBank: string }>
  };

  try {
    const accountsRef = collection(db, 'ownerAccounts');
    const snapshot = await getDocs(accountsRef);
    
    result.total = snapshot.size;

    // Procesar en lotes de 500 (límite de Firestore)
    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const oldBank = data.banco;
      
      if (oldBank) {
        const newBank = normalizeBancoName(oldBank);
        
        // Solo actualizar si cambió
        if (oldBank !== newBank) {
          batch.update(doc(db, 'ownerAccounts', docSnap.id), {
            banco: newBank
          });
          
          result.updated++;
          result.changes.push({
            id: docSnap.id,
            oldBank,
            newBank
          });
          
          batchCount++;
          
          // Commit batch cada 500 operaciones
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }

    // Commit el último batch si tiene operaciones pendientes
    if (batchCount > 0) {
      await batch.commit();
    }

  } catch (error) {
    console.error('Error migrando ownerAccounts:', error);
    result.errors.push(`Error en ownerAccounts: ${error}`);
  }

  return result;
}

/**
 * Migra los nombres de bancos en las distribuciones de ownerMonthlyBalances
 */
async function migrateMonthlyBalances(): Promise<{
  total: number;
  updated: number;
  errors: string[];
  changes: Array<{ id: string; oldBank: string; newBank: string }>;
}> {
  const result = {
    total: 0,
    updated: 0,
    errors: [] as string[],
    changes: [] as Array<{ id: string; oldBank: string; newBank: string }>
  };

  try {
    const balancesRef = collection(db, 'ownerMonthlyBalances');
    const snapshot = await getDocs(balancesRef);
    
    result.total = snapshot.size;

    // Procesar en lotes
    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const distribucion = data.distribucion;
      
      if (distribucion && Array.isArray(distribucion)) {
        let hasChanges = false;
        const newDistribucion = distribucion.map((dist: any) => {
          if (dist.banco) {
            const oldBank = dist.banco;
            const newBank = normalizeBancoName(oldBank);
            
            if (oldBank !== newBank) {
              hasChanges = true;
              result.changes.push({
                id: docSnap.id,
                oldBank,
                newBank
              });
              
              return { ...dist, banco: newBank };
            }
          }
          return dist;
        });

        if (hasChanges) {
          batch.update(doc(db, 'ownerMonthlyBalances', docSnap.id), {
            distribucion: newDistribucion
          });
          
          result.updated++;
          batchCount++;
          
          // Commit batch cada 500 operaciones
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }

    // Commit el último batch
    if (batchCount > 0) {
      await batch.commit();
    }

  } catch (error) {
    console.error('Error migrando ownerMonthlyBalances:', error);
    result.errors.push(`Error en ownerMonthlyBalances: ${error}`);
  }

  return result;
}

/**
 * Migra los nombres de bancos en los lotes de pago (bankPaymentBatches)
 */
async function migratePaymentBatches(): Promise<{
  total: number;
  updated: number;
  errors: string[];
  changes: Array<{ id: string; oldBank: string; newBank: string }>;
}> {
  const result = {
    total: 0,
    updated: 0,
    errors: [] as string[],
    changes: [] as Array<{ id: string; oldBank: string; newBank: string }>
  };

  try {
    const batchesRef = collection(db, 'bankPaymentBatches');
    const snapshot = await getDocs(batchesRef);
    
    result.total = snapshot.size;

    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const oldBank = data.banco;
      
      if (oldBank) {
        const newBank = normalizeBancoName(oldBank);
        
        if (oldBank !== newBank) {
          batch.update(doc(db, 'bankPaymentBatches', docSnap.id), {
            banco: newBank
          });
          
          result.updated++;
          result.changes.push({
            id: docSnap.id,
            oldBank,
            newBank
          });
          
          batchCount++;
          
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

  } catch (error) {
    console.error('Error migrando bankPaymentBatches:', error);
    result.errors.push(`Error en bankPaymentBatches: ${error}`);
  }

  return result;
}

/**
 * Ejecuta la migración completa
 * Retorna un resumen detallado del proceso
 */
export async function migrateBankNames(): Promise<MigrationResult> {
  console.log('🏦 Iniciando migración de nombres de bancos...');
  
  const startTime = Date.now();
  
  // Migrar cuentas
  console.log('📋 Migrando ownerAccounts...');
  const accountsResult = await migrateOwnerAccounts();
  console.log(`✅ Cuentas: ${accountsResult.updated}/${accountsResult.total} actualizadas`);
  
  // Migrar saldos mensuales
  console.log('💰 Migrando ownerMonthlyBalances...');
  const balancesResult = await migrateMonthlyBalances();
  console.log(`✅ Saldos: ${balancesResult.updated}/${balancesResult.total} actualizados`);
  
  // Migrar lotes de pago
  console.log('📦 Migrando bankPaymentBatches...');
  const batchesResult = await migratePaymentBatches();
  console.log(`✅ Lotes: ${batchesResult.updated}/${batchesResult.total} actualizados`);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  const result: MigrationResult = {
    totalAccounts: accountsResult.total,
    updatedAccounts: accountsResult.updated,
    totalBalances: balancesResult.total,
    updatedBalances: balancesResult.updated,
    errors: [
      ...accountsResult.errors,
      ...balancesResult.errors,
      ...batchesResult.errors
    ],
    changes: [
      ...accountsResult.changes,
      ...balancesResult.changes,
      ...batchesResult.changes
    ]
  };
  
  console.log('\n📊 RESUMEN DE MIGRACIÓN:');
  console.log(`⏱️  Duración: ${duration}s`);
  console.log(`📋 Cuentas: ${result.updatedAccounts}/${result.totalAccounts} actualizadas`);
  console.log(`💰 Saldos: ${result.updatedBalances}/${result.totalBalances} actualizados`);
  console.log(`❌ Errores: ${result.errors.length}`);
  console.log(`🔄 Cambios totales: ${result.changes.length}`);
  
  if (result.changes.length > 0) {
    console.log('\n📝 Muestra de cambios (primeros 10):');
    result.changes.slice(0, 10).forEach(change => {
      console.log(`  "${change.oldBank}" → "${change.newBank}"`);
    });
  }
  
  if (result.errors.length > 0) {
    console.error('\n❌ ERRORES:');
    result.errors.forEach(error => console.error(`  ${error}`));
  }
  
  console.log('\n✅ Migración completada');
  
  return result;
}

/**
 * Función auxiliar para validar los resultados sin modificar datos
 * Útil para probar antes de ejecutar la migración real
 */
export async function validateBankNames(): Promise<{
  accountsToUpdate: string[];
  balancesToUpdate: string[];
  batchesToUpdate: string[];
}> {
  const result = {
    accountsToUpdate: [] as string[],
    balancesToUpdate: [] as string[],
    batchesToUpdate: [] as string[]
  };

  try {
    // Validar cuentas
    const accountsRef = collection(db, 'ownerAccounts');
    const accountsSnap = await getDocs(accountsRef);
    accountsSnap.forEach(doc => {
      const oldBank = doc.data().banco;
      if (oldBank && oldBank !== normalizeBancoName(oldBank)) {
        result.accountsToUpdate.push(doc.id);
      }
    });

    // Validar saldos
    const balancesRef = collection(db, 'ownerMonthlyBalances');
    const balancesSnap = await getDocs(balancesRef);
    balancesSnap.forEach(doc => {
      const distribucion = doc.data().distribucion;
      if (distribucion && Array.isArray(distribucion)) {
        const needsUpdate = distribucion.some((dist: any) => 
          dist.banco && dist.banco !== normalizeBancoName(dist.banco)
        );
        if (needsUpdate) {
          result.balancesToUpdate.push(doc.id);
        }
      }
    });

    // Validar lotes
    const batchesRef = collection(db, 'bankPaymentBatches');
    const batchesSnap = await getDocs(batchesRef);
    batchesSnap.forEach(doc => {
      const oldBank = doc.data().banco;
      if (oldBank && oldBank !== normalizeBancoName(oldBank)) {
        result.batchesToUpdate.push(doc.id);
      }
    });

  } catch (error) {
    console.error('Error validando:', error);
  }

  console.log('📊 VALIDACIÓN:');
  console.log(`  Cuentas a actualizar: ${result.accountsToUpdate.length}`);
  console.log(`  Saldos a actualizar: ${result.balancesToUpdate.length}`);
  console.log(`  Lotes a actualizar: ${result.batchesToUpdate.length}`);

  return result;
}
