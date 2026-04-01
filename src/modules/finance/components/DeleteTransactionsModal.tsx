import React, { useState, useEffect, useMemo } from 'react';
import { Transaction as ProcessedTransaction } from '../../../types';
import { format, isValid, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

type SortField = 'rowIndex' | 'fecha' | 'valor' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface Account {
  id: string;
  name: string;
}

interface DeleteTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accounts: Account[];
  onDelete: (selectedIds: string[]) => Promise<void>;
}

// Función auxiliar robusta para parsear fechas
const parseDate = (fecha: any): Date | null => {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (fecha instanceof Timestamp) return fecha.toDate();
  if (typeof fecha === 'string') {
    const parsed = parseISO(fecha); // Ideal para formato ISO 'YYYY-MM-DDTHH:mm:ss.sssZ'
    if (isValid(parsed)) return parsed;
  }
  return null;
};

const DeleteTransactionsModal: React.FC<DeleteTransactionsModalProps> = ({
  isOpen,
  onClose,
  accountId,
  accounts,
  onDelete,
}) => {
  const [allTransactions, setAllTransactions] = useState<ProcessedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  
  // Filtros
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedImportDate, setSelectedImportDate] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>(accountId);
  const [showEmptyDescriptions, setShowEmptyDescriptions] = useState<boolean>(false);
  
  // Estado de ordenación - ¡Soluciona el bug del rowIndex!
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isDeleting, setIsDeleting] = useState(false);

  // Función para cargar transacciones (extraída para poder reutilizarla)
  const fetchTransactions = async () => {
    if (!selectedAccount) return;
    
    setIsLoading(true);
    console.log('[DeleteModal] Cargando transacciones desde Firestore para cuenta:', selectedAccount);
    
    try {
      const transRef = collection(db, 'transactions');
      // Usamos una consulta más simple inicialmente para evitar problemas de índices
      // y luego ordenamos los resultados en cliente
      const q = query(
        transRef, 
        where('accountId', '==', selectedAccount)
      );
      
      const snapshot = await getDocs(q);
      const fetchedTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProcessedTransaction[];

      console.log('[DeleteModal] Transacciones cargadas:', fetchedTransactions.length);
      
      // MEJORA: Verifica si hay transacciones en el estado local que no existen en Firestore
      // y muestra una advertencia si se encuentra alguna
      if (allTransactions.length > 0) {
        const currentIds = new Set(fetchedTransactions.map(t => t.id));
        const huerfanasIds = allTransactions.filter(t => !currentIds.has(t.id)).map(t => t.id);
        
        if (huerfanasIds.length > 0) {
          console.warn(`[DeleteModal] ADVERTENCIA: Detectadas ${huerfanasIds.length} transacciones huérfanas que existen en UI pero no en Firestore:`, huerfanasIds);
          toast.error(`Se detectaron ${huerfanasIds.length} transacciones huérfanas. Actualiza la página para sincronizar.`);
        }
      }
      
      // Ordenamos los datos en el cliente para evitar errores de índice
      setAllTransactions(fetchedTransactions);
    } catch (error) {
      console.error("Error fetching transactions: ", error);
      toast.error("Error al cargar las transacciones.");
    } finally {
      setIsLoading(false);
    }
  };

  // 1. HOOK PARA CARGAR LAS TRANSACCIONES DESDE FIREBASE
  useEffect(() => {
    if (isOpen) {
      fetchTransactions();
    } else {
      // Limpiar estado al cerrar
      setAllTransactions([]);
      setSelectedTransactions(new Set());
    }
  }, [isOpen, selectedAccount]); // Solo se ejecuta cuando se abre el modal o cambia la cuenta

  // 2. LÓGICA DE FILTRADO Y ORDENACIÓN USANDO useMemo PARA EFICIENCIA
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Aplicar filtros
    if (selectedYear) {
      filtered = filtered.filter(t => {
        const date = parseDate(t.fecha);
        return date?.getFullYear() === parseInt(selectedYear);
      });
    }
    
    if (selectedMonth) {
      filtered = filtered.filter(t => {
        const date = parseDate(t.fecha);
        return date?.getMonth() === parseInt(selectedMonth) - 1;
      });
    }

    if (selectedImportDate) {
      const start = startOfDay(parseISO(selectedImportDate));
      const end = endOfDay(parseISO(selectedImportDate));
      filtered = filtered.filter(t => {
        const importDate = parseDate(t.createdAt);
        return importDate && importDate >= start && importDate <= end;
      });
    }

    if (showEmptyDescriptions) {
      filtered = filtered.filter(t => !t.descripcion || t.descripcion.trim() === '');
    }
    
    // Aplicar ordenación
    return filtered.sort((a, b) => {
      let valA, valB;
      
      switch (sortField) {
        case 'fecha':
        case 'createdAt':
          valA = parseDate(a[sortField])?.getTime() || 0;
          valB = parseDate(b[sortField])?.getTime() || 0;
          break;
        default: // para 'valor' y 'rowIndex'
          valA = a[sortField] || 0;
          valB = b[sortField] || 0;
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      
      // Orden secundario por rowIndex para mantener consistencia
      if (sortField !== 'rowIndex') {
        return (a.rowIndex || 0) - (b.rowIndex || 0);
      }

      return 0;
    });
  }, [allTransactions, selectedYear, selectedMonth, selectedImportDate, showEmptyDescriptions, sortField, sortDirection]);


  // ... (el resto de las funciones como toggleTransaction, selectAll, etc. se mantienen casi igual)
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const handleDelete = async () => {
    if (selectedTransactions.size === 0) {
      console.log('[DeleteModal] No hay transacciones seleccionadas para eliminar');
      return;
    }
    
    console.log('[DeleteModal] Iniciando eliminación de', selectedTransactions.size, 'transacciones');
    console.log('[DeleteModal] IDs a eliminar:', Array.from(selectedTransactions));
    
    setIsDeleting(true);
    try {
      console.log('[DeleteModal] Llamando a onDelete con los IDs seleccionados');
      await onDelete(Array.from(selectedTransactions));
      console.log('[DeleteModal] onDelete completado exitosamente');
      
      // Guardar la cantidad de transacciones eliminadas antes de resetear la selección
      const deletedCount = selectedTransactions.size;
      
      console.log('[DeleteModal] Reseteando selección');
      setSelectedTransactions(new Set());
      
      // IMPORTANTE: Recargamos desde Firestore en lugar de solo actualizar el estado local
      // Esto garantiza que la UI refleje el estado actual de la base de datos
      console.log('[DeleteModal] Forzando recarga desde Firestore para actualizar UI');
      await fetchTransactions();
      
      // No cerramos el modal para que el usuario pueda seguir eliminando
      console.log('[DeleteModal] Mostrando notificación de éxito');
      toast.success(`${deletedCount} transacciones eliminadas.`);

    } catch (error) {
      console.error('[DeleteModal] Error al eliminar transacciones:', error);
      toast.error('Error al eliminar las transacciones.');
    } finally {
      console.log('[DeleteModal] Finalizando proceso de eliminación');
      setIsDeleting(false);
    }
  };

  const toggleTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Set(filteredAndSortedTransactions.map(t => t.id));
    setSelectedTransactions(newSelected);
  };

  const deselectAll = () => {
    setSelectedTransactions(new Set());
  };

  // Generar opciones para los filtros de forma dinámica
  const years = useMemo(() => [...new Set(allTransactions
    .map(t => parseDate(t.fecha)?.getFullYear())
    .filter((year): year is number => year !== null)
  )].sort((a, b) => b - a), [allTransactions]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-semibold">Eliminar Transacciones</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
          </div>

          <div className="p-4 flex flex-wrap gap-4 items-center border-b">
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="border rounded-lg px-3 py-2 min-w-[200px]"
            >
              {accounts?.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Todos los años</option>
              {years.map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Todos los meses</option>
              {months.map(month => (
                <option key={month} value={month.toString()}>
                  {format(new Date(2000, month - 1), 'MMMM', { locale: es })}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={selectedImportDate}
              onChange={(e) => setSelectedImportDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
              placeholder="Fecha de importación"
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showEmptyDescriptions}
                onChange={(e) => setShowEmptyDescriptions(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Solo descripciones vacías</span>
            </label>

            <div className="flex gap-2 ml-auto">
              <button 
                onClick={selectAll}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
              >
                Seleccionar todo
              </button>
              <button 
                onClick={deselectAll}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
              >
                Deseleccionar todo
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center items-center h-full py-12">
                <Loader2 className="animate-spin mr-2" size={24} />
                <span>Cargando transacciones...</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={filteredAndSortedTransactions.length > 0 && 
                          filteredAndSortedTransactions.every(t => selectedTransactions.has(t.id))}
                        onChange={() => 
                          filteredAndSortedTransactions.every(t => selectedTransactions.has(t.id))
                            ? deselectAll()
                            : selectAll()
                        }
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('rowIndex')}>
                      <div className="flex items-center gap-1">#<SortIcon field="rowIndex" /></div>
                    </th>
                    <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('fecha')}>
                      <div className="flex items-center gap-1">Fecha<SortIcon field="fecha" /></div>
                    </th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('valor')}>
                      <div className="flex items-center gap-1 justify-end">Valor<SortIcon field="valor" /></div>
                    </th>
                    <th className="px-4 py-2 text-left">Responsables</th>
                    <th className="px-4 py-2 text-left">Observaciones</th>
                    <th className="px-4 py-2 text-left">Doc. Contables</th>
                    <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                      <div className="flex items-center gap-1">Fecha de Importación<SortIcon field="createdAt" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-500">No hay transacciones que coincidan con los criterios de filtrado</td>
                    </tr>
                  ) : (
                    filteredAndSortedTransactions.map((t, index) => (
                      <tr key={`${t.id}-${index}`} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(t.id)}
                            onChange={() => toggleTransaction(t.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-2">{t.rowIndex || '—'}</td>
                        <td className="px-4 py-2">{t.fecha ? format(parseDate(t.fecha) || new Date(), 'dd/MM/yyyy', { locale: es }) : '—'}</td>
                        <td className="px-4 py-2">{t.descripcion || '—'}</td>
                        <td className="px-4 py-2 text-right">
                          {typeof t.valor === 'number' 
                            ? new Intl.NumberFormat('es-CO', {
                                style: 'currency',
                                currency: 'COP'
                              }).format(t.valor)
                            : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {t.responsible ? `${t.responsible.name} (${t.responsibleType})` : '—'}
                        </td>
                        <td className="px-4 py-2">{t.observaciones || '—'}</td>
                        <td className="px-4 py-2">{t.docContable || '—'}</td>
                        <td className="px-4 py-2">{t.createdAt ? format(parseDate(t.createdAt) || new Date(), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t flex justify-end gap-2">
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button 
              onClick={handleDelete} 
              disabled={selectedTransactions.size === 0 || isDeleting}
              className={`px-4 py-2 bg-red-500 text-white rounded-lg ${selectedTransactions.size === 0 || isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin inline mr-2" size={16} />
                  <span>Eliminando...</span>
                </>
              ) : (
                `Eliminar (${selectedTransactions.size})`
              )}
            </button>
          </div>
        </div>
      </div>
  );
};

export default DeleteTransactionsModal;