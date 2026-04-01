/**
 * Componente temporal para ejecutar la migración de nombres de bancos
 * 
 * INSTRUCCIONES:
 * 1. Agregar este componente a cualquier página (ej: Settings o Admin)
 * 2. Hacer click en "Validar" para ver cuántos registros se actualizarán
 * 3. Hacer click en "Migrar" para ejecutar la migración
 * 4. Verificar los resultados en la consola y en Firestore
 * 5. ELIMINAR este componente después de la migración exitosa
 */

import { useState } from 'react';
import { AlertTriangle, Database, CheckCircle } from 'lucide-react';
import { migrateBankNames, validateBankNames } from '../../../scripts/migrateBankNames';
import toast from 'react-hot-toast';

export default function BankMigrationButton() {
  const [validating, setValidating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [validation, setValidation] = useState<{
    accountsToUpdate: string[];
    balancesToUpdate: string[];
    batchesToUpdate: string[];
  } | null>(null);
  const [migrated, setMigrated] = useState(false);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await validateBankNames();
      setValidation(result);
      
      const total = result.accountsToUpdate.length + 
                    result.balancesToUpdate.length + 
                    result.batchesToUpdate.length;
      
      if (total === 0) {
        toast.success('✅ No hay registros por migrar. Todos los bancos están estandarizados.');
      } else {
        toast.success(`Se encontraron ${total} registros para actualizar`);
      }
    } catch (error) {
      console.error('Error validando:', error);
      toast.error('Error al validar. Ver consola para detalles.');
    } finally {
      setValidating(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm(
      '⚠️ IMPORTANTE: Esta operación modificará la base de datos.\n\n' +
      '¿Estás seguro de que deseas continuar con la migración?\n\n' +
      'Recomendación: Hacer backup de Firestore antes de continuar.'
    )) {
      return;
    }

    setMigrating(true);
    try {
      const result = await migrateBankNames();
      
      const totalUpdated = result.updatedAccounts + result.updatedBalances;
      
      if (result.errors.length > 0) {
        toast.error(`Migración completada con ${result.errors.length} errores. Ver consola.`);
      } else {
        toast.success(`✅ Migración exitosa: ${totalUpdated} registros actualizados`);
        setMigrated(true);
      }
      
      // Mostrar resultado detallado en consola
      console.table({
        'Cuentas actualizadas': result.updatedAccounts,
        'Saldos actualizados': result.updatedBalances,
        'Cambios totales': result.changes.length,
        'Errores': result.errors.length
      });
      
    } catch (error) {
      console.error('Error migrando:', error);
      toast.error('Error en la migración. Ver consola para detalles.');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-yellow-600 flex-shrink-0" size={24} />
        <div className="flex-1">
          <h3 className="font-bold text-yellow-900 text-lg mb-2">
            🏦 Migración de Nombres de Bancos
          </h3>
          <p className="text-sm text-yellow-800 mb-4">
            Este proceso estandarizará todos los nombres de bancos en la base de datos según el catálogo oficial.
            <br />
            <strong>Advertencia:</strong> Esta es una operación de una sola vez que modifica datos en Firestore.
          </p>

          {validation && (
            <div className="bg-white rounded-lg p-4 mb-4 border border-yellow-300">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Database size={16} />
                Resultados de Validación:
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Cuentas a actualizar:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {validation.accountsToUpdate.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Saldos a actualizar:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {validation.balancesToUpdate.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Lotes a actualizar:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {validation.batchesToUpdate.length}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-gray-900 font-semibold">Total:</span>
                  <span className="font-mono font-bold text-yellow-700">
                    {validation.accountsToUpdate.length + 
                     validation.balancesToUpdate.length + 
                     validation.batchesToUpdate.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {migrated && (
            <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-300">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle size={20} />
                <span className="font-semibold">¡Migración completada exitosamente!</span>
              </div>
              <p className="text-sm text-green-700 mt-2">
                Puedes eliminar este componente del código ahora.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleValidate}
              disabled={validating || migrating || migrated}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              <Database size={18} />
              {validating ? 'Validando...' : 'Validar Registros'}
            </button>

            <button
              onClick={handleMigrate}
              disabled={!validation || migrating || migrated}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              <AlertTriangle size={18} />
              {migrating ? 'Migrando...' : 'Ejecutar Migración'}
            </button>
          </div>

          <p className="text-xs text-gray-600 mt-3">
            💡 <strong>Tip:</strong> Primero valida para ver cuántos registros se actualizarán. 
            Los resultados detallados aparecerán en la consola del navegador (F12).
          </p>
        </div>
      </div>
    </div>
  );
}
