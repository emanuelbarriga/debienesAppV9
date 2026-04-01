/**
 * Componente para ejecutar y controlar la migración de lotes
 * Con botones de backup, migración y restauración
 */

import { useState } from 'react';
import { 
  createBackup, 
  validateMigration, 
  executeMigration, 
  restoreFromBackup,
  getStoredBackup,
  MigrationReport,
  BackupData
} from '../../../scripts/batchMigration';
import { Download, Upload, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BatchMigrationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationReport, setValidationReport] = useState<MigrationReport | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [hasStoredBackup, setHasStoredBackup] = useState(!!getStoredBackup());

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const backupData = await createBackup();
      setBackup(backupData);
      setHasStoredBackup(true);
      toast.success(`✅ Backup creado: ${backupData.balances.length} balances guardados`);
      
      // Descargar como archivo JSON también
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-lotes-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Error al crear backup');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      const report = await validateMigration();
      setValidationReport(report);
      
      if (report.errors.length === 0) {
        toast.success(`✅ Validación exitosa: ${report.balancesMigrated} balances listos para migrar`);
      } else {
        toast.error(`⚠️ ${report.errors.length} errores encontrados`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error en validación');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!backup && !hasStoredBackup) {
      toast.error('⚠️ Debes crear un backup antes de migrar');
      return;
    }

    if (!window.confirm('¿Estás seguro de ejecutar la migración?\n\nEsto modificará los datos en Firestore.\nTienes un backup para restaurar si es necesario.')) {
      return;
    }

    setLoading(true);
    try {
      const report = await executeMigration();
      setMigrationReport(report);
      
      if (report.errors.length === 0) {
        toast.success(`✅ Migración completada: ${report.balancesMigrated} balances, ${report.distributionsUpdated} distribuciones`);
      } else {
        toast.error(`⚠️ Migración con ${report.errors.length} errores`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error en migración');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const storedBackup = getStoredBackup();
    if (!storedBackup) {
      toast.error('No hay backup disponible para restaurar');
      return;
    }

    if (!window.confirm(`¿Restaurar desde backup?\n\nFecha: ${new Date(storedBackup.timestamp).toLocaleString()}\nBalances: ${storedBackup.balances.length}\n\nEsto REVERTIRÁ todos los cambios de la migración.`)) {
      return;
    }

    setLoading(true);
    try {
      await restoreFromBackup(storedBackup);
      toast.success('✅ Datos restaurados correctamente');
      setMigrationReport(null);
      setValidationReport(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al restaurar');
    } finally {
      setLoading(false);
    }
  };

  const handleClearBackup = () => {
    if (window.confirm('¿Eliminar backup almacenado?\n\nEsto no afectará tus datos, solo eliminará el archivo de backup.')) {
      localStorage.removeItem('batchMigrationBackup');
      setBackup(null);
      setHasStoredBackup(false);
      toast.success('Backup eliminado');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50"
      >
        <AlertTriangle size={20} />
        Migración de Lotes
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-yellow-500 rounded-lg shadow-2xl p-6 w-[600px] max-h-[80vh] overflow-y-auto z-50">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Migración de Lotes de Pago</h3>
          <p className="text-sm text-gray-600 mt-1">Migra batchId de documento a distribuciones</p>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {/* Advertencia */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900">Proceso de migración seguro</p>
            <ol className="mt-2 space-y-1 text-yellow-800">
              <li>1. <strong>Crear backup</strong> (guarda estado actual)</li>
              <li>2. <strong>Validar</strong> (sin cambios, solo lectura)</li>
              <li>3. <strong>Migrar</strong> (aplicar cambios)</li>
              <li>4. Si hay problemas: <strong>Restaurar</strong></li>
            </ol>
          </div>
        </div>
      </div>

      {/* Botones principales */}
      <div className="space-y-3 mb-4">
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
        >
          <Download size={20} />
          {backup || hasStoredBackup ? 'Actualizar Backup' : 'Crear Backup (Paso 1)'}
        </button>

        <button
          onClick={handleValidate}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
        >
          <Info size={20} />
          Validar Datos (Paso 2 - Solo Lectura)
        </button>

        <button
          onClick={handleMigrate}
          disabled={loading || (!backup && !hasStoredBackup)}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
        >
          <CheckCircle size={20} />
          Ejecutar Migración (Paso 3)
        </button>

        {hasStoredBackup && (
          <button
            onClick={handleRestore}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
          >
            <Upload size={20} />
            🔄 DESHACER - Restaurar Backup
          </button>
        )}
      </div>

      {/* Estado del backup */}
      {hasStoredBackup && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle size={16} />
              <span>Backup disponible</span>
              {backup && (
                <span className="text-xs text-green-600">
                  ({backup.balances.length} balances, {backup.batches.length} lotes)
                </span>
              )}
            </div>
            <button
              onClick={handleClearBackup}
              className="text-red-600 hover:text-red-800"
              title="Eliminar backup"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Reporte de validación */}
      {validationReport && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-gray-900 mb-2">📊 Reporte de Validación</h4>
          <div className="space-y-1 text-sm">
            <p>Total de balances: <strong>{validationReport.totalBalances}</strong></p>
            <p>Con batchId: <strong>{validationReport.balancesWithBatchId}</strong></p>
            <p className="text-green-700">✅ A migrar: <strong>{validationReport.balancesMigrated}</strong></p>
            <p className="text-blue-700">🔄 Distribuciones a actualizar: <strong>{validationReport.distributionsUpdated}</strong></p>
            {validationReport.warnings.length > 0 && (
              <p className="text-yellow-700">⚠️ Advertencias: <strong>{validationReport.warnings.length}</strong></p>
            )}
            {validationReport.errors.length > 0 && (
              <p className="text-red-700">❌ Errores: <strong>{validationReport.errors.length}</strong></p>
            )}
            <p className="text-xs text-gray-500">Tiempo: {(validationReport.duration / 1000).toFixed(2)}s</p>
          </div>

          {/* Errores detallados */}
          {validationReport.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-red-700">
                Ver errores ({validationReport.errors.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                {validationReport.errors.map((err, idx) => (
                  <div key={idx} className="bg-red-50 p-2 rounded">
                    <span className="font-mono">{err.balanceId}</span>: {err.error}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Advertencias */}
          {validationReport.warnings.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-yellow-700">
                Ver advertencias ({validationReport.warnings.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                {validationReport.warnings.map((warn, idx) => (
                  <div key={idx} className="bg-yellow-50 p-2 rounded">
                    <span className="font-mono">{warn.balanceId}</span>: {warn.message}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Reporte de migración */}
      {migrationReport && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">✅ Migración Completada</h4>
          <div className="space-y-1 text-sm">
            <p>Balances migrados: <strong>{migrationReport.balancesMigrated}/{migrationReport.balancesWithBatchId}</strong></p>
            <p>Distribuciones actualizadas: <strong>{migrationReport.distributionsUpdated}</strong></p>
            {migrationReport.errors.length > 0 && (
              <p className="text-red-700">❌ Errores: <strong>{migrationReport.errors.length}</strong></p>
            )}
            <p className="text-xs text-gray-500">Tiempo: {(migrationReport.duration / 1000).toFixed(2)}s</p>
          </div>
          
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            💡 Recarga la página para ver los cambios aplicados
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="mt-2 text-sm text-gray-600">Procesando...</p>
        </div>
      )}
    </div>
  );
}
