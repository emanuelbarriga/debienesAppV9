import { useState, useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import { OwnerAccount, OwnerMonthlyBalance, BalancePendingDistribution, CompletedDistribution } from '../types';
import { parseCOPAmount, formatCOPAmount } from '../utils/moneyUtils';
import { normalizeDocumento } from '../utils/ownerAccountUtils';
import { detectCSVDelimiter } from '../utils/csvUtils';
import { doc, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import DistributeBalanceModal from './DistributeBalanceModal';

export default function MonthlyBalancesTab() {
  const { data: balances, loading } = useCollection<OwnerMonthlyBalance>('ownerMonthlyBalances');
  const { data: accounts } = useCollection<OwnerAccount>('ownerAccounts');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Para modal de distribución
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [pendingDistributions, setPendingDistributions] = useState<BalancePendingDistribution[]>([]);

  const handleImportBalances = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const delimiter = detectCSVDelimiter(text);

      Papa.parse(text, {
        header: false,
        delimiter,
        skipEmptyLines: true,
        complete: async (results) => {
          await processBalancesImport(results.data as string[][]);
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error);
          toast.error('Error al procesar el archivo');
          setImporting(false);
        }
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Error al leer el archivo');
      setImporting(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processBalancesImport = async (rows: string[][]) => {
    const dataRows = rows.slice(1); // Skip header
    let imported = 0;
    const requiresDistribution: BalancePendingDistribution[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    try {
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;

        try {
          const propietario = row[0]?.trim();
          const nit = normalizeDocumento(row[1]);
          const saldoStr = row[2];
          const saldo = parseCOPAmount(saldoStr);

          if (!propietario || !nit) {
            errors.push({ row: rowNum, message: 'Datos incompletos' });
            continue;
          }

          // Buscar cuentas del propietario
          const ownerAccounts = accounts.filter(acc => 
            acc.documentoPropietario === nit && acc.status === 'activa'
          );

          if (ownerAccounts.length === 0) {
            errors.push({ row: rowNum, message: `Sin cuentas para ${propietario}` });
            continue;
          }

          if (ownerAccounts.length === 1) {
            // Una sola cuenta: asignar automáticamente
            const account = ownerAccounts[0];
            const balanceId = `${nit}_${selectedYear}${selectedMonth.toString().padStart(2, '0')}`;

            await setDoc(
              doc(db, 'ownerMonthlyBalances', balanceId),
              {
                documentoPropietario: nit,
                propietario,
                saldo,
                mes: selectedMonth,
                anio: selectedYear,
                distribucion: [{
                  ownerAccountId: account.id!,
                  banco: account.banco,
                  numeroCuenta: account.numeroCuenta,
                  monto: saldo,
                  porcentaje: 100
                }],
                distribuidoManualmente: false,
                fechaImportacion: new Date(),
                importadoPor: auth.currentUser?.email || ''
              },
              { merge: true }
            );

            imported++;
          } else {
            // Múltiples cuentas: requiere distribución manual
            requiresDistribution.push({
              documentoPropietario: nit,
              propietario,
              saldo,
              cuentasDisponibles: ownerAccounts,
              mes: selectedMonth,
              anio: selectedYear
            });
          }
        } catch (error) {
          errors.push({ row: rowNum, message: String(error) });
        }
      }

      if (requiresDistribution.length > 0) {
        // Mostrar modal de distribución
        setPendingDistributions(requiresDistribution);
        setShowDistributeModal(true);
      } else {
        toast.success(`Importación completada: ${imported} saldos`);
        setImporting(false);
      }

      if (errors.length > 0) {
        console.error('Errores:', errors);
        toast.error(`${errors.length} errores (ver consola)`);
      }

    } catch (error) {
      console.error('Error in import:', error);
      toast.error('Error durante la importación');
      setImporting(false);
    }
  };

  const handleDistributionComplete = async (distributions: CompletedDistribution[]) => {
    try {
      for (const dist of distributions) {
        const balanceId = `${dist.documentoPropietario}_${dist.anio}${dist.mes.toString().padStart(2, '0')}`;

        await setDoc(
          doc(db, 'ownerMonthlyBalances', balanceId),
          {
            documentoPropietario: dist.documentoPropietario,
            propietario: dist.propietario,
            saldo: dist.saldo,
            mes: dist.mes,
            anio: dist.anio,
            distribucion: dist.distribucion,
            distribuidoManualmente: true,
            fechaImportacion: new Date(),
            importadoPor: auth.currentUser?.email || ''
          },
          { merge: true }
        );
      }

      toast.success(`${distributions.length} saldos distribuidos y guardados`);
    } catch (error) {
      console.error('Error saving distributions:', error);
      toast.error('Error al guardar distribuciones');
    } finally {
      setImporting(false);
      setShowDistributeModal(false);
      setPendingDistributions([]);
    }
  };

  const handleDeleteBalance = async (balance: OwnerMonthlyBalance) => {
    if (!balance.id) return;

    // Validar que no esté en un lote
    if (balance.batchId) {
      toast.error('No se puede eliminar. Este saldo ya está incluido en un lote de pago.');
      return;
    }

    const confirmText = `¿Eliminar saldo de ${balance.propietario}?\n\nMes: ${new Date(balance.anio, balance.mes - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}\nSaldo: ${formatCOPAmount(balance.saldo)}\n\n¿Estás seguro?`;
    
    if (!window.confirm(confirmText)) return;

    try {
      await deleteDoc(doc(db, 'ownerMonthlyBalances', balance.id));

      // Log de auditoría
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'eliminación',
        entidad: 'owner_monthly_balance',
        detalles: `Eliminó saldo de ${balance.propietario} - ${formatCOPAmount(balance.saldo)} (${balance.mes}/${balance.anio})`,
        timestamp: new Date()
      });

      toast.success('Saldo eliminado correctamente');
    } catch (error) {
      console.error('Error deleting balance:', error);
      toast.error('Error al eliminar el saldo');
    }
  };

  // Filtrar saldos por mes/año seleccionado
  const filteredBalances = balances.filter(b => 
    b.mes === selectedMonth && b.anio === selectedYear
  );

  if (loading) {
    return <div className="text-center py-8">Cargando saldos...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg w-28"
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Upload size={20} />
            {importing ? 'Importando...' : 'Importar Saldos'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportBalances}
            className="hidden"
          />
        </div>

        <div className="text-sm text-gray-600">
          {filteredBalances.length} saldos del mes
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Propietario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Distribuido</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cuentas</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredBalances.map((balance, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{balance.propietario}</td>
                <td className="px-4 py-3 text-sm font-mono">{balance.documentoPropietario}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold">
                  <span className={balance.saldo < 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatCOPAmount(balance.saldo)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {balance.distribucion ? (
                    <span className={`px-2 py-1 text-xs rounded ${
                      balance.distribuidoManualmente 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {balance.distribuidoManualmente ? 'Manual' : 'Auto'}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {balance.distribucion?.length || 0}
                </td>
                <td className="px-4 py-3 text-center">
                  {balance.batchId ? (
                    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
                      En lote
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                      Libre
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleDeleteBalance(balance)}
                    disabled={!!balance.batchId}
                    className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title={balance.batchId ? 'No se puede eliminar (está en un lote)' : 'Eliminar saldo'}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredBalances.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay saldos para {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      {/* Modal de distribución */}
      <DistributeBalanceModal
        isOpen={showDistributeModal}
        onClose={() => {
          setShowDistributeModal(false);
          setPendingDistributions([]);
          setImporting(false);
        }}
        pendingDistributions={pendingDistributions}
        onComplete={handleDistributionComplete}
      />
    </div>
  );
}
