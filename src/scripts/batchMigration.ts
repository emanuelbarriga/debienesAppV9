/**
 * Script de Migración de Lotes de Pago
 * Migra batchId de nivel documento a nivel distribución
 */

import { db } from '../lib/firebase';
import { collection, getDocs, getDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { OwnerMonthlyBalance, BankPaymentBatch } from '../types';

export interface MigrationReport {
  totalBalances: number;
  balancesWithBatchId: number;
  balancesMigrated: number;
  distributionsUpdated: number;
  errors: Array<{
    balanceId: string;
    error: string;
    details?: any;
  }>;
  warnings: Array<{
    balanceId: string;
    message: string;
  }>;
  duration: number;
  timestamp: Date;
}

export interface BackupData {
  timestamp: Date;
  balances: Array<{
    id: string;
    data: any;
  }>;
  batches: Array<{
    id: string;
    data: any;
  }>;
}

/**
 * Crear backup completo de datos actuales
 */
export async function createBackup(): Promise<BackupData> {
  console.log('📦 Creando backup de datos...');
  
  const backup: BackupData = {
    timestamp: new Date(),
    balances: [],
    batches: []
  };
  
  // Backup de balances
  const balancesSnapshot = await getDocs(collection(db, 'ownerMonthlyBalances'));
  balancesSnapshot.forEach(doc => {
    backup.balances.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  // Backup de batches
  const batchesSnapshot = await getDocs(collection(db, 'bankPaymentBatches'));
  batchesSnapshot.forEach(doc => {
    backup.batches.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  console.log(`✅ Backup creado: ${backup.balances.length} balances, ${backup.batches.length} lotes`);
  
  // Guardar en localStorage
  localStorage.setItem('batchMigrationBackup', JSON.stringify(backup));
  
  return backup;
}

/**
 * Restaurar desde backup
 */
export async function restoreFromBackup(backup: BackupData): Promise<void> {
  console.log('🔄 Restaurando desde backup...');
  
  let restored = 0;
  
  // Restaurar balances
  for (const item of backup.balances) {
    try {
      await updateDoc(doc(db, 'ownerMonthlyBalances', item.id), item.data);
      restored++;
    } catch (error) {
      console.error(`Error restaurando balance ${item.id}:`, error);
    }
  }
  
  console.log(`✅ Restaurados ${restored}/${backup.balances.length} balances`);
}

/**
 * Validar datos antes de migrar (DRY RUN)
 */
export async function validateMigration(): Promise<MigrationReport> {
  console.log('🔍 Validando datos para migración (DRY RUN)...');
  
  const startTime = Date.now();
  const report: MigrationReport = {
    totalBalances: 0,
    balancesWithBatchId: 0,
    balancesMigrated: 0,
    distributionsUpdated: 0,
    errors: [],
    warnings: [],
    duration: 0,
    timestamp: new Date()
  };
  
  // Obtener todos los balances
  const balancesSnapshot = await getDocs(collection(db, 'ownerMonthlyBalances'));
  report.totalBalances = balancesSnapshot.size;
  
  // Obtener balances con batchId
  const balancesWithBatchQuery = query(
    collection(db, 'ownerMonthlyBalances'),
    where('batchId', '!=', null)
  );
  const balancesWithBatch = await getDocs(balancesWithBatchQuery);
  report.balancesWithBatchId = balancesWithBatch.size;
  
  console.log(`📊 Total de balances: ${report.totalBalances}`);
  console.log(`📦 Balances con batchId: ${report.balancesWithBatchId}`);
  
  // Validar cada balance
  for (const balanceDoc of balancesWithBatch.docs) {
    const balance = balanceDoc.data() as OwnerMonthlyBalance;
    const balanceId = balanceDoc.id;
    
    try {
      // Verificar que tenga batchId
      if (!balance.batchId) continue;
      
      // Verificar que el lote exista
      const batchDoc = await getDoc(doc(db, 'bankPaymentBatches', balance.batchId));
      if (!batchDoc.exists()) {
        report.warnings.push({
          balanceId,
          message: `Lote ${balance.batchId} no existe (huérfano)`
        });
        continue;
      }
      
      const batch = batchDoc.data() as BankPaymentBatch;
      
      // Verificar que tenga distribuciones
      if (!balance.distribucion || balance.distribucion.length === 0) {
        report.warnings.push({
          balanceId,
          message: 'No tiene distribuciones'
        });
        continue;
      }
      
      // Contar distribuciones que se actualizarían
      const itemsInBatch = batch.items.filter(item => item.balanceId === balanceId);
      report.distributionsUpdated += itemsInBatch.length;
      report.balancesMigrated++;
      
    } catch (error) {
      report.errors.push({
        balanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  report.duration = Date.now() - startTime;
  
  console.log('\n📋 RESUMEN DE VALIDACIÓN:');
  console.log(`✅ Balances a migrar: ${report.balancesMigrated}`);
  console.log(`🔄 Distribuciones a actualizar: ${report.distributionsUpdated}`);
  console.log(`⚠️  Advertencias: ${report.warnings.length}`);
  console.log(`❌ Errores: ${report.errors.length}`);
  console.log(`⏱️  Duración: ${(report.duration / 1000).toFixed(2)}s\n`);
  
  return report;
}

/**
 * Ejecutar migración completa
 */
export async function executeMigration(): Promise<MigrationReport> {
  console.log('🚀 EJECUTANDO MIGRACIÓN...');
  console.log('⚠️  ADVERTENCIA: Esto modificará los datos en Firestore');
  
  const startTime = Date.now();
  const report: MigrationReport = {
    totalBalances: 0,
    balancesWithBatchId: 0,
    balancesMigrated: 0,
    distributionsUpdated: 0,
    errors: [],
    warnings: [],
    duration: 0,
    timestamp: new Date()
  };
  
  // Obtener balances con batchId
  const balancesWithBatchQuery = query(
    collection(db, 'ownerMonthlyBalances'),
    where('batchId', '!=', null)
  );
  const balancesWithBatch = await getDocs(balancesWithBatchQuery);
  report.balancesWithBatchId = balancesWithBatch.size;
  
  console.log(`📦 Migrando ${report.balancesWithBatchId} balances...`);
  
  // Migrar cada balance
  for (const balanceDoc of balancesWithBatch.docs) {
    const balance = balanceDoc.data() as OwnerMonthlyBalance;
    const balanceId = balanceDoc.id;
    
    try {
      if (!balance.batchId) continue;
      
      // Obtener el lote
      const batchDoc = await getDoc(doc(db, 'bankPaymentBatches', balance.batchId));
      if (!batchDoc.exists()) {
        report.warnings.push({
          balanceId,
          message: `Lote ${balance.batchId} no existe - limpiando batchId`
        });
        
        // Limpiar batchId huérfano
        await updateDoc(doc(db, 'ownerMonthlyBalances', balanceId), {
          batchId: null
        });
        continue;
      }
      
      const batch = batchDoc.data() as BankPaymentBatch;
      
      // Verificar distribuciones
      if (!balance.distribucion || balance.distribucion.length === 0) {
        report.warnings.push({
          balanceId,
          message: 'No tiene distribuciones'
        });
        continue;
      }
      
      // Identificar qué distribuciones están en este lote
      const itemsInBatch = batch.items.filter(item => item.balanceId === balanceId);
      
      if (itemsInBatch.length === 0) {
        report.warnings.push({
          balanceId,
          message: 'El lote no contiene items de este balance'
        });
        continue;
      }
      
      // Actualizar distribuciones
      const updatedDistribucion = balance.distribucion.map(dist => {
        // Verificar si esta distribución está en el lote
        const isInBatch = itemsInBatch.some(item => 
          item.ownerAccountId === dist.ownerAccountId ||
          (item.numeroCuenta && item.numeroCuenta === dist.numeroCuenta)
        );
        
        if (isInBatch) {
          return {
            ...dist,
            batchId: batch.id || balance.batchId,
            batchStatus: batch.status || 'pendiente',
            batchRef: batch.referencia,
            ...(batch.fechaPago && { paidAt: batch.fechaPago }),
            ...(batch.paidBy && { paidBy: batch.paidBy })
          };
        }
        
        return dist;
      });
      
      // Guardar cambios
      await updateDoc(doc(db, 'ownerMonthlyBalances', balanceId), {
        distribucion: updatedDistribucion
      });
      
      report.balancesMigrated++;
      report.distributionsUpdated += itemsInBatch.length;
      
      console.log(`✅ Migrado: ${balance.propietario} (${itemsInBatch.length} distribuciones)`);
      
    } catch (error) {
      report.errors.push({
        balanceId,
        error: error instanceof Error ? error.message : String(error),
        details: error
      });
      console.error(`❌ Error en ${balanceId}:`, error);
    }
  }
  
  report.duration = Date.now() - startTime;
  
  console.log('\n📊 RESUMEN DE MIGRACIÓN:');
  console.log(`✅ Balances migrados: ${report.balancesMigrated}/${report.balancesWithBatchId}`);
  console.log(`🔄 Distribuciones actualizadas: ${report.distributionsUpdated}`);
  console.log(`⚠️  Advertencias: ${report.warnings.length}`);
  console.log(`❌ Errores: ${report.errors.length}`);
  console.log(`⏱️  Duración: ${(report.duration / 1000).toFixed(2)}s\n`);
  
  return report;
}

/**
 * Obtener backup desde localStorage
 */
export function getStoredBackup(): BackupData | null {
  const stored = localStorage.getItem('batchMigrationBackup');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}
