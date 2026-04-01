import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../../../hooks/useCollection';
import { OwnerMonthlyBalance } from '../../../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

interface DiagnosticProps {
  selectedMonth: number;
  selectedYear: number;
}

export default function PaymentBatchesDiagnostic({ selectedMonth, selectedYear }: DiagnosticProps) {
  const { data: balances } = useCollection<OwnerMonthlyBalance>('ownerMonthlyBalances');
  const [inverting, setInverting] = useState(false);

  const handleInvertSigns = async () => {
    const monthYearBalances = (balances || []).filter(b => 
      b.mes === selectedMonth && b.anio === selectedYear && !b.batchId
    );

    const positiveBalances = monthYearBalances.filter(b => b.saldo > 0);

    if (positiveBalances.length === 0) {
      toast.error('No hay saldos positivos para invertir');
      return;
    }

    const confirmMsg = `¿Invertir el signo de ${positiveBalances.length} saldo(s) positivo(s)?\n\nEsto los convertirá en negativos (deudas) para que aparezcan en Lotes de Pago.`;
    
    if (!window.confirm(confirmMsg)) return;

    setInverting(true);

    try {
      let updated = 0;
      
      for (const balance of positiveBalances) {
        if (!balance.id) continue;

        const newSaldo = -Math.abs(balance.saldo); // Convertir a negativo
        const newDistribucion = balance.distribucion?.map(dist => ({
          ...dist,
          monto: -Math.abs(dist.monto) // Invertir también los montos de distribución
        }));

        await updateDoc(doc(db, 'ownerMonthlyBalances', balance.id), {
          saldo: newSaldo,
          distribucion: newDistribucion
        });

        updated++;
      }

      toast.success(`✅ ${updated} saldo(s) invertido(s) a negativo`);
    } catch (error) {
      console.error('Error invirtiendo signos:', error);
      toast.error('Error al invertir signos');
    } finally {
      setInverting(false);
    }
  };

  const diagnosticData = useMemo(() => {
    const allBalances = balances || [];
    
    // Filtrar por mes/año
    const monthYearFiltered = allBalances.filter(b => 
      b.mes === selectedMonth && b.anio === selectedYear
    );

    // Analizar cada condición
    const withDistribution = monthYearFiltered.filter(b => b.distribucion);
    const withoutBatch = monthYearFiltered.filter(b => !b.batchId);
    const negative = monthYearFiltered.filter(b => b.saldo < 0);
    const positive = monthYearFiltered.filter(b => b.saldo > 0);
    const zero = monthYearFiltered.filter(b => b.saldo === 0);

    // Condiciones combinadas
    const withDistributionNoBatch = monthYearFiltered.filter(b => 
      b.distribucion && !b.batchId
    );
    
    const availableForPayment = monthYearFiltered.filter(b => 
      b.distribucion && !b.batchId && b.saldo < 0
    );

    return {
      total: allBalances.length,
      monthYearFiltered: monthYearFiltered.length,
      withDistribution: withDistribution.length,
      withoutBatch: withoutBatch.length,
      negative: negative.length,
      positive: positive.length,
      zero: zero.length,
      withDistributionNoBatch: withDistributionNoBatch.length,
      availableForPayment: availableForPayment.length,
      
      // Detalles para debugging
      details: {
        monthYearFiltered,
        withDistribution,
        withoutBatch,
        negative,
        positive,
        zero,
        withDistributionNoBatch,
        availableForPayment
      }
    };
  }, [balances, selectedMonth, selectedYear]);

  useEffect(() => {
    console.group('🔍 DIAGNÓSTICO: Saldos Mensuales → Lotes de Pago');
    console.log(`📅 Mes/Año seleccionado: ${selectedMonth}/${selectedYear}`);
    console.log('');
    
    console.log('📊 RESUMEN DE FILTROS:');
    console.log(`   Total saldos en BD: ${diagnosticData.total}`);
    console.log(`   ✅ Filtrados por mes/año: ${diagnosticData.monthYearFiltered}`);
    console.log(`   ✅ Con distribución: ${diagnosticData.withDistribution}`);
    console.log(`   ✅ Sin batchId: ${diagnosticData.withoutBatch}`);
    console.log(`   ✅ Saldo negativo (deuda): ${diagnosticData.negative}`);
    console.log(`   ⚠️  Saldo positivo (a favor): ${diagnosticData.positive}`);
    console.log(`   ⚠️  Saldo cero: ${diagnosticData.zero}`);
    console.log('');
    
    console.log('🔗 CONDICIONES COMBINADAS:');
    console.log(`   Con distribución + Sin lote: ${diagnosticData.withDistributionNoBatch}`);
    console.log(`   ✅ DISPONIBLES PARA PAGO (todas las condiciones): ${diagnosticData.availableForPayment}`);
    console.log('');

    if (diagnosticData.monthYearFiltered > 0) {
      console.log('📋 DETALLE DE SALDOS DEL MES/AÑO:');
      diagnosticData.details.monthYearFiltered.forEach((balance, idx) => {
        const hasDistribution = !!balance.distribucion;
        const hasBatch = !!balance.batchId;
        const isNegative = balance.saldo < 0;
        const passesAllFilters = hasDistribution && !hasBatch && isNegative;

        console.log(`   ${idx + 1}. ${balance.propietario} (${balance.documentoPropietario})`);
        console.log(`      Saldo: ${balance.saldo.toLocaleString()} COP`);
        console.log(`      Tiene distribución: ${hasDistribution ? '✅' : '❌'}`);
        console.log(`      En lote: ${hasBatch ? `✅ (${balance.batchId})` : '❌'}`);
        console.log(`      Es negativo (deuda): ${isNegative ? '✅' : '❌'}`);
        console.log(`      → Aparece en Lotes de Pago: ${passesAllFilters ? '✅ SÍ' : '❌ NO'}`);
        
        if (!passesAllFilters) {
          const reasons = [];
          if (!hasDistribution) reasons.push('Sin distribución');
          if (hasBatch) reasons.push('Ya está en un lote');
          if (!isNegative) reasons.push(`Saldo ${balance.saldo >= 0 ? 'positivo/cero' : 'negativo'} (${balance.saldo})`);
          console.log(`      ⚠️  Razón: ${reasons.join(', ')}`);
        }
        console.log('');
      });
    }

    console.log('💡 PROBLEMA IDENTIFICADO:');
    if (diagnosticData.positive > 0 && diagnosticData.negative === 0) {
      console.log('   ⚠️  Todos los saldos son POSITIVOS (a favor del propietario)');
      console.log('   ⚠️  El filtro "b.saldo < 0" solo muestra DEUDAS (saldos negativos)');
      console.log('   ⚠️  Los saldos positivos NO aparecen en Lotes de Pago');
      console.log('');
      console.log('   💡 SOLUCIÓN: Cambiar la lógica según el tipo de saldo:');
      console.log('      - Saldos negativos: Pagos a realizar (deudas)');
      console.log('      - Saldos positivos: Cobros a realizar (a favor)');
    } else if (diagnosticData.withDistributionNoBatch > diagnosticData.availableForPayment) {
      console.log(`   ⚠️  Hay ${diagnosticData.withDistributionNoBatch - diagnosticData.availableForPayment} saldos con distribución y sin lote`);
      console.log('   ⚠️  pero NO aparecen porque no son negativos');
    } else if (diagnosticData.availableForPayment === 0 && diagnosticData.monthYearFiltered > 0) {
      console.log('   ⚠️  Hay saldos en el mes/año pero ninguno cumple TODAS las condiciones');
      console.log('   ⚠️  Revisa: distribución, batchId, y signo del saldo');
    } else if (diagnosticData.availableForPayment > 0) {
      console.log(`   ✅ ${diagnosticData.availableForPayment} saldo(s) disponible(s) para pago`);
    }

    console.groupEnd();
  }, [diagnosticData, selectedMonth, selectedYear]);

  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
      <h3 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
        🔍 Diagnóstico: Saldos Mensuales → Lotes de Pago
      </h3>
      
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded p-3">
            <div className="text-gray-600">Total en BD</div>
            <div className="text-2xl font-bold">{diagnosticData.total}</div>
          </div>
          
          <div className="bg-white rounded p-3">
            <div className="text-gray-600">Filtrados por mes/año</div>
            <div className="text-2xl font-bold text-blue-600">{diagnosticData.monthYearFiltered}</div>
          </div>
        </div>

        <div className="bg-white rounded p-3">
          <div className="font-semibold mb-2">Análisis de Filtros:</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>✅ Con distribución:</span>
              <span className="font-mono">{diagnosticData.withDistribution}</span>
            </div>
            <div className="flex justify-between">
              <span>✅ Sin lote (batchId):</span>
              <span className="font-mono">{diagnosticData.withoutBatch}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span>💰 Saldo negativo (deuda):</span>
              <span className="font-mono text-red-600">{diagnosticData.negative}</span>
            </div>
            <div className="flex justify-between">
              <span>💰 Saldo positivo (a favor):</span>
              <span className="font-mono text-green-600">{diagnosticData.positive}</span>
            </div>
            <div className="flex justify-between">
              <span>💰 Saldo cero:</span>
              <span className="font-mono">{diagnosticData.zero}</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-100 rounded p-3">
          <div className="font-semibold mb-1">Resultado Final:</div>
          <div className="text-lg font-bold text-blue-900">
            {diagnosticData.availableForPayment} saldo(s) disponible(s) para Lotes de Pago
          </div>
          {diagnosticData.positive > 0 && diagnosticData.negative === 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded">
                ⚠️ Todos los saldos son positivos. El filtro actual solo muestra saldos negativos (deudas).
              </div>
              <button
                onClick={handleInvertSigns}
                disabled={inverting}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
              >
                {inverting ? '⏳ Invirtiendo signos...' : '🔄 Invertir signos a negativo (deudas)'}
              </button>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
          💡 Abre la consola del navegador (F12) para ver el análisis detallado de cada saldo
        </div>
      </div>
    </div>
  );
}
