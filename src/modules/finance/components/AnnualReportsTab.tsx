import { useState } from 'react';
import { Search, Download, FileText, Eye } from 'lucide-react';
import { useCollection } from '../../../hooks/useCollection';
import { OwnerAccount, OwnerMonthlyBalance, BankPaymentBatch } from '../../../types';
import { formatCOPAmount } from '../../../utils/moneyUtils';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export default function AnnualReportsTab() {
  const { data: accounts } = useCollection<OwnerAccount>('ownerAccounts');
  const { data: balances } = useCollection<OwnerMonthlyBalance>('ownerMonthlyBalances');
  const { data: batches } = useCollection<BankPaymentBatch>('bankPaymentBatches');
  
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchOwner, setSearchOwner] = useState('');
  const [showDetailMonth, setShowDetailMonth] = useState<number | null>(null);

  // Filtrar propietarios únicos
  const uniqueOwners = Array.from(
    new Map(
      accounts.map(acc => [acc.documentoPropietario, acc])
    ).values()
  ).sort((a, b) => a.propietario.localeCompare(b.propietario));

  // Filtrar propietarios por búsqueda
  const filteredOwners = uniqueOwners.filter(owner =>
    owner.propietario.toLowerCase().includes(searchOwner.toLowerCase()) ||
    owner.documentoPropietario.includes(searchOwner)
  );

  // Generar reporte anual
  const generateReport = () => {
    if (!selectedOwner) {
      return null;
    }

    const ownerBalances = balances.filter(
      b => b.documentoPropietario === selectedOwner && b.anio === selectedYear
    );

    // Crear array con 12 meses
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const balance = ownerBalances.find(b => b.mes === i + 1);
      
      if (!balance) {
        return {
          mes: i + 1,
          nombreMes: new Date(selectedYear, i, 1).toLocaleDateString('es-ES', { month: 'long' }),
          saldoTotal: 0,
          montoPagado: 0,
          montoPendiente: 0,
          distribuido: false,
          distribuciones: [],
          estado: '-'
        };
      }

      // Analizar distribuciones
      const distribuciones = (balance.distribucion || []).map(dist => {
        const batch = dist.batchId 
          ? batches.find(b => b.id === dist.batchId)
          : null;

        return {
          banco: dist.banco,
          numeroCuenta: dist.numeroCuenta,
          monto: Math.abs(dist.monto),
          batchId: dist.batchId,
          batchStatus: dist.batchStatus,
          batchRef: dist.batchRef,
          paidAt: dist.paidAt,
          paidBy: dist.paidBy,
          isPagado: dist.batchStatus === 'pagado',
          batch
        };
      });

      const montoPagado = distribuciones
        .filter(d => d.isPagado)
        .reduce((sum, d) => sum + d.monto, 0);
      
      const montoPendiente = distribuciones
        .filter(d => !d.isPagado)
        .reduce((sum, d) => sum + d.monto, 0);

      const todasPagadas = distribuciones.length > 0 && distribuciones.every(d => d.isPagado);
      const algunaPagada = distribuciones.some(d => d.isPagado);

      return {
        mes: i + 1,
        nombreMes: new Date(selectedYear, i, 1).toLocaleDateString('es-ES', { month: 'long' }),
        saldoTotal: Math.abs(balance.saldo),
        montoPagado,
        montoPendiente,
        distribuido: !!balance.distribucion,
        distribuciones,
        estado: todasPagadas ? 'pagado' : algunaPagada ? 'parcial' : distribuciones.length > 0 ? 'pendiente' : '-'
      };
    });

    return monthlyData;
  };

  const reportData = generateReport();
  const totalPagado = reportData?.reduce((sum, m) => sum + m.montoPagado, 0) || 0;
  const totalPendiente = reportData?.reduce((sum, m) => sum + m.montoPendiente, 0) || 0;
  const mesesPagados = reportData?.filter(m => m.estado === 'pagado').length || 0;
  const mesesParciales = reportData?.filter(m => m.estado === 'parcial').length || 0;

  const handleExportCSV = () => {
    if (!reportData) return;

    const owner = accounts.find(a => a.documentoPropietario === selectedOwner);
    if (!owner) return;

    const csvData = reportData.map(row => ({
      'Mes': row.nombreMes,
      'Total': formatCOPAmount(row.saldoTotal).replace('$ ', ''),
      'Pagado': formatCOPAmount(row.montoPagado).replace('$ ', ''),
      'Pendiente': formatCOPAmount(row.montoPendiente).replace('$ ', ''),
      'Estado': row.estado
    }));

    // Agregar fila de total
    csvData.push({
      'Mes': 'TOTAL ANUAL',
      'Total': formatCOPAmount(totalPagado + totalPendiente).replace('$ ', ''),
      'Pagado': formatCOPAmount(totalPagado).replace('$ ', ''),
      'Pendiente': formatCOPAmount(totalPendiente).replace('$ ', ''),
      'Estado': `${mesesPagados} pagados, ${mesesParciales} parciales`
    });

    const csv = Papa.unparse(csvData, {
      delimiter: ';',
      header: true
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_anual_${owner.propietario.replace(/\s/g, '_')}_${selectedYear}.csv`;
    link.click();

    toast.success('Reporte exportado');
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar Propietario
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              value={searchOwner}
              onChange={(e) => setSearchOwner(e.target.value)}
              placeholder="Nombre o documento..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          
          {searchOwner && (
            <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg bg-white">
              {filteredOwners.map(owner => (
                <button
                  key={owner.documentoPropietario}
                  onClick={() => {
                    setSelectedOwner(owner.documentoPropietario);
                    setSearchOwner('');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="font-medium">{owner.propietario}</div>
                  <div className="text-sm text-gray-600">{owner.documentoPropietario}</div>
                </button>
              ))}
              {filteredOwners.length === 0 && (
                <div className="px-4 py-2 text-gray-500 text-sm">No se encontraron resultados</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Propietario seleccionado */}
      {selectedOwner && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">
                {accounts.find(a => a.documentoPropietario === selectedOwner)?.propietario}
              </h3>
              <p className="text-sm text-gray-600">NIT: {selectedOwner}</p>
            </div>
            <button
              onClick={() => setSelectedOwner('')}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Cambiar propietario
            </button>
          </div>
        </div>
      )}

      {/* Reporte */}
      {reportData && selectedOwner ? (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-lg">
              Reporte Anual {selectedYear}
            </h3>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download size={20} />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pagado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row) => (
                  <tr key={row.mes} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium capitalize">
                      {row.nombreMes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {row.saldoTotal !== 0 ? (
                        <span className="text-gray-900">
                          {formatCOPAmount(row.saldoTotal)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {row.montoPagado !== 0 ? (
                        <span className="text-green-600">
                          {formatCOPAmount(row.montoPagado)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {row.montoPendiente !== 0 ? (
                        <span className="text-red-600">
                          {formatCOPAmount(row.montoPendiente)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {row.estado === 'pagado' ? (
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                          ✓ Pagado
                        </span>
                      ) : row.estado === 'parcial' ? (
                        <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                          ⚠ Parcial
                        </span>
                      ) : row.estado === 'pendiente' ? (
                        <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                          ⏳ Pendiente
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {row.distribuciones.length > 0 && (
                        <button
                          onClick={() => setShowDetailMonth(row.mes)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Eye size={14} />
                          Ver Detalle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td className="px-6 py-4 font-bold text-sm">TOTAL ANUAL</td>
                  <td className="px-6 py-4 text-right font-bold text-lg text-gray-900">
                    {formatCOPAmount(totalPagado + totalPendiente)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-lg text-green-600">
                    {formatCOPAmount(totalPagado)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-lg text-red-600">
                    {formatCOPAmount(totalPendiente)}
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-sm" colSpan={2}>
                    {mesesPagados} pagados • {mesesParciales} parciales • {12 - mesesPagados - mesesParciales} pendientes
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <p>Selecciona un propietario para ver su reporte anual</p>
        </div>
      )}

      {/* Modal de Detalle de Mes */}
      {showDetailMonth !== null && reportData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {(() => {
              const monthData = reportData.find(m => m.mes === showDetailMonth);
              if (!monthData) return null;

              return (
                <>
                  <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
                    <div>
                      <h3 className="text-xl font-semibold capitalize">Detalle de {monthData.nombreMes} {selectedYear}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {accounts.find(a => a.documentoPropietario === selectedOwner)?.propietario}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDetailMonth(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-6">
                    {/* Resumen */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Total del Mes</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {formatCOPAmount(monthData.saldoTotal)}
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-sm text-green-700">Pagado</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">
                          {formatCOPAmount(monthData.montoPagado)}
                        </div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-sm text-red-700">Pendiente</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">
                          {formatCOPAmount(monthData.montoPendiente)}
                        </div>
                      </div>
                    </div>

                    {/* Detalle de Distribuciones */}
                    <h4 className="font-semibold text-lg mb-4">Distribuciones de Pago</h4>
                    <div className="space-y-3">
                      {monthData.distribuciones.map((dist, idx) => (
                        <div 
                          key={idx} 
                          className={`border rounded-lg p-4 ${
                            dist.isPagado ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-lg">{dist.banco}</span>
                                {dist.isPagado ? (
                                  <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                                    ✓ Pagado
                                  </span>
                                ) : dist.batchStatus === 'pendiente' ? (
                                  <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                                    ⏳ En lote
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                                    Sin lote
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                <div>
                                  <span className="text-gray-600">Cuenta:</span>
                                  <span className="ml-2 font-mono font-medium">{dist.numeroCuenta}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Monto:</span>
                                  <span className="ml-2 font-bold text-green-600">
                                    {formatCOPAmount(dist.monto)}
                                  </span>
                                </div>
                                
                                {dist.batchRef && (
                                  <div>
                                    <span className="text-gray-600">Lote:</span>
                                    <span className="ml-2 font-medium">{dist.batchRef}</span>
                                  </div>
                                )}
                                
                                {dist.isPagado && dist.paidAt && (
                                  <div>
                                    <span className="text-gray-600">Fecha de pago:</span>
                                    <span className="ml-2 font-medium">
                                      {dist.paidAt instanceof Date 
                                        ? dist.paidAt.toLocaleDateString('es-ES')
                                        : new Date((dist.paidAt as any).toDate()).toLocaleDateString('es-ES')
                                      }
                                    </span>
                                  </div>
                                )}
                                
                                {dist.paidBy && (
                                  <div className="col-span-2">
                                    <span className="text-gray-600">Pagado por:</span>
                                    <span className="ml-2 font-medium text-blue-600">{dist.paidBy}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {monthData.distribuciones.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No hay distribuciones para este mes
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 bg-gray-100 border-t px-6 py-4 flex justify-end">
                    <button
                      onClick={() => setShowDetailMonth(null)}
                      className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
