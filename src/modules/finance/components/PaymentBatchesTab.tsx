import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Download, Eye, CheckCircle, Trash2, RotateCcw, RefreshCw } from 'lucide-react';
import { useCollection } from '../../../hooks/useCollection';
import { BankPaymentBatch, OwnerMonthlyBalance, OwnerAccount } from '../../../types';
import { formatCOPAmount } from '../../../utils/moneyUtils';
import { doc, collection, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import CreateBatchModal from './CreateBatchModal';
import MarkPaidModal from './MarkPaidModal';

type BankGroupItem = {
  balanceId: string;
  propietario: string;
  documentoPropietario: string;
  pagarA: string;
  documentoBeneficiario: string;
  banco: string;
  numeroCuenta: string;
  monto: number;
  porcentaje: number;
  ownerAccountId: string;  // IMPORTANTE: Para identificar la distribución específica
};

interface PaymentBatchesTabProps {
  defaultStatusFilter?: 'todos' | 'pendiente' | 'pagado';
}

export default function PaymentBatchesTab({ defaultStatusFilter = 'todos' }: PaymentBatchesTabProps = {}) {
  const { data: balances, refresh: refreshBalances } = useCollection<OwnerMonthlyBalance>('ownerMonthlyBalances');
  const { data: accounts, refresh: refreshAccounts } = useCollection<OwnerAccount>('ownerAccounts');
  const { data: batches = [], loading, refresh: refreshBatches } = useCollection<BankPaymentBatch>('bankPaymentBatches', {
    orderBy: [{ field: 'createdAt', direction: 'desc' }]
  });
  
  const handleRefresh = () => {
    refreshBalances();
    refreshAccounts();
    refreshBatches();
    toast.success('Datos actualizados');
  };
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBanco, setFilterBanco] = useState('todos');
  
  // Reset filters to current month/year when switching tabs
  useEffect(() => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
    setFilterBanco('todos');
    setSearchQuery('');
  }, [defaultStatusFilter]);
  
  // UI State
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [selectedCuentas, setSelectedCuentas] = useState<Set<string>>(new Set());
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalData, setCreateModalData] = useState<any>(null);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paidModalBatch, setPaidModalBatch] = useState<BankPaymentBatch | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'todos' | 'pendiente' | 'pagado'>(defaultStatusFilter);

  // Filtrar saldos pendientes del mes/año seleccionado
  const availableBalances = useMemo(() => {
    return (balances || []).filter(b => 
      b.mes === selectedMonth && 
      b.anio === selectedYear &&
      b.distribucion && // Tiene distribución
      b.distribucion.some(dist => !dist.batchId) && // Al menos una distribución sin lote
      b.saldo < 0 // Es deuda (a pagar)
    );
  }, [balances, selectedMonth, selectedYear]);

  // Agrupar por banco
  const balancesByBank = useMemo<Record<string, BankGroupItem[]>>(() => {
    const grouped: Record<string, BankGroupItem[]> = {};
    
    availableBalances.forEach(balance => {
      if (!balance.distribucion) return;
      
      balance.distribucion.forEach(dist => {
        // IMPORTANTE: Solo incluir distribuciones que NO estén en lote
        if (dist.batchId) return;
        
        if (!grouped[dist.banco]) {
          grouped[dist.banco] = [];
        }
        
        // Buscar la cuenta para obtener información del beneficiario
        const account = (accounts || []).find(acc => acc.id === dist.ownerAccountId);
        
        grouped[dist.banco].push({
          balanceId: balance.id!,
          propietario: balance.propietario,
          documentoPropietario: balance.documentoPropietario,
          pagarA: account?.pagarA || balance.propietario,
          documentoBeneficiario: account?.documentoBeneficiario || balance.documentoPropietario,
          banco: dist.banco,
          numeroCuenta: dist.numeroCuenta,
          monto: Math.abs(dist.monto), // Mostrar siempre positivo en UI
          porcentaje: Math.round((Math.abs(dist.monto) / Math.abs(balance.saldo)) * 100),
          ownerAccountId: dist.ownerAccountId  // Para identificar la distribución
        });
      });
    });

    const query = searchQuery.trim().toLowerCase();
    Object.keys(grouped).forEach(banco => {
      if (query) {
        grouped[banco] = grouped[banco].filter((item) =>
          item.propietario.toLowerCase().includes(query) ||
          item.documentoPropietario.includes(query) ||
          item.pagarA.toLowerCase().includes(query) ||
          item.documentoBeneficiario.toLowerCase().includes(query) ||
          item.numeroCuenta.includes(query)
        );
      }

      // Ordenar beneficiarios alfabéticamente dentro de cada banco
      grouped[banco].sort((a, b) => 
        a.pagarA.localeCompare(b.pagarA, 'es', { sensitivity: 'base' })
      );

      if (grouped[banco].length === 0) {
        delete grouped[banco];
      }
    });

    if (filterBanco !== 'todos') {
      const filtered = grouped[filterBanco];
      return filtered ? { [filterBanco]: filtered } : {};
    }

    return grouped;
  }, [availableBalances, searchQuery, filterBanco, accounts]);

  const bancos = useMemo(() => Object.keys(balancesByBank).sort(), [balancesByBank]);
  const filteredPropietarios = useMemo(() => {
    const set = new Set<string>();
    bancos.forEach(banco => {
      const items = balancesByBank[banco] || [];
      items.forEach(item => set.add(item.documentoPropietario));
    });
    return set.size;
  }, [balancesByBank, bancos]);

  const filteredTotal = useMemo(() => {
    return bancos.reduce((acc, banco) => {
      const items = balancesByBank[banco] || [];
      return acc + items.reduce((sum: number, item: any) => sum + item.monto, 0);
    }, 0);
  }, [balancesByBank, bancos]);

  const filteredBatches = useMemo(() => {
    let filtered = batches;
    
    // Filtrar por mes y año
    filtered = filtered.filter(batch => 
      batch.mes === selectedMonth && batch.anio === selectedYear
    );
    
    // Filtrar por estado
    if (paymentStatusFilter !== 'todos') {
      filtered = filtered.filter(batch => batch.status === paymentStatusFilter);
    }
    
    // Filtrar por banco
    if (filterBanco !== 'todos') {
      filtered = filtered.filter(batch => batch.banco === filterBanco);
    }
    
    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(batch => 
        batch.referencia.toLowerCase().includes(query) ||
        batch.banco.toLowerCase().includes(query) ||
        batch.items.some(item => 
          item.propietario.toLowerCase().includes(query) ||
          item.documentoPropietario.includes(query) ||
          item.pagarA.toLowerCase().includes(query) ||
          item.numeroCuenta.includes(query)
        )
      );
    }
    
    return filtered;
  }, [batches, paymentStatusFilter, searchQuery, filterBanco, selectedMonth, selectedYear]);
  const allBancos = Array.from(new Set((balances || []).flatMap(b => 
    (b.distribucion || []).map(d => d.banco)
  ))).sort();

  const handleCreateBatch = async (banco: string, items: any[]) => {
    setCreateModalData({
      banco,
      items,
      cuentas: items.length,
      propietarios: new Set(items.map(i => i.documentoPropietario)).size,
      total: items.reduce((sum, i) => sum + i.monto, 0)
    });
    setShowCreateModal(true);
  };

  const confirmCreateBatch = async (data: any) => {
    try {
      const batchId = doc(collection(db, 'bankPaymentBatches')).id;
      const batchRef = doc(db, 'bankPaymentBatches', batchId);
      const batch = writeBatch(db);

      const batchData: Omit<BankPaymentBatch, 'id'> = {
        referencia: data.referencia,
        banco: createModalData.banco,
        mes: selectedMonth,
        anio: selectedYear,
        items: createModalData.items,
        totalMonto: createModalData.total,
        status: 'pendiente',
        fechaProgramada: data.fechaProgramada,
        observaciones: data.observaciones,
        createdBy: auth.currentUser?.email || '',
        createdAt: new Date()
      };

      batch.set(batchRef, batchData);

      const balanceIds = Array.from(new Set(createModalData.items.map((i: any) => i.balanceId)));
      
      for (const bId of balanceIds as string[]) {
        const balanceDoc = await getDoc(doc(db, 'ownerMonthlyBalances', bId));
        if (balanceDoc.exists()) {
          const currentDist = balanceDoc.data().distribucion || [];
          const newDist = currentDist.map((dist: any) => {
            const item = createModalData.items.find((i: any) => i.balanceId === bId && i.ownerAccountId === dist.ownerAccountId);
            if (item) {
              return { 
                ...dist, 
                batchId, 
                batchStatus: 'pendiente', 
                batchRef: data.referencia 
              };
            }
            return dist;
          });
          batch.update(balanceDoc.ref, { distribucion: newDist });
        }
      }

      await batch.commit();

      // Log
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'creación',
        entidad: 'bank_payment_batch',
        detalles: `Creó lote ${data.referencia} para ${createModalData.banco} con ${createModalData.items.length} distribuciones`,
        timestamp: new Date()
      });

      toast.success(`Lote creado: ${data.referencia}`);
      setShowCreateModal(false);
      setCreateModalData(null);
      setSelectedCuentas(new Set());
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Error al crear el lote');
    }
  };

  const handleMarkPaid = async (data: any) => {
    if (!paidModalBatch?.id) return;

    try {
      const batch = writeBatch(db);
      const batchRef = doc(db, 'bankPaymentBatches', paidModalBatch.id);

      // 1. Actualizar el lote
      batch.update(batchRef, {
        status: 'pagado',
        fechaPago: data.fechaPago,
        comprobante: data.comprobante,
        paidBy: auth.currentUser?.email,
        paidAt: new Date()
      });

      // 2. Actualizar las distribuciones específicas de este lote
      const balanceIds = Array.from(new Set(paidModalBatch.items.map((i: any) => i.balanceId)));
      
      for (const bId of balanceIds as string[]) {
        const balanceDoc = await getDoc(doc(db, 'ownerMonthlyBalances', bId));
        if (balanceDoc.exists()) {
          const currentDist = balanceDoc.data().distribucion || [];
          const newDist = currentDist.map((dist: any) => {
            // Identificar por batchId (más seguro que por ownerAccountId)
            if (dist.batchId === paidModalBatch.id) {
              return {
                ...dist,
                batchStatus: 'pagado',
                paidAt: data.fechaPago,
                paidBy: auth.currentUser?.email
              };
            }
            return dist;
          });
          batch.update(balanceDoc.ref, { distribucion: newDist });
        }
      }

      await batch.commit();

      // 3. Log de auditoría
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'pago',
        entidad: 'bank_payment_batch',
        detalles: `Marcó como pagado: ${paidModalBatch.referencia} (${paidModalBatch.items.length} distribuciones, ${formatCOPAmount(paidModalBatch.totalMonto)})`,
        timestamp: new Date()
      });

      toast.success('Lote marcado como pagado');
      setShowPaidModal(false);
      setPaidModalBatch(null);
      setSelectedCuentas(new Set());
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Error al marcar como pagado');
    }
  };

  const handleDeleteBatch = async (batch: BankPaymentBatch) => {
    if (!batch.id) return;
    if (!window.confirm(`¿Eliminar lote ${batch.referencia}?`)) return;

    try {
      const batchOp = writeBatch(db);
      const batchRef = doc(db, 'bankPaymentBatches', batch.id);

      // NUEVA LÓGICA ATÓMICA: Liberar SOLO las distribuciones de este lote
      const balanceIds = Array.from(new Set(batch.items.map((i: any) => i.balanceId)));
      
      for (const bId of balanceIds as string[]) {
        const balanceDoc = await getDoc(doc(db, 'ownerMonthlyBalances', bId));
        if (balanceDoc.exists()) {
          const currentDist = balanceDoc.data().distribucion || [];
          const newDist = currentDist.map((dist: any) => {
            if (dist.batchId === batch.id) {
              return {
                ...dist,
                batchId: null,
                batchStatus: null,
                batchRef: null
              };
            }
            return dist;
          });
          batchOp.update(balanceDoc.ref, { distribucion: newDist });
        }
      }

      // Eliminar el lote
      batchOp.delete(batchRef);

      await batchOp.commit();

      // Log
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'eliminación',
        entidad: 'bank_payment_batch',
        detalles: `Eliminó lote ${batch.referencia} (${batch.items.length} distribuciones liberadas)`,
        timestamp: new Date()
      });

      toast.success('Lote eliminado');
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast.error('Error al eliminar el lote');
    }
  };

  const toggleBank = (banco: string) => {
    const newSet = new Set(expandedBanks);
    if (newSet.has(banco)) {
      newSet.delete(banco);
    } else {
      newSet.add(banco);
    }
    setExpandedBanks(newSet);
  };

  const toggleSelectAll = (items: BankGroupItem[]) => {
    const itemKeys = items.map(i => `${i.balanceId}-${i.numeroCuenta}`);
    const allSelected = itemKeys.every(k => selectedCuentas.has(k));

    const newSet = new Set(selectedCuentas);
    if (allSelected) {
      itemKeys.forEach(k => newSet.delete(k));
    } else {
      itemKeys.forEach(k => newSet.add(k));
    }
    setSelectedCuentas(newSet);
  };

  const toggleSelectCuenta = (item: any) => {
    const key = `${item.balanceId}-${item.numeroCuenta}`;
    const newSet = new Set(selectedCuentas);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedCuentas(newSet);
  };

  const getSelectedItems = (banco: string) => {
    const items = balancesByBank[banco] || [];
    return items.filter((i: any) => selectedCuentas.has(`${i.balanceId}-${i.numeroCuenta}`));
  };

  const handleRevertPayment = async (batch: BankPaymentBatch) => {
    if (!batch.id) return;

    // Restringir a lotes de los últimos 2 meses
    const now = new Date();
    const monthsDiff = (now.getFullYear() - batch.anio) * 12 + ((now.getMonth() + 1) - batch.mes);
    if (monthsDiff > 2) {
      toast.error('Solo se pueden revertir pagos de los últimos 2 meses.');
      return;
    }
    
    // 1. Confirmación de seguridad
    const confirmRef = window.prompt(
      `⚠️ ESTA ACCIÓN REVERTIRÁ EL PAGO A ESTADO PENDIENTE.\n\n` +
      `Para confirmar, escribe el nombre del lote:\n"${batch.referencia}"`
    );

    if (confirmRef !== batch.referencia) {
      if (confirmRef !== null) {
        toast.error('La referencia no coincide. Acción cancelada.');
      }
      return;
    }

    try {
      const batchOp = writeBatch(db);
      const batchRef = doc(db, 'bankPaymentBatches', batch.id);

      // 2. Revertir estado del lote
      batchOp.update(batchRef, {
        status: 'pendiente',
        fechaPago: null,
        comprobante: null,
        paidBy: null,
        paidAt: null,
        revertedAt: new Date(),
        revertedBy: auth.currentUser?.email
      });

      // 3. Revertir distribuciones en los balances
      const balanceIds = Array.from(new Set(batch.items.map((i: any) => i.balanceId)));
      
      for (const bId of balanceIds as string[]) {
        const balanceDoc = await getDoc(doc(db, 'ownerMonthlyBalances', bId));
        if (balanceDoc.exists()) {
          const currentDist = balanceDoc.data().distribucion || [];
          const newDist = currentDist.map((dist: any) => {
            if (dist.batchId === batch.id) {
              return {
                ...dist,
                batchStatus: 'pendiente',
                paidAt: null,
                paidBy: null
              };
            }
            return dist;
          });
          batchOp.update(balanceDoc.ref, { distribucion: newDist });
        }
      }

      await batchOp.commit();

      // 4. Log de auditoría
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'reversión_pago',
        entidad: 'bank_payment_batch',
        detalles: `Revirtió pago del lote ${batch.referencia} (${batch.items.length} distribuciones)`,
        timestamp: new Date()
      });

      toast.success('Pago revertido a pendiente exitosamente');
    } catch (error) {
      console.error('Error reverting payment:', error);
      toast.error('Error al revertir el pago');
    }
  };

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('es-ES', { month: 'long' });

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controles principales */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mes</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Año</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg w-28"
            />
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar propietario, beneficiario, documento o cuenta..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Banco</label>
            <select
              value={filterBanco}
              onChange={(e) => setFilterBanco(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="todos">Todos los bancos</option>
              {allBancos.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setPaymentStatusFilter(prev => prev === 'todos' ? 'pendiente' : prev === 'pendiente' ? 'pagado' : 'todos')}
            className="px-3 py-2 border rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-700"
            title="Filtrar pagos realizados"
          >
            {paymentStatusFilter === 'todos' && 'Pagos: todos'}
            {paymentStatusFilter === 'pendiente' && 'Pagos: pendientes'}
            {paymentStatusFilter === 'pagado' && 'Pagos: realizados'}
          </button>

          <button
            onClick={handleRefresh}
            className="px-3 py-2 border rounded-lg text-sm font-medium transition-colors bg-white text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            title="Actualizar datos"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Resumen Compacto */}
      <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span className="font-medium text-blue-900">📊 {monthName} {selectedYear}</span>
            {paymentStatusFilter === 'pagado' ? (
              <span className="text-gray-700">
                Total pagado: <strong className="text-green-600">{formatCOPAmount(
                  filteredBatches.reduce((sum, batch) => sum + batch.totalMonto, 0)
                )}</strong>
              </span>
            ) : (
              <span className="text-gray-700">
                Total pendiente: <strong className="text-red-600">{formatCOPAmount(filteredTotal || 0)}</strong>
              </span>
            )}
            {paymentStatusFilter !== 'pagado' && (
              <>
                <span className="text-gray-700">
                  {bancos.length} {bancos.length === 1 ? 'banco' : 'bancos'}
                </span>
                <span className="text-gray-700">
                  {filteredPropietarios} {filteredPropietarios === 1 ? 'propietario' : 'propietarios'}
                </span>
              </>
            )}
            {paymentStatusFilter === 'pagado' && (
              <span className="text-gray-700">
                {filteredBatches.length} {filteredBatches.length === 1 ? 'lote' : 'lotes'}
              </span>
            )}
          </div>
          {selectedCuentas.size > 0 && (
            <span className="text-blue-600 font-semibold">
              ✓ {selectedCuentas.size} {selectedCuentas.size === 1 ? 'cuenta seleccionada' : 'cuentas seleccionadas'}
            </span>
          )}
        </div>
      </div>

      {/* Agrupación por Banco - Solo en Por Pagar */}
      {paymentStatusFilter !== 'pagado' && (
      <div className="space-y-3">
        {bancos.map(banco => {
          const items = balancesByBank[banco] ?? [];
          const totalMonto = items.reduce((sum, i) => sum + i.monto, 0);
          const propietariosCount = new Set(items.map(i => i.documentoPropietario)).size;
          const isExpanded = expandedBanks.has(banco);
          const selectedItems = getSelectedItems(banco);

          return (
            <div key={banco} className="border rounded-lg bg-white shadow-sm">
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleBank(banco)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <div>
                      <h3 className="font-semibold text-lg">🏦 {banco}</h3>
                      <div className="text-sm text-gray-600">
                        {propietariosCount} propietarios • {items.length} cuentas
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Total</div>
                      <div className="text-lg font-bold text-red-600">
                        {formatCOPAmount(totalMonto)}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSelectAll(items)}
                      className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                    >
                      Seleccionar todo
                    </button>
                    {selectedItems.length > 0 && (
                      <button
                        onClick={() => handleCreateBatch(banco, selectedItems)}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        💸 Pago realizado ({selectedItems.length})
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2">
                    {/* Encabezados */}
                    <div className="grid grid-cols-12 gap-3 px-3 py-2 bg-gray-100 rounded text-xs font-medium text-gray-600 uppercase">
                      <div className="col-span-1"></div>
                      <div className="col-span-2">Banco</div>
                      <div className="col-span-2">Beneficiario</div>
                      <div className="col-span-2">No. Cuenta</div>
                      <div className="col-span-2 text-right">Valor</div>
                      <div className="col-span-3">Propietario</div>
                    </div>
                    
                    {[...items]
                      .sort((a, b) => a.pagarA.localeCompare(b.pagarA, 'es', { sensitivity: 'base' }))
                      .map((item, idx) => {
                      const key = `${item.balanceId}-${item.numeroCuenta}`;
                      const isSelected = selectedCuentas.has(key);

                      return (
                        <div
                          key={idx}
                          className={`grid grid-cols-12 gap-3 p-3 border rounded items-center ${
                            isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="col-span-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCuenta(item)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </div>
                          
                          {/* Banco */}
                          <div className="col-span-2">
                            <div className="font-bold text-blue-900">{item.banco}</div>
                          </div>
                          
                          {/* Beneficiario */}
                          <div className="col-span-2">
                            <div className="font-semibold text-green-800">{item.pagarA}</div>
                            <div className="text-xs font-mono text-gray-600">{item.documentoBeneficiario}</div>
                          </div>
                          
                          {/* Número de Cuenta */}
                          <div className="col-span-2">
                            <div className="font-mono font-medium text-purple-800">{item.numeroCuenta}</div>
                          </div>
                          
                          {/* Valor a Pagar */}
                          <div className="col-span-2 text-right">
                            <div className="font-bold text-red-600 text-lg">
                              {formatCOPAmount(item.monto)}
                            </div>
                          </div>
                          
                          {/* Propietario (menos prominente) */}
                          <div className="col-span-3">
                            <div className="text-sm text-gray-700">{item.propietario}</div>
                            <div className="text-xs text-gray-500">{item.documentoPropietario}</div>
                            {item.pagarA !== item.propietario && (
                              <div className="text-xs text-orange-600 font-medium">⚠ Beneficiario diferente</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Lotes Creados */}
      {filteredBatches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">📦 Lotes Creados</h2>
          <div className="space-y-3">
            {filteredBatches.map(batch => (
              <div key={batch.id} className="border rounded-lg bg-white p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{batch.referencia}</h3>
                      <span className={`px-2 py-1 text-xs rounded ${
                        batch.status === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {batch.status === 'pagado' ? '✅ Pagado' : '🟡 Pendiente'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {batch.banco} • {batch.items.length} cuentas • {formatCOPAmount(batch.totalMonto)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Creado el {batch.createdAt instanceof Date ? batch.createdAt.toLocaleDateString('es-ES') : 
                      new Date(batch.createdAt.toDate()).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id!)}
                      className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                      title="Ver detalles"
                    >
                      <Eye size={16} />
                    </button>
                    {batch.status === 'pagado' && (
                      <button
                        onClick={() => handleRevertPayment(batch)}
                        className="px-3 py-2 text-sm bg-orange-100 text-orange-700 border border-orange-200 rounded hover:bg-orange-200"
                        title="Revertir pago a pendiente"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    {batch.status === 'pendiente' && (
                      <>
                        <button
                          onClick={() => {
                            setPaidModalBatch(batch);
                            setShowPaidModal(true);
                          }}
                          className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch)}
                          className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    <button
                      className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>

                {expandedBatch === batch.id && (
                  <div className="mt-4 border-t pt-4">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="pb-2 font-semibold">Banco</th>
                          <th className="pb-2 font-semibold">Beneficiario</th>
                          <th className="pb-2 font-semibold">No. Cuenta</th>
                          <th className="pb-2 text-right font-semibold">Valor</th>
                          <th className="pb-2 text-xs">Propietario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...batch.items]
                          .sort((a, b) => (a.pagarA || a.propietario).localeCompare(b.pagarA || b.propietario, 'es', { sensitivity: 'base' }))
                          .map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="py-3">
                              <div className="font-bold text-blue-900">{item.banco}</div>
                            </td>
                            <td className="py-3">
                              <div className="font-semibold text-green-800">{item.pagarA || item.propietario}</div>
                              <div className="text-xs font-mono text-gray-600">{item.documentoBeneficiario || item.documentoPropietario}</div>
                              {item.pagarA && item.pagarA !== item.propietario && (
                                <div className="text-xs text-orange-600 font-medium">⚠ Diferente al propietario</div>
                              )}
                            </td>
                            <td className="py-3">
                              <div className="font-mono font-medium text-purple-800">{item.numeroCuenta}</div>
                            </td>
                            <td className="py-3 text-right">
                              <div className="font-bold text-red-600 text-lg">
                                {formatCOPAmount(item.monto)}
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="text-sm text-gray-700">{item.propietario}</div>
                              <div className="text-xs text-gray-500">{item.documentoPropietario}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      {showCreateModal && createModalData && (
        <CreateBatchModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalData(null);
          }}
          banco={createModalData.banco}
          cuentasSeleccionadas={createModalData.cuentas}
          propietariosAfectados={createModalData.propietarios}
          totalMonto={createModalData.total}
          mes={selectedMonth}
          anio={selectedYear}
          onConfirm={confirmCreateBatch}
        />
      )}

      {showPaidModal && paidModalBatch && (
        <MarkPaidModal
          isOpen={showPaidModal}
          onClose={() => {
            setShowPaidModal(false);
            setPaidModalBatch(null);
          }}
          batch={paidModalBatch}
          onConfirm={handleMarkPaid}
        />
      )}
    </div>
  );
}
