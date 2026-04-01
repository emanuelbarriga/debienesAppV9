import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirestoreOptimized } from '../hooks/useFirestoreOptimized';
// Assuming useAssignResponsible.ts has been updated to export AssignResponsibleOptions if needed,
// but the hook itself does not take a generic type.
import { useAssignResponsible } from '../hooks/useAssignResponsible';
import { Transaction, Assignment, Responsible } from '../types'; // All types from centralized location
import { Search, ArrowUpCircle, ArrowDownCircle, BanknoteIcon, XCircle, Ban, UserCheck, UserX, FileText, Wand2, Paintbrush, Download } from 'lucide-react';
import AssignResponsibleModal from '../modules/responsibles/components/AssignResponsibleModal';
import toast from 'react-hot-toast';
import { InlineResponsibleSearch } from '../modules/responsibles/components/InlineResponsibleSearch';
import { ResponsibleTypeTag } from '../modules/responsibles/components/ResponsibleTypeTag';
import { extractDetailsCode } from '../utils/transactionProcessor';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/shared/Pagination';
import { FirestoreMetrics } from '../components/shared/FirestoreMetrics';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthState } from '../hooks/useAuthState';

// This declaration should ideally be in a global.d.ts file, e.g., src/global.d.ts
// Make sure tsconfig.json includes this file.
// For example, in tsconfig.json: "include": ["src/**/*.ts", "src/**/*.tsx", "src/global.d.ts"]
declare global {
  interface Navigator {
    msSaveOrOpenBlob?: (blob: Blob, filename: string) => boolean;
    msSaveBlob?: (blob: Blob, filename: string) => boolean;
  }
}

// --- IMPORTANT TYPE GUIDANCE ---
// You MUST ensure your type definitions match consistently across your project.
//
// 1. In your `Transaction` type (e.g., `src/types/transaction.ts` or `src/types/index.ts`):
//    Ensure properties that can be undefined are marked as optional (`?`).
/*
export interface Transaction {
  id: string;
  rowIndex: number;
  fechaStr: string;
  descripcion: string;
  valor: number;
  detallesAdicionales?: string; // Make optional
  docContable?: string;        // Make optional
  observaciones?: string;      // Make optional
  accountName: string;
  banco?: string;              // Make optional (resolves errors for InlineResponsibleSearch, AssignResponsibleModal)
  responsible?: {              // Make responsible object optional
    id: string;
    name: string;              // If responsible's name can be undefined, make it name?: string;
    type: ResponsibleType;     // If responsible's type can be undefined, make it type?: ResponsibleType;
  };
  firestoreId?: string; // Add if used for database ID
  createdAt?: firebase.firestore.Timestamp | Date; // Adjust to your timestamp type
  updatedAt?: firebase.firestore.Timestamp | Date;
  lastModifiedBy?: string;
  lastModifiedAt?: firebase.firestore.Timestamp | Date;
}
*/
// 2. In your `ResponsibleType` definition (e.g., `src/types/responsible.ts`):
//    Ensure it includes all possible values, especially if 'n/a' is used or 'admin' vs 'Administración'.
/*
export type ResponsibleType = 'tenant' | 'owner' | 'admin' | 'third-party' | 'other' | 'n/a';
*/
// 3. In your `ResponsibleTypeTag` component's props (`src/components/ResponsibleTypeTag.tsx`):
//    Ensure its `type` prop matches the `ResponsibleType` from `src/types/responsible.ts`.
/*
import { ResponsibleType } from '../types/responsible'; // Import ResponsibleType
interface ResponsibleTypeTagProps {
  type: ResponsibleType; // Use the imported ResponsibleType
  responsible?: Responsible; // Use the Responsible type
  showName?: boolean;
  onRemove?: () => void;
}
*/
// 4. In your `InlineResponsibleSearch` and `AssignResponsibleModal` component's props:
//    Ensure their `transaction` prop uses the same `Transaction` interface that allows `banco?: string`.
/*
// In InlineResponsibleSearch.tsx
import { Transaction } from '../types'; // Or from where your canonical Transaction type is
interface InlineResponsibleSearchProps {
  transaction: Transaction; // This Transaction should have banco?: string;
  // ... other props
}

// In AssignResponsibleModal.tsx
import { Transaction } from '../types'; // Or from where your canonical Transaction type is
interface AssignResponsibleModalProps {
  transaction: Transaction; // This Transaction should have banco?: string;
  // ... other props
}
*/

function Transactions() {
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

  const { user } = useAuthState();

  // Memoizar las referencias a los datos para evitar re-renders innecesarios
  const memoizedTransactions = useMemo(() => transactions, [transactions]);

  const { 
    data: responsibles
  } = useFirestoreOptimized<Responsible>('responsibles', {
    expireTime: 5,
    localStorageKey: 'responsiblesCache'
  });

  const { 
    data: assignments,
    deleteItem: deleteAssignment
  } = useFirestoreOptimized<Assignment>('assignments', {
    expireTime: 5,
    localStorageKey: 'assignmentsCache'
  });

  // Error 2558: Expected 0 type arguments, but got 1.
  // SOLUTION: Removed generic type. The hook itself is not generic; the function it returns is.
  const { assignResponsible } = useAssignResponsible(); 

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterResponsible, setFilterResponsible] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [filterDetails, setFilterDetails] = useState<'all' | 'withObservaciones'>('all');
  // `setFilterDocContable` was unused. `filterDocContable` is used but not its setter.
  // Removed `filterColor` and `setFilterColor` as `selectedColors` handles the logic.
  const [filterDocContable] = useState<'all' | 'withDoc' | 'withoutDoc'>('all');
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set(['all']));
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [hideZeroValues, setHideZeroValues] = useState(true);
  const [hideGravDesc, setHideGravDesc] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    if (memoizedTransactions && memoizedTransactions.length > 0 && !selectedAccount) {
      const firstAccount = memoizedTransactions[0].accountName;
      setSelectedAccount(firstAccount);
    }
  }, [memoizedTransactions, selectedAccount]);

  useEffect(() => {
    if (!selectedMonth) {
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      setSelectedMonth(currentMonth);
    }
  }, [selectedMonth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isColorDropdownOpen && !(event.target as Element).closest('.relative')) {
        setIsColorDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColorDropdownOpen]);

  const uniqueAccounts = useMemo(() => {
    return [...new Set(memoizedTransactions?.map(t => t.accountName) || [])].sort();
  }, [memoizedTransactions]);
  
  const uniqueYears = useMemo(() => {
    return [...new Set(memoizedTransactions?.map(t => {
      const [, , year] = t.fechaStr.split('/');
      return year;
    }).filter(Boolean))].sort((a, b) => (a || '').localeCompare(b || ''));
  }, [memoizedTransactions]);

  const availableMonths = useMemo(() => {
    return memoizedTransactions
      ? Array.from(new Set(
          memoizedTransactions
            .filter(t => {
              const [, , year] = t.fechaStr.split('/');
              return selectedYear === 'all' || year === selectedYear;
            })
            .map(t => {
              const [, month] = t.fechaStr.split('/');
              return month;
            })
        )).sort()
        .map(month => ({
          value: month,
          label: new Date(2000, parseInt(month) - 1).toLocaleString('es', { month: 'long' })
        }))
      : [];
  }, [memoizedTransactions, selectedYear]);

  // Initializing `assignmentsSnapshot` is fine, but it's not actually used in the `filteredTransactions` `useMemo`.
  // If its purpose was to filter based on a fixed set of assignments, that logic isn't connected.
  // Kept for now, but consider if it's still needed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [assignmentsSnapshot, setAssignmentsSnapshot] = useState<Assignment[]>([]);
  useEffect(() => {
    if (assignments && filterResponsible !== 'all' && assignmentsSnapshot.length === 0) {
      setAssignmentsSnapshot(assignments);
    }
  }, [assignments, filterResponsible, assignmentsSnapshot.length]); // Dependencies for correctness
  useEffect(() => {
    if (filterResponsible === 'all') {
      setAssignmentsSnapshot([]);
    }
  }, [filterResponsible]);

  const handleResponsibleFilterClick = () => {
    if (!assignments) {
      toast.error('No se pueden cargar las asignaciones');
      return;
    }

    setFilterResponsible(current => {
      if (current === 'all') return 'assigned';
      if (current === 'assigned') return 'unassigned';
      return 'all';
    });
  };

  // Error 2322 (Line 206) - Fix by ensuring `getResponsibleInfo` does NOT mutate `transaction.responsible`
  // and that `responsible.name` and `responsible.type` are safely accessed with fallbacks.
  const getResponsibleInfo = useCallback((transactionId: string): Responsible | undefined => {
    if (!transactionId || !responsibles || !assignments) return undefined;
    
    const assignment = assignments.find(a => a.transactionId === transactionId);
    if (!assignment) return undefined;

    const responsible = responsibles.find(r => r.id === assignment.responsibleId);
    if (!responsible) return undefined;

    // IMPORTANT: Removed direct mutation of `transaction.responsible`.
    // This function now only returns the responsible info, which will be used in the render loop.
    return responsible;
  }, [assignments, responsibles]); // Dependencies for useCallback

  // Filtrado de transacciones
  const filteredTransactions = useMemo(() => {
    if (!memoizedTransactions) return [];

    return memoizedTransactions.filter((transaction) => {
      const searchTerm = search.toLowerCase();
      
      // Access responsible name using getResponsibleInfo, as transaction.responsible might not be populated directly
      const responsibleName = getResponsibleInfo(transaction.id)?.name?.toLowerCase() || ''; // Safely access name
      
      const matchesSearch = 
        transaction.descripcion?.toLowerCase().includes(searchTerm) ||
        transaction.valor?.toString().includes(searchTerm) ||
        transaction.detallesAdicionales?.toLowerCase().includes(searchTerm) ||
        transaction.docContable?.toLowerCase().includes(searchTerm) ||
        responsibleName.includes(searchTerm);

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

      const matchesType = filterType === 'all' || 
        (filterType === 'income' && transaction.valor > 0) ||
        (filterType === 'expense' && transaction.valor < 0);

      const matchesResponsible = filterResponsible === 'all' || 
        (filterResponsible === 'assigned' && hasAssignment) ||
        (filterResponsible === 'unassigned' && !hasAssignment);

      const matchesDetails = filterDetails === 'all' || 
        (filterDetails === 'withObservaciones' && transaction.observaciones?.trim());

      const matchesDocContable = filterDocContable === 'all' ||
        (filterDocContable === 'withDoc' && transaction.docContable?.trim()) ||
        (filterDocContable === 'withoutDoc' && !transaction.docContable?.trim());

      const matchesZeroValue = !hideZeroValues || transaction.valor !== 0;
      const matchesGrav = !hideGravDesc || !(
        transaction.descripcion?.toUpperCase().includes('GRAV') ||
        transaction.descripcion?.toUpperCase().includes('IVA SOBRE COMISIONES') ||
        transaction.descripcion?.toUpperCase().includes('COMISION TRANSFERENCIAS')   ||
        transaction.descripcion?.toUpperCase().includes('COMISION RECAUDOS') ||
        transaction.descripcion?.toUpperCase().includes('COMIS. CONVENIO DE PAGO') ||
        transaction.descripcion?.toUpperCase().includes('COMISION')
      );

      const [, month, year] = transaction.fechaStr.split('/');
      
      const matchesDate = (selectedMonth === '' || month === selectedMonth) &&
                         (selectedYear === 'all' || year === selectedYear);
      
      const matchesAccount = selectedAccount === '' || 
                           transaction.accountName === selectedAccount;

      return matchesSearch && 
             matchesType && 
             matchesResponsible && 
             matchesDetails && 
             matchesDocContable &&
             matchesZeroValue && 
             matchesGrav && 
             matchesDate && 
             matchesAccount && 
             matchesColor;
    });
  }, [
    memoizedTransactions,
    search,
    filterType,
    filterResponsible,
    filterDetails,
    filterDocContable,
    selectedColors,
    hideZeroValues,
    hideGravDesc,
    selectedMonth,
    selectedYear,
    selectedAccount,
    getResponsibleInfo // Now correctly used as a dependency
  ]);

  const handleColorToggle = (color: string) => {
    setSelectedColors(prev => {
      const newSet = new Set(prev);
      if (color === 'all') {
        if (newSet.has('all')) {
          newSet.clear();
        } else {
          newSet.clear();
          newSet.add('all');
        }
      } else {
        if (newSet.has('all')) {
          newSet.delete('all');
        }
        if (newSet.has(color)) {
          newSet.delete(color);
          if (newSet.size === 0) {
            newSet.add('all');
          }
        } else {
          newSet.add(color);
        }
      }
      return newSet;
    });
  };

  const {
    currentPage,
    totalPages,
    pageItems: paginatedTransactions,
    setCurrentPage,
    setItemsPerPage,
    itemsPerPage,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    pageNumbers
  } = usePagination(filteredTransactions, {
    itemsPerPage: 10,
    maxPages: 5
  });

  const getTransactionRealId = useCallback((transaction: Transaction) => {
    if (transaction.firestoreId) {
      return transaction.firestoreId;
    }
    return transaction.id;
  }, []);

  const handleAssign = async (transactionId: string, responsibleId: string) => {
    try {
      await assignResponsible(transactionId, responsibleId, {
        assignedBy: user?.email || 'manual',
        assignedAt: new Date().toISOString(),
      });
      toast.success('Responsable asignado correctamente');
    } catch (error) {
      console.error('Error al asignar responsable:', error);
      toast.error('Error al asignar responsable');
    }
  };

  const handleRemoveAssignment = async (transactionId: string) => {
    try {
      const existingAssignment = assignments?.find(a => a.transactionId === transactionId);
      
      if (existingAssignment?.id) {
        const success = await deleteAssignment(existingAssignment.id);
        if (success) {
          toast.success('Responsable eliminado correctamente');
        } else {
          toast.error('Error al eliminar el responsable');
        }
      }
    } catch (error) {
      console.error('Error al eliminar la asignación:', error);
      toast.error('Error al eliminar el responsable');
    }
  };

  const [editingObservacion, setEditingObservacion] = useState<string | null>(null);
  const [tempObservacion, setTempObservacion] = useState<string>('');

  const handleUpdateObservaciones = async (transactionId: string, observaciones: string) => {
    try {
      const transaction = transactions?.find(t => t.id === transactionId);
      if (!transaction) {
        console.error('Transaction not found:', transactionId);
        return;
      }

      await updateTransaction(transactionId, {
        ...transaction,
        observaciones
      });
      setEditingObservacion(null);
      toast.success('Observaciones actualizadas correctamente');
    } catch (error) {
      console.error('Error al actualizar observaciones:', error);
      toast.error('Error al actualizar observaciones');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, transactionId: string) => {
    if (e.key === 'Enter') {
      handleUpdateObservaciones(transactionId, tempObservacion);
    } else if (e.key === 'Escape') {
      setEditingObservacion(null);
    }
  };

  const [editingDocContable, setEditingDocContable] = useState<string | null>(null);
  const [tempDocContable, setTempDocContable] = useState('');

  const handleUpdateDocContable = async (transactionId: string, docContable: string) => {
    if (!user) {
      console.error('No hay usuario autenticado');
      toast.error('Debe iniciar sesión para actualizar documentos');
      return;
    }

    try {
      // Update the transaction in Firestore
      const transactionRef = doc(db, 'transactions', transactionId);
      await updateDoc(transactionRef, {
        docContable: docContable || '',  // Allow empty values
        lastModifiedBy: user.email,
        lastModifiedAt: new Date()
      });

      // If the update was successful, create an activity log entry
      try {
        const activityLogRef = collection(db, 'activityLog');
        await addDoc(activityLogRef, {
          usuarioEmail: user.email,
          accion: 'modificación',
          entidad: 'transacción',
          documentoId: transactionId,
          detalles: docContable 
            ? `Actualización de documento contable: ${docContable}`
            : 'Eliminación de documento contable',
          timestamp: new Date(),
        });
      } catch (logError) {
        console.error('Error al crear registro de actividad:', logError);
      }

      setEditingDocContable(null);
      setTempDocContable('');
      toast.success('Documento contable actualizado correctamente');
      
    } catch (error) {
      console.error('Error detailed when updating docContable:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : null,
        transactionId,
        docContable,
        userEmail: user.email
      });

      if (error instanceof Error && error.message.includes('permission')) {
        toast.error('No tiene permisos suficientes para realizar esta acción');
      } else {
        toast.error('Error al actualizar documento contable. Por favor, intente nuevamente');
      }
    }
  };

  const handleDocContableKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, transactionId: string) => {
    if (e.key === 'Enter') {
      handleUpdateDocContable(transactionId, tempDocContable);
    } else if (e.key === 'Escape') {
      setEditingDocContable(null);
    }
  };

  const getTotalBalance = () => {
    if (!filteredTransactions) return 0;
    return filteredTransactions.reduce((sum, t) => sum + t.valor, 0);
  };

  interface ColumnConfig {
    width: string;
    label: string;
    key: string;
    wrap?: boolean;
    align?: 'left' | 'right';
    customClass?: string;
  }

  const columnsConfig: Record<string, ColumnConfig> = useMemo(() => ({
    index: { 
      width: 'w-5', label: 'Índ.', key: 'index' 
    },
    date: { 
      width: 'w-12', label: 'Fecha', key: 'date' 
    },
    description: { 
      width: 'w-24', label: 'Descripción', key: 'description',
      wrap: true, customClass: 'whitespace-normal'
    },
    amount: { 
      width: 'w-12', label: 'Valor', key: 'amount',
      align: 'right' 
    },
    details: { 
      width: 'w-56', label: 'Detalles Adicionales', key: 'details',
      wrap: true, customClass: 'break-all whitespace-pre-wrap max-h-12 overflow-y-auto'
    },
    detailsCode: { 
      width: 'w-12', label: 'Cod.Det', key: 'detailsCode' 
    },
    responsible: { 
      width: 'w-32', label: 'Responsable', key: 'responsible',
      customClass: 'truncate'
    },
    observaciones: { 
      width: 'w-24', label: 'Observaciones', key: 'observaciones',
      wrap: true, customClass: 'whitespace-pre-wrap max-h-12 overflow-y-auto'
    },
    docContable: { 
      width: 'w-24', label: 'Doc.Cont.', key: 'docContable',
      wrap: true, customClass: 'whitespace-pre-wrap max-h-12 overflow-y-auto'
    }
  }), []); // Memoize column config

  const getColumnClasses = (columnKey: keyof typeof columnsConfig, type: 'header' | 'cell') => {
    const config = columnsConfig[columnKey];
    const baseClasses = type === 'header' 
      ? 'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
      : 'px-3 py-2 text-sm text-gray-500';

    const wrapClass = config.wrap ? 'whitespace-normal' : 'whitespace-nowrap';
    const alignClass = config.align === 'right' ? 'text-right' : 'text-left';
    const customClass = config.customClass || '';

    return `${baseClasses} ${config.width} ${wrapClass} ${alignClass} ${customClass}`.trim();
  };

  const handleAutoAssign = async () => {
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
              assignedBy: 'AUTO',
              assignedAt: new Date().toISOString(),
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
                  assignedBy: 'AUTO',
                  assignedAt: new Date().toISOString(),
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
                assignedBy: 'AUTO',
                assignedAt: new Date().toISOString(),
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
  };

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
        // Error 2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
        // SOLUTION: Use nullish coalescing operator `?? ''` to ensure `extractDetailsCode` receives a string.
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
    
    // Errors 2339 (msSaveOrOpenBlob, msSaveBlob):
    // SOLUTION: Added type assertion to `any` as a workaround. Best to fix global.d.ts.
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

  const getRowStyle = (transaction: Transaction) => {
    const hasDocContable = transaction.docContable && transaction.docContable.trim() !== '';
    const hasResponsible = !!getResponsibleInfo(transaction.id);
    
    if (hasResponsible && hasDocContable) {
      return {
        background: 'bg-blue-50 hover:bg-blue-100',
        border: 'border-l-4 border-l-blue-500',
        transition: 'transition-colors duration-200'
      };
    }
    if (hasResponsible && !hasDocContable) {
      return {
        background: 'bg-yellow-50 hover:bg-yellow-100',
        border: 'border-l-4 border-l-yellow-500',
        transition: 'transition-colors duration-200'
      };
    }
    if (!hasResponsible && hasDocContable) {
      return {
        background: 'bg-orange-50 hover:bg-orange-100',
        border: 'border-l-4 border-l-orange-500',
        transition: 'transition-colors duration-200'
      };
    }
    if (!hasResponsible && !hasDocContable && transaction.observaciones?.trim()) {
      return {
        background: 'bg-green-50 hover:bg-green-100',
        border: 'border-l-4 border-l-green-500',
        transition: 'transition-colors duration-200'
      };
    }
    return {
      background: 'hover:bg-gray-50',
      border: '',
      transition: 'transition-colors duration-200'
    };
  };

  if (transactionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
          <FirestoreMetrics {...transactionsMetrics} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">

          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar transacciones..."
                className="w-full sm:w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-2 ${
                    filterType === 'all'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Todas las transacciones"
                >
                  <BanknoteIcon size={18} />
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={`px-3 py-2 ${
                    filterType === 'income'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Ingresos"
                >
                  <ArrowUpCircle size={18} />
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`px-3 py-2 ${
                    filterType === 'expense'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Egresos"
                >
                  <ArrowDownCircle size={18} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                  style={{
                    backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16a2 2 0 0 1 2 2v6a10 10 0 0 1-10 10A10 10 0 0 1 2 11V5a2 2 0 0 1 2-2z"></path><polyline points="8 10 12 14 16 10"></polyline></svg>')`
                  }}
                >
                  {uniqueAccounts.map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                  style={{
                    backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>')`
                  }}
                >
                  <option value="">Todos los meses</option>
                  {availableMonths.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label.charAt(0).toUpperCase() + month.label.slice(1)}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                  style={{
                    backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>')`
                  }}
                >
                  <option value="all">Todos los años</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                <button
                  onClick={() => setHideZeroValues(!hideZeroValues)}
                  className={`p-2 rounded-lg ${
                    hideZeroValues
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={hideZeroValues ? 'Mostrar valores 0' : 'Ocultar valores 0'}
                >
                  <XCircle size={18} />
                </button>

                <button
                  onClick={() => setHideGravDesc(!hideGravDesc)}
                  className={`p-2 rounded-lg ${
                    hideGravDesc
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={hideGravDesc ? 'Mostrar GRAV' : 'Ocultar GRAV'}
                >
                  <Ban size={18} />
                </button>

                <button
                  onClick={handleResponsibleFilterClick}
                  className={`p-2 rounded-lg ${
                    filterResponsible === 'assigned'
                      ? 'bg-green-100 text-green-700'
                      : filterResponsible === 'unassigned'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={
                    filterResponsible === 'all'
                      ? 'Todos los responsables'
                      : filterResponsible === 'assigned'
                      ? 'Solo asignados'
                      : 'Solo sin asignar'
                  }
                >
                  {filterResponsible === 'unassigned' ? <UserX size={18} /> : <UserCheck size={18} />}
                </button>

                <button
                  onClick={() => setFilterDetails(filterDetails === 'all' ? 'withObservaciones' : 'all')}
                  className={`p-2 rounded-lg ${
                    filterDetails === 'withObservaciones'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={filterDetails === 'all' ? 'Todos los detalles' : 'Solo con observaciones'}
                >
                  <FileText size={18} />
                </button>
                <button
                  onClick={handleAutoAssign}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                  title="Asignar automáticamente usando códigos de detalle"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  title="Exportar a CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors duration-200 ${
                      selectedColors.has('all')
                        ? 'bg-gray-100 hover:bg-gray-200'
                        : 'bg-white hover:bg-gray-100 border border-gray-200'
                    }`}
                    title="Filtrar por estado"
                  >
                    <div className="flex items-center gap-1.5">
                      <Paintbrush size={18} className="text-gray-600" />
                      {!selectedColors.has('all') && (
                        <div className="flex -space-x-1">
                          {selectedColors.has('blue') && (
                            <div className="w-3 h-3 rounded-full bg-blue-400 border border-white" />
                          )}
                          {selectedColors.has('yellow') && (
                            <div className="w-3 h-3 rounded-full bg-yellow-400 border border-white" />
                          )}
                          {selectedColors.has('orange') && (
                            <div className="w-3 h-3 rounded-full bg-orange-400 border border-white" />
                          )}
                          {selectedColors.has('green') && (
                            <div className="w-3 h-3 rounded-full bg-green-400 border border-white" />
                          )}
                          {selectedColors.has('none') && (
                            <div className="w-3 h-3 rounded-full bg-gray-400 border border-white" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  {isColorDropdownOpen && (
                    <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-2">
                        <div className="flex items-center gap-2">
                          <label 
                            className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer" 
                            title="Todos los estados"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColors.has('all')}
                              onChange={() => handleColorToggle('all')}
                              className="appearance-none h-5 w-5 rounded border-2 border-gray-300 bg-white checked:border-gray-600 checked:bg-gray-600 hover:bg-gray-100 cursor-pointer"
                            />
                          </label>
                          <label 
                            className="flex items-center p-2 hover:bg-blue-50 rounded cursor-pointer" 
                            title="Con responsable y documento"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColors.has('blue')}
                              onChange={() => handleColorToggle('blue')}
                              className="appearance-none h-5 w-5 rounded border-2 border-blue-300 bg-white checked:border-blue-300 checked:bg-blue-300 hover:bg-blue-100 cursor-pointer"
                            />
                          </label>
                          <label 
                            className="flex items-center p-2 hover:bg-yellow-50 rounded cursor-pointer"
                            title="Solo con responsable"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColors.has('yellow')}
                              onChange={() => handleColorToggle('yellow')}
                              className="appearance-none h-5 w-5 rounded border-2 border-yellow-300 bg-white checked:border-yellow-300 checked:bg-yellow-300 hover:bg-yellow-100 cursor-pointer"
                            />
                          </label>
                          <label 
                            className="flex items-center p-2 hover:bg-orange-50 rounded cursor-pointer"
                            title="Solo con documento"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColors.has('orange')}
                              onChange={() => handleColorToggle('orange')}
                              className="appearance-none h-5 w-5 rounded border-2 border-orange-200 bg-white checked:border-orange-200 checked:bg-orange-200 hover:bg-orange-100 cursor-pointer"
                            />
                          </label>
                          <label 
                            className="flex items-center p-2 hover:bg-green-50 rounded cursor-pointer"
                            title="Sin asignación ni documento, con observaciones"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColors.has('green')}
                              onChange={() => handleColorToggle('green')}
                              className="appearance-none h-5 w-5 rounded border-2 border-green-300 bg-white checked:border-green-300 checked:bg-green-300 hover:bg-green-100 cursor-pointer"
                            />
                          </label>
                          <label 
                            className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                            title="Sin responsable ni documento"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColors.has('none')}
                              onChange={() => handleColorToggle('none')}
                              className="appearance-none h-5 w-5 rounded border-2 border-gray-300 bg-white checked:border-gray-300 checked:bg-gray-300 hover:bg-gray-100 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Transacciones</div>
          <div className="text-2xl font-bold">{filteredTransactions?.length || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Balance Total</div>
          <div className={`text-2xl font-bold ${getTotalBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${Math.abs(getTotalBalance()).toLocaleString()}
          </div>
        </div>
      </div>
      <br></br>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Object.entries(columnsConfig).map(([key, config]) => (
                  <th key={key} className={getColumnClasses(key as keyof typeof columnsConfig, 'header')}>
                    {config.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTransactions.map((transaction) => {
                const rowStyle = getRowStyle(transaction);
                const responsibleInfo = getResponsibleInfo(transaction.id); // Get responsible info once per row

                return (
                  <tr 
                    key={transaction.id} 
                    className={`group ${rowStyle.background} ${rowStyle.border} ${rowStyle.transition}`}
                    title={
                      transaction.observaciones 
                        ? "Esta transacción tiene observaciones registradas"
                        : transaction.docContable 
                          ? "Esta transacción tiene un documento contable"
                          : responsibleInfo
                            ? "Esta transacción tiene un responsable asignado"
                            : "Doble clic en Observaciones o Doc. Contable para agregar información"
                    }
                  >
                    <td className={getColumnClasses('index', 'cell')}>
                      {transaction.rowIndex}
                    </td>
                    <td className={getColumnClasses('date', 'cell')}>
                      {transaction.fechaStr}
                    </td>
                    <td className={getColumnClasses('description', 'cell')}>
                      {transaction.descripcion}
                    </td>
                    <td className={getColumnClasses('amount', 'cell')}>
                      <span className={transaction.valor >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${Math.abs(transaction.valor).toLocaleString()}
                      </span>
                    </td>
                    <td className={getColumnClasses('details', 'cell')}>
                      <div className="break-all whitespace-pre-wrap">
                        {transaction.detallesAdicionales || '-'}
                      </div>
                    </td>
                    <td className={getColumnClasses('detailsCode', 'cell')}>
                      {extractDetailsCode(transaction.detallesAdicionales ?? '')}
                    </td>
                    <td className={getColumnClasses('responsible', 'cell')}>
                      <div className="flex items-center gap-2">
                        {responsibleInfo ? (
                          <ResponsibleTypeTag
                            // Error 2322: Type 'ResponsibleType' is not assignable to type '...'. Type '"n/a"' is not assignable.
                            // SOLUTION: This requires updating ResponsibleTypeTagProps type definition.
                            type={responsibleInfo.type ?? 'other'} // Using nullish coalescing to ensure type is always defined
                            responsible={responsibleInfo}
                            showName
                            onRemove={() => handleRemoveAssignment(transaction.id)}
                          />
                        ) : (
                          <InlineResponsibleSearch
                            key={transaction.id}
                            // Error 2322 (InlineResponsibleSearch):
                            // SOLUTION: Ensure InlineResponsibleSearchProps's `transaction` prop uses `Transaction` where `banco` is optional (`banco?: string;`).
                            transaction={transaction} // Using the updated Transaction interface where banco is optional
                            transactionId={getTransactionRealId(transaction)}
                            responsibles={responsibles?.map(r => ({
                              ...r,
                              createdAt: r.createdAt || new Date(), // Provide default for optional fields
                              updatedAt: r.updatedAt || new Date()
                            } as Responsible)) || []}
                            onAssign={(responsibleId) => {
                              const realId = getTransactionRealId(transaction);
                              handleAssign(realId, responsibleId);
                            }}
                          />
                        )}
                      </div>
                    </td>
                    <td className={getColumnClasses('observaciones', 'cell')}>
                      {editingObservacion === transaction.id ? (
                        <div className="flex items-center space-x-0.5">
                          <input
                            type="text"
                            className="w-full min-w-0 text-sm px-1.5 py-0.5 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            placeholder="Agregar observación"
                            value={tempObservacion}
                            onChange={(e) => setTempObservacion(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, transaction.id)}
                            autoFocus
                          />
                          <div className="flex -ml-px">
                            <button
                              onClick={() => handleUpdateObservaciones(transaction.id, tempObservacion)}
                              className="px-1 py-0.5 text-green-600 hover:text-green-800 border border-l-0 border-gray-300 bg-white hover:bg-green-50"
                              title="Guardar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingObservacion(null)}
                              className="px-1 py-0.5 text-red-600 hover:text-red-800 border border-l-0 border-gray-300 bg-white hover:bg-red-50 rounded-r-md"
                              title="Cancelar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-1.5 py-0.5 rounded hover:bg-white/50 cursor-pointer min-h-[26px] flex items-center text-sm`}
                          onDoubleClick={() => {
                            setEditingObservacion(transaction.id);
                            setTempObservacion(transaction.observaciones || '');
                          }}
                          title="Doble clic para editar"
                        >
                          {transaction.observaciones || '-'}
                        </div>
                      )}
                    </td>
                    <td className={getColumnClasses('docContable', 'cell')}>
                      {editingDocContable === transaction.id ? (
                        <div className="flex items-center space-x-0.5">
                          <input
                            type="text"
                            className="w-full min-w-0 text-sm px-1.5 py-0.5 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            placeholder="Agregar documento contable"
                            value={tempDocContable}
                            onChange={(e) => setTempDocContable(e.target.value)}
                            onKeyDown={(e) => handleDocContableKeyDown(e, transaction.id)}
                            autoFocus
                          />
                          <div className="flex -ml-px">
                            <button
                              onClick={() => handleUpdateDocContable(transaction.id, tempDocContable)}
                              className="px-1 py-0.5 text-green-600 hover:text-green-800 border border-l-0 border-gray-300 bg-white hover:bg-green-50"
                              title="Guardar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingDocContable(null)}
                              className="px-1 py-0.5 text-red-600 hover:text-red-800 border border-l-0 border-gray-300 bg-white hover:bg-red-50 rounded-r-md"
                              title="Cancelar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-1.5 py-0.5 rounded hover:bg-white/50 cursor-pointer min-h-[26px] flex items-center text-sm`}
                          onDoubleClick={() => {
                            setEditingDocContable(transaction.id);
                            setTempDocContable(transaction.docContable || '');
                          }}
                          title="Doble clic para editar"
                        >
                          {transaction.docContable || '-'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          onPageChange={setCurrentPage}
          onFirstPage={goToFirstPage}
          onLastPage={goToLastPage}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredTransactions.length}
        />
      </div>

      {selectedTransaction && (
        <AssignResponsibleModal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          // Error 2322 (AssignResponsibleModal):
          // SOLUTION: Ensure AssignResponsibleModalProps's `transaction` prop uses `Transaction` where `banco` is optional (`banco?: string;`).
          transaction={selectedTransaction} 
          responsibles={responsibles || []}
          onAssign={(responsibleId: string) => {
            if (selectedTransaction) {
              handleAssign(selectedTransaction.id, responsibleId);
              setSelectedTransaction(null);
            }
          }}
        />
      )}
    </div>
  );
}

export default Transactions;