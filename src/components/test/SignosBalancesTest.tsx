import { ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { processBalanceRowFromCSV } from '../../utils/balanceImportUtils';
import { collection, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCOPAmount } from '../../utils/moneyUtils';

export const signosBalancesTest = {
  id: 'signos-balances',
  icon: <ArrowRightLeft size={20} />,
  title: 'Test de Signos de Balances',
  description: 'Prueba la importación de saldos positivos/negativos (crea, verifica y borra en DB real).',
  action: async () => {
    console.group('[TEST] Signos de Balances (Real DB)');
    const toastId = toast.loading('Ejecutando test de signos...');
    
    // IDs para limpieza
    const testIds: string[] = [];
    const testOwnerNit = '999999999TEST';
    
    try {
      // 1. Simular filas CSV
      console.log('1. Preparando datos de prueba...');
      const rowPositivo = ['Propietario Test Positivo', testOwnerNit, '$ 1.000.000']; // CSV Positivo (Deuda a propietario) -> Debe ser Negativo en DB
      const rowNegativo = ['Propietario Test Negativo', testOwnerNit, '-$ 500.000']; // CSV Negativo (Deuda de propietario) -> Debe ser Positivo en DB
      
      // 2. Probar lógica de parseo
      console.log('2. Verificando lógica de parseo...');
      const resultPositivo = processBalanceRowFromCSV(rowPositivo);
      const resultNegativo = processBalanceRowFromCSV(rowNegativo);
      
      console.log('   - CSV Positivo ($1M) -> DB:', resultPositivo.saldo);
      if (resultPositivo.saldo !== -1000000) throw new Error('Fallo: Saldo positivo CSV no se convirtió a negativo');
      
      console.log('   - CSV Negativo (-$500k) -> DB:', resultNegativo.saldo);
      if (resultNegativo.saldo !== 500000) throw new Error('Fallo: Saldo negativo CSV no se convirtió a positivo');

      // 3. Crear documentos reales en Firestore (Sandbox)
      console.log('3. Creando documentos en Firestore...');
      const balancesRef = collection(db, 'ownerMonthlyBalances');
      
      // Documento 1: Deuda a pagar (saldo negativo)
      const doc1Ref = await addDoc(balancesRef, {
        documentoPropietario: testOwnerNit,
        propietario: 'TEST AUTOMÁTICO - A PAGAR',
        saldo: resultPositivo.saldo,
        mes: 13, // Mes ficticio para no afectar reportes
        anio: 2099,
        fechaImportacion: new Date(),
        isTest: true
      });
      testIds.push(doc1Ref.id);
      console.log('   - Doc creado (A PAGAR):', doc1Ref.id);

      // Documento 2: Deuda del propietario (saldo positivo)
      const doc2Ref = await addDoc(balancesRef, {
        documentoPropietario: testOwnerNit,
        propietario: 'TEST AUTOMÁTICO - COBRAR',
        saldo: resultNegativo.saldo,
        mes: 13,
        anio: 2099,
        fechaImportacion: new Date(),
        isTest: true
      });
      testIds.push(doc2Ref.id);
      console.log('   - Doc creado (COBRAR):', doc2Ref.id);

      // 4. Verificar lectura desde DB
      console.log('4. Verificando lectura desde Firestore...');
      const snap1 = await getDoc(doc(db, 'ownerMonthlyBalances', doc1Ref.id));
      const snap2 = await getDoc(doc(db, 'ownerMonthlyBalances', doc2Ref.id));

      if (!snap1.exists() || !snap2.exists()) throw new Error('No se pudieron leer los documentos creados');

      const data1 = snap1.data();
      const data2 = snap2.data();

      console.log('   - Lectura Doc 1:', formatCOPAmount(data1.saldo));
      console.log('   - Lectura Doc 2:', formatCOPAmount(data2.saldo));

      if (data1.saldo >= 0) throw new Error('Error en persistencia: Doc 1 debería ser negativo');
      if (data2.saldo <= 0) throw new Error('Error en persistencia: Doc 2 debería ser positivo');

      toast.success('Test de signos exitoso (Lógica + DB)', { id: toastId });
      console.log('✅ TEST EXITOSO');

    } catch (error) {
      console.error('❌ TEST FALLIDO:', error);
      toast.error('Fallo en test de signos: ' + String(error), { id: toastId });
    } finally {
      // 5. Limpieza (Rollback)
      if (testIds.length > 0) {
        console.log('5. Limpiando datos de prueba...', testIds);
        for (const id of testIds) {
          try {
            await deleteDoc(doc(db, 'ownerMonthlyBalances', id));
            console.log('   - Eliminado:', id);
          } catch (e) {
            console.error('   Error eliminando:', id, e);
          }
        }
        console.log('🧹 Limpieza completada');
      }
      console.groupEnd();
    }
  }
};
