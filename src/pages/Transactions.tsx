import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirestoreOptimized } from '../hooks/useFirestoreOptimized';
import { useAssignResponsible } from '../hooks/useAssignResponsible';
import { Transaction, Assignment, Responsible } from '../types';
import toast from 'react-hot-toast';
import { extractDetailsCode } from '../utils/transactionProcessor';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/shared/Pagination';
import { FirestoreMetrics } from '../components/shared/FirestoreMetrics';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthState } from '../hooks/useAuthState';
import { TransactionFilters } from '../modules/finance/components/transactions/TransactionFilters';
import { TransactionRow } from '../modules/finance/components/transactions/TransactionRow';

// Declaración global para el navegador
declare global {
  interface Navigator {
    msSaveOrOpenBlob?: (blob: Blob, filename: string) => boolean;
    msSaveBlob?: (blob: Blob, filename: string) => boolean;
  }
}

export default function Transactions() {
  const { user } = useAuthState();

  // --- OBTENCIÓN DE DATOS ---
  const { 
    data: transactions, 
    loading: transactionsLoading, 
    metrics: transactionsMetrics,
    updateItem: updateTransaction
  } = useFirestoreOptimized<Transaction>('transactions', {
    expireTime: 5,
    localStorageKey: 'transactionsCache',
    orderByField: 'rowIndex',
    orderDirection: 'asc'
  });

  const { data: responsibles } = useFirestoreOptimized<Responsible>('responsibles');
  const { data: assignments, deleteItem: deleteAssignment } = useFirestoreOptimized<Assignment>('assignments');
  const { assignResponsible } = useAssignResponsible();

  // --- ESTADO DE FILTROS ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterResponsible, setFilterResponsible] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [filterDetails, setFilterDetails] = useState<'all' | 'withObservaciones'>('all');
  // En el backup, setFilterDocContable no se usa, pero filterDocContable sí se utiliza en la lógica de filtrado
  const [filterDocContable] = useState<'all' | 'withDoc' | 'withoutDoc'>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [hideZeroValues, setHideZeroValues] = useState(true);
  const [hideGravDesc, setHideGravDesc] = useState(true);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set(['all']));

  // --- ESTADO DE LA UI ---
  // Se elimina el estado para el modal ya que ahora usamos asignación inline

  // --- EFECTOS PARA VALORES POR DEFECTO ---
  useEffect(() => {
    if (transactions && transactions.length > 0 && !selectedAccount) {
      const firstAccount = transactions[0].accountName;
      setSelectedAccount(firstAccount);
    }
  }, [transactions, selectedAccount]);

  useEffect(() => {
    if (!selectedMonth) {
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      setSelectedMonth(currentMonth);
    }
  }, [selectedMonth]);
  
  // Efecto para debounce de la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    // Limpieza del timeout si search cambia antes de que se complete
    return () => clearTimeout(timer);
  }, [search]);
  
  // --- DATOS MEMOIZADOS PARA FILTROS Y RENDERIZADO ---
  const uniqueAccounts = useMemo(() => {
    return [...new Set(transactions?.map(t => t.accountName) || [])].sort();
  }, [transactions]);
  
  const uniqueYears = useMemo(() => {
    return [...new Set(transactions?.map(t => t.fechaStr.split('/')[2]).filter(Boolean) || [])].sort();
  }, [transactions]);

  const availableMonths = useMemo(() => {
    return transactions
      ? Array.from(new Set(
          transactions
            .filter(t => selectedYear === 'all' || t.fechaStr.split('/')[2] === selectedYear)
            .map(t => t.fechaStr.split('/')[1])
        )).sort()
        .map(month => ({
          value: month,
          label: new Date(2000, parseInt(month) - 1).toLocaleString('es', { month: 'long' })
        }))
      : [];
  }, [transactions, selectedYear]);

  // --- LÓGICA CENTRAL DE FILTRADO Y DATOS ---

  // Crear un mapa de responsableId -> Responsible para acceso rápido
  const responsiblesMap = useMemo(() => {
    if (!responsibles) return new Map<string, Responsible>();
    return new Map(responsibles.map(r => [r.id, r]));
  }, [responsibles]);

  // Crear un mapa de transactionId -> Responsible para acceso O(1)
  const transactionResponsibleMap = useMemo(() => {
    if (!assignments) return new Map<string, Responsible>();
    
    const map = new Map<string, Responsible>();
    
    assignments.forEach(assignment => {
      const responsible = responsiblesMap.get(assignment.responsibleId);
      if (responsible) {
        map.set(assignment.transactionId, responsible);
      }
    });
    
    return map;
  }, [assignments, responsiblesMap]);

  // Función optimizada: ahora es O(1) en lugar de O(n)
  const getResponsibleInfo = useCallback((transactionId: string): Responsible | undefined => {
    return transactionResponsibleMap.get(transactionId);
  }, [transactionResponsibleMap]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(transaction => {
      // Tu lógica de filtrado existente va aquí...
      // (Esta es una copia de la lógica del archivo original)
      const searchTerm = debouncedSearch.toLowerCase();
      const responsible = getResponsibleInfo(transaction.id);
      
      // Búsqueda en propiedades del responsable
      let matchesResponsibleData = false;
      if (responsible) {
        const responsibleName = responsible.name?.toLowerCase() || '';
        const responsibleId = responsible.identificacion?.toLowerCase() || '';
        const responsiblePhones = responsible.phones?.join(' ').toLowerCase() || '';
        const responsibleEmail = responsible.email?.toLowerCase() || '';
        const responsibleEmpresa = responsible.empresa?.toLowerCase() || '';
        
        matchesResponsibleData = 
          responsibleName.includes(searchTerm) || 
          responsibleId.includes(searchTerm) || 
          responsiblePhones.includes(searchTerm) ||
          responsibleEmail.includes(searchTerm) ||
          responsibleEmpresa.includes(searchTerm);
      }
      
      // Búsqueda en propiedades de la transacción
      const matchesSearch = 
        transaction.descripcion?.toLowerCase().includes(searchTerm) ||
        transaction.valor?.toString().includes(searchTerm) ||
        transaction.detallesAdicionales?.toLowerCase().includes(searchTerm) ||
        transaction.docContable?.toLowerCase().includes(searchTerm) ||
        matchesResponsibleData;
      const hasAssignment = !!getResponsibleInfo(transaction.id);
      const hasDocContable = transaction.docContable && transaction.docContable.trim() !== '';
      const matchesColor = selectedColors.has('all') || Array.from(selectedColors).some(color => {
        if (color === 'blue') return hasAssignment && hasDocContable;
        if (color === 'yellow') return hasAssignment && !hasDocContable;
        if (color === 'orange') return !hasAssignment && hasDocContable;
        if (color === 'green') return !hasAssignment && !hasDocContable && transaction.observaciones?.trim();
        if (color === 'none') return !hasAssignment && !hasDocContable && !transaction.observaciones?.trim();
        return false;
      });
      const matchesType = filterType === 'all' || (filterType === 'income' && transaction.valor > 0) || (filterType === 'expense' && transaction.valor < 0);
      const matchesResponsible = filterResponsible === 'all' || (filterResponsible === 'assigned' && hasAssignment) || (filterResponsible === 'unassigned' && !hasAssignment);
      const matchesDetails = filterDetails === 'all' || (filterDetails === 'withObservaciones' && transaction.observaciones?.trim());
      const matchesDocContableFilter = filterDocContable === 'all' || (filterDocContable === 'withDoc' && hasDocContable) || (filterDocContable === 'withoutDoc' && !hasDocContable);
      const matchesZeroValue = !hideZeroValues || transaction.valor !== 0;
      const matchesGrav = !hideGravDesc || !(transaction.descripcion?.toUpperCase().includes('GRAV') || transaction.descripcion?.toUpperCase().includes('COMISION'));
      const [, month, year] = transaction.fechaStr.split('/');
      const matchesDate = (selectedMonth === '' || month === selectedMonth) && (selectedYear === 'all' || year === selectedYear);
      const matchesAccount = selectedAccount === '' || transaction.accountName === selectedAccount;

      return matchesSearch && matchesColor && matchesType && matchesResponsible && matchesDetails && matchesDocContableFilter && matchesZeroValue && matchesGrav && matchesDate && matchesAccount;
    });
  }, [transactions, debouncedSearch, filterType, filterResponsible, filterDetails, filterDocContable, selectedColors, hideZeroValues, hideGravDesc, selectedMonth, selectedYear, selectedAccount, getResponsibleInfo]);
  
  const totalBalance = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.valor, 0), [filteredTransactions]);

  // --- PAGINACIÓN ---
  const {
    currentPage, totalPages, pageItems: paginatedTransactions, setCurrentPage, setItemsPerPage, itemsPerPage,
    hasNextPage, hasPreviousPage, goToNextPage, goToPreviousPage, goToFirstPage, goToLastPage, pageNumbers
  } = usePagination(filteredTransactions, { itemsPerPage: 10, maxPages: 5 });

  // --- MANEJADORES DE EVENTOS (HANDLERS) ---
  const handleAssign = useCallback(async (transactionId: string, responsibleId: string) => {
    try {
      await assignResponsible(transactionId, responsibleId, { assignedBy: user?.email || 'manual' });
      toast.success('Responsable asignado.');
    } catch (error) {
      toast.error('Error al asignar.');
    }
  }, [assignResponsible, user]);

  const handleRemoveAssignment = useCallback(async (transactionId: string) => {
    const assignment = assignments?.find(a => a.transactionId === transactionId);
    if (assignment?.id) {
      await deleteAssignment(assignment.id);
      toast.success('Asignación eliminada.');
    }
  }, [assignments, deleteAssignment]);
  
  const handleUpdateObservaciones = useCallback(async (transactionId: string, observaciones: string) => {
    const transaction = transactions?.find(t => t.id === transactionId);
    if (transaction) {
      await updateTransaction(transactionId, { ...transaction, observaciones });
      toast.success('Observaciones actualizadas.');
    }
  }, [transactions, updateTransaction]);

  const handleUpdateDocContable = useCallback(async (transactionId: string, docContable: string): Promise<void> => {
    if (!user) {
      toast.error('Debe iniciar sesión.');
      return;
    }
    try {
      await updateDoc(doc(db, 'transactions', transactionId), {
        docContable,
        lastModifiedBy: user.email,
        lastModifiedAt: new Date()
      });
      await addDoc(collection(db, 'activityLog'), {
        usuarioEmail: user.email,
        accion: 'modificación',
        entidad: 'transacción',
        documentoId: transactionId,
        detalles: `Doc. Contable: ${docContable || 'eliminado'}`,
        timestamp: new Date(),
      });
      toast.success('Documento contable actualizado.');
    } catch (error) {
      toast.error('Error al actualizar doc. contable.');
    }
  }, [user]);
  
  // Se elimina el handler del modal ya que ahora usamos asignación inline directamente

  const handleResponsibleFilterClick = useCallback(() => {
    setFilterResponsible(current => current === 'all' ? 'assigned' : current === 'assigned' ? 'unassigned' : 'all');
  }, []);

  const handleColorToggle = useCallback((color: string) => {
    setSelectedColors(prev => {
      const newSet = new Set(prev);
      if (color === 'all') { newSet.clear(); newSet.add('all'); }
      else {
        newSet.delete('all');
        if (newSet.has(color)) newSet.delete(color);
        else newSet.add(color);
        if (newSet.size === 0) newSet.add('all');
      }
      return newSet;
    });
  }, []);

  const handleAutoAssign = useCallback(async () => {
    if (!transactions || !responsibles) {
      toast.error('No hay datos disponibles para asignación automática');
      return;
    }

    let assignmentCount = 0;
    let skippedCount = 0;
    let alreadyAssignedCount = 0;

    const responsibleMap = new Map<string, Responsible>();
    for (const responsible of responsibles) {
      if (responsible.identificacion) {
        const cleanId = responsible.identificacion.replace(/[^0-9]/g, '');
        if (cleanId.length >= 8) {
          responsibleMap.set(cleanId, responsible);
        }
      }
      if (responsible.phones) {
        for (const phone of responsible.phones) {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          if (cleanPhone.length >= 8) {
            responsibleMap.set(cleanPhone, responsible);
          }
        }
      }
    }

    const assignedTransactionIds = new Set(
      assignments?.map(a => a.transactionId) || []
    );

    const transactionsToProcess = transactions.filter(transaction => {
      if (assignedTransactionIds.has(transaction.id)) {
        alreadyAssignedCount++;
        return false;
      }

      const [, month, year] = transaction.fechaStr.split('/');
      
      const matchesDate = (selectedMonth === '' || month === selectedMonth) &&
                         (selectedYear === 'all' || year === selectedYear);
      
      const matchesAccount = selectedAccount === '' || 
                           transaction.accountName === selectedAccount;

      return matchesDate && matchesAccount;
    });

    const adminAmountsMap = new Map<number, Responsible[]>();
    const adminResponsibles = responsibles.filter(r => 
      (r.type === 'admin') && r.valor !== undefined && r.valor !== null
    );

    adminResponsibles.forEach(admin => {
      const amount = Math.abs(admin.valor as number);
      if (!adminAmountsMap.has(amount)) {
        adminAmountsMap.set(amount, []);
      }
      adminAmountsMap.get(amount)?.push(admin);
    });

    for (const transaction of transactionsToProcess) {
      try {
        const codigoExtraido = extractDetailsCode(transaction.detallesAdicionales ?? '');

        if (codigoExtraido && codigoExtraido !== '-') {
          const responsible = responsibleMap.get(codigoExtraido ?? '');

          if (responsible) {
            await assignResponsible(transaction.id || '', responsible.id || '', {
              assignedBy: user?.email || 'AUTO',
              matchedCode: codigoExtraido ?? '',
              matchType: 'CODE'
            });
            
            assignmentCount++;
            assignedTransactionIds.add(transaction.id);
          } else {
            if (transaction.valor < 0) {
              const absAmount = Math.abs(transaction.valor);
              const matchingAdmins = adminAmountsMap.get(absAmount) || [];

              if (matchingAdmins.length === 1) {
                const matchingAdmin = matchingAdmins[0];
                await assignResponsible(transaction.id || '', matchingAdmin.id || '', {
                  assignedBy: user?.email || 'AUTO',
                  matchType: 'AMOUNT',
                  matchedAmount: absAmount
                });

                assignmentCount++;
                assignedTransactionIds.add(transaction.id);
                continue;
              }
            }
            skippedCount++;
          }
        } else {
          if (transaction.valor < 0) {
            const absAmount = Math.abs(transaction.valor);
            const matchingAdmins = adminAmountsMap.get(absAmount) || [];

            if (matchingAdmins.length === 1) {
              const matchingAdmin = matchingAdmins[0];
              await assignResponsible(transaction.id || '', matchingAdmin.id || '', {
                assignedBy: user?.email || 'AUTO',
                matchType: 'AMOUNT',
                matchedAmount: absAmount
              });

              assignmentCount++;
              assignedTransactionIds.add(transaction.id);
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        }
      } catch (error) {
        console.error('Error processing transaction:', {
          transactionId: transaction.id,
          error
        });
        skippedCount++;
      }
    }

    if (assignmentCount > 0) {
      toast.success(`Se asignaron automáticamente ${assignmentCount} transacciones`);
    } else {
      toast(`No se encontraron coincidencias para asignación automática`);
    }

    if (alreadyAssignedCount > 0) {
      toast(`${alreadyAssignedCount} transacciones ya estaban asignadas`, {
        icon: 'ℹ️',
      });
    }
  }, [transactions, responsibles, assignments, assignResponsible, selectedMonth, selectedYear, selectedAccount, user]);
  const handleExportCSV = useCallback(() => {
    if (!selectedAccount || !selectedMonth || selectedYear === 'all' || !transactions) {
      toast.error('Selecciona una cuenta, mes y año específicos para exportar');
      return;
    }

    const filteredData = transactions.filter(transaction => {
      const [, month, year] = transaction.fechaStr.split('/');
      return (
        transaction.accountName === selectedAccount &&
        month === selectedMonth &&
        year === selectedYear &&
        !transaction.descripcion?.toLowerCase().includes('saldo inicial') &&
        !transaction.descripcion?.toLowerCase().includes('saldo final')
      );
    });

    if (filteredData.length === 0) {
      toast.error('No hay datos para exportar con los filtros seleccionados');
      return;
    }

    const headers = ['Índ.', 'Fecha', 'Descripción', 'Valor', 'Detalles Adicionales', 'Cod.Det', 'Responsable', 'Observaciones', 'Doc.Cont.'];
    
    const csvData = filteredData.map(transaction => {
      const responsible = getResponsibleInfo(transaction.id);
      return [
        transaction.rowIndex,
        transaction.fechaStr,
        transaction.descripcion,
        transaction.valor,
        transaction.detallesAdicionales || '',
        extractDetailsCode(transaction.detallesAdicionales ?? ''), 
        responsible ? responsible.name : '',
        transaction.observaciones || '',
        transaction.docContable || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => {
        const cellStr = String(cell).replace(/"/g, '""');
        return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const monthName = availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const fileName = `${selectedAccount}_${monthName}_${selectedYear}.csv`;
    
    if ((window.navigator as any).msSaveOrOpenBlob) {
      (window.navigator as any).msSaveBlob(blob, fileName);
    } else {
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast.success('Archivo CSV exportado correctamente');
  }, [selectedAccount, selectedMonth, selectedYear, transactions, availableMonths, getResponsibleInfo]);
  
  // --- CONFIGURACIÓN DE LA TABLA ---
  type ColumnConfig = {
    width: string;
    label: string;
    key: string;
    wrap?: boolean;
    align?: 'left' | 'right';
    customClass?: string;
  };
  
  const columnsConfig = useMemo<Record<string, ColumnConfig>>(() => ({
    index: { width: 'w-12', label: 'Índ.', key: 'index' },
    date: { width: 'w-24', label: 'Fecha', key: 'date' },
    description: { width: 'w-64', label: 'Descripción', key: 'description', wrap: true },
    amount: { width: 'w-32', label: 'Valor', key: 'amount', align: 'right' },
    details: { width: 'w-56', label: 'Detalles', key: 'details', wrap: true },
    detailsCode: { width: 'w-24', label: 'Cod.Det', key: 'detailsCode' },
    responsible: { width: 'w-48', label: 'Responsable', key: 'responsible' },
    observaciones: { width: 'w-48', label: 'Observaciones', key: 'observaciones', wrap: true },
    docContable: { width: 'w-48', label: 'Doc.Cont.', key: 'docContable', wrap: true }
  }), []);

  const getColumnClasses = useCallback((columnKey: string, type: 'header' | 'cell') => {
    const config = columnsConfig[columnKey as keyof typeof columnsConfig];
    if (!config) return '';
    const baseClasses = type === 'header' 
      ? 'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
      : 'px-3 py-2 text-sm text-gray-500';
    const alignClass = config.align === 'right' ? 'text-right' : 'text-left';
    return `${baseClasses} ${config.width} ${alignClass} ${config.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}`.trim();
  }, [columnsConfig]);

  if (transactionsLoading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }
  
  // --- RENDERIZADO DEL COMPONENTE ---
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
        <FirestoreMetrics {...transactionsMetrics} />
      </div>

      <TransactionFilters
        search={search}
        setSearch={setSearch}
        filterType={filterType}
        setFilterType={setFilterType}
        filterResponsible={filterResponsible}
        setFilterResponsible={setFilterResponsible}
        filterDetails={filterDetails}
        setFilterDetails={setFilterDetails}
        filterDocContable={filterDocContable}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        uniqueAccounts={uniqueAccounts}
        uniqueYears={uniqueYears}
        availableMonths={availableMonths}
        hideZeroValues={hideZeroValues}
        setHideZeroValues={setHideZeroValues}
        hideGravDesc={hideGravDesc}
        setHideGravDesc={setHideGravDesc}
        isColorDropdownOpen={isColorDropdownOpen}
        setIsColorDropdownOpen={setIsColorDropdownOpen}
        selectedColors={selectedColors}
        handleColorToggle={handleColorToggle}
        handleResponsibleFilterClick={handleResponsibleFilterClick}
        handleAutoAssign={handleAutoAssign}
        handleExportCSV={handleExportCSV}
        totalBalance={totalBalance}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Transacciones</div>
          <div className="text-2xl font-bold">{filteredTransactions?.length || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Balance Total</div>
          <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${Math.abs(totalBalance).toLocaleString()}
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Object.keys(columnsConfig).map(key => (
                  <th key={key} className={getColumnClasses(key, 'header')}>
                    {columnsConfig[key as keyof typeof columnsConfig].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  responsible={getResponsibleInfo(transaction.id)}
                  responsibles={responsibles}
                  columnsConfig={columnsConfig}
                  getColumnClasses={getColumnClasses}
                  onUpdateObservaciones={handleUpdateObservaciones}
                  onUpdateDocContable={handleUpdateDocContable}
                  onRemoveAssignment={handleRemoveAssignment}
                  onAssign={handleAssign}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageNumbers={pageNumbers}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        itemsPerPage={itemsPerPage}
        totalItems={filteredTransactions.length}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        onNextPage={goToNextPage}
        onPreviousPage={goToPreviousPage}
        onFirstPage={goToFirstPage}
        onLastPage={goToLastPage}
      />
      
      {/* Se elimina el modal ya que ahora usamos la búsqueda inline */}
    </div>
  );
}