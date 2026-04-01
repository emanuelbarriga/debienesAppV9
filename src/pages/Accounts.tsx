import React, { useState } from 'react';
import { useCollection } from '../hooks/useCollection';
import { Account, ImportLog, ImportError, Transaction, DuplicateTransaction } from '../types';
import { Timestamp } from 'firebase/firestore';
import { AlertTriangle, Building2, Edit2, FileX, PlusCircle, Search, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, collection, addDoc, writeBatch, where, query, getDocs, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { processTransaction, extractDetailsCode } from '../utils/transactionProcessor';
import { CleanDuplicatesModal } from '../modules/responsibles/components/CleanDuplicatesModal';
import { DuplicateTransactionsModal } from '../modules/finance/components/DuplicateTransactionsModal';
import DeleteTransactionsModal from '../modules/finance/components/DeleteTransactionsModal';
import TransactionDiagnosticModal from '../modules/finance/components/TransactionDiagnosticModal';

function Accounts() {
  const { data: accounts } = useCollection<Account>('accounts');
  const { data: importLogs } = useCollection<ImportLog>('importLogs', {
    orderBy: [{ field: 'timestamp', direction: 'desc' }]
  });
  
  // Estado para controlar la visualización de registros antiguos
  const [showOlderLogs, setShowOlderLogs] = useState<{[accountId: string]: boolean}>({});
  
  // Estado para controlar la expansión/colapso de los acordeones de meses
  const [expandedMonths, setExpandedMonths] = useState<{[key: string]: boolean}>({});
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [processingImportAccount, setProcessingImportAccount] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [formData, setFormData] = useState({
    nombre: '',
    numeroCuenta: '',
    banco: '',
    tipo: 'corriente' as 'corriente' | 'ahorros',
  });

  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateTransactions, setDuplicateTransactions] = useState<DuplicateTransaction[]>([]);
  const [showCleanDuplicatesModal, setShowCleanDuplicatesModal] = useState(false);
  const [duplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedAccount] = useState<Account | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [diagnosticAccountId, setDiagnosticAccountId] = useState<string | null>(null);

  interface DuplicateGroup {
    key: string;
    transactions: Transaction[];
    selectedId: string | null;
    isExpanded: boolean;
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      numeroCuenta: '',
      banco: '',
      tipo: 'corriente' as const,
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      nombre: account.nombre,
      numeroCuenta: account.numeroCuenta,
      banco: account.banco,
      tipo: account.tipo,
    });
    setShowModal(true);
  };

  const handleDelete = async (account: Account) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta cuenta?')) {
      try {
        await deleteDoc(doc(db, 'accounts', account.id!));
        
        // Registrar la eliminación en logs
        await addDoc(collection(db, 'logs'), {
          usuarioEmail: auth.currentUser?.email,
          accion: 'eliminación',
          entidad: 'cuenta',
          detalles: `Eliminó la cuenta ${account.nombre} del banco ${account.banco}`,
          timestamp: new Date()
        });

        toast.success('Cuenta eliminada correctamente');
      } catch (error) {
        console.error('Error al eliminar la cuenta:', error);
        toast.error('Error al eliminar la cuenta');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const accountData = {
        ...formData,
        createdAt: new Date()
      };

      if (editingAccount) {
        // Actualizar cuenta existente
        await updateDoc(doc(db, 'accounts', editingAccount.id!), accountData);
        
        // Registrar la modificación en logs
        await addDoc(collection(db, 'logs'), {
          usuarioEmail: auth.currentUser?.email,
          accion: 'modificación',
          entidad: 'cuenta',
          detalles: `Modificó la cuenta ${formData.nombre} del banco ${formData.banco}`,
          timestamp: new Date()
        });

        toast.success('Cuenta actualizada correctamente');
      } else {
        // Crear nueva cuenta
        await addDoc(collection(db, 'accounts'), accountData);
        
        // Registrar la creación en logs
        await addDoc(collection(db, 'logs'), {
          usuarioEmail: auth.currentUser?.email,
          accion: 'creación',
          entidad: 'cuenta',
          detalles: `Creó la cuenta ${formData.nombre} del banco ${formData.banco}`,
          timestamp: new Date()
        });

        toast.success('Cuenta creada correctamente');
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar la cuenta');
    }
  };

  // Función auxiliar para normalizar una fecha en el formato DD/MM/YYYY
  const normalizeFechaStr = (fechaStr: string): string => {
    try {
      if (!fechaStr) return '';
      
      // Eliminar espacios en blanco
      fechaStr = fechaStr.trim();
      
      // Si la fecha tiene el formato DD/MM/YYYY o D/MM/YYYY, extraemos los componentes
      const parts = fechaStr.split('/');
      if (parts.length === 3) {
        // Quitamos el cero inicial del día para normalizar a D/MM/YYYY
        const day = parseInt(parts[0], 10).toString();
        const month = parts[1].padStart(2, '0'); // Mantenemos el mes con formato de 2 dígitos
        const year = parts[2];
        return `${day}/${month}/${year}`;
      }
      
      // Si no se pudo normalizar, devolver la fecha original
      return fechaStr;
    } catch (e) {
      console.error('[Accounts] Error normalizando fecha:', e);
      return fechaStr;
    }
  };

  // Función para normalizar descripción (eliminar espacios extra, etc)
  const normalizeDescripcion = (descripcion: string): string => {
    if (!descripcion) return '';
    return descripcion.trim().replace(/\s+/g, ' ');
  };

  // Obtener fecha normalizada para agrupar por mes
  const getMonthKey = (timestamp: Date | Timestamp): string => {
    const date = timestamp instanceof Date ? 
      timestamp : 
      new Date((timestamp as any).seconds * 1000);
    
    // Formato: YYYY-MM (año-mes)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  
  // Obtener nombre del mes para mostrar en la UI
  const getMonthName = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  };
  
  // Filtrar logs para mostrar solo los de los últimos 3 meses
  const getFilteredImportLogs = (logs: ImportLog[], accountId: string): { recent: ImportLog[], older: ImportLog[] } => {
    if (!logs || !logs.length) return { recent: [], older: [] };
    
    const accountLogs = logs.filter(log => log.accountId === accountId);
    
    // Obtener fecha actual y restar 3 meses
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    
    // Separar logs en recientes (últimos 3 meses) y antiguos
    const recent: ImportLog[] = [];
    const older: ImportLog[] = [];
    
    accountLogs.forEach(log => {
      const logDate = log.timestamp instanceof Date ? 
        log.timestamp : 
        new Date((log.timestamp as any).seconds * 1000);
      
      if (logDate >= threeMonthsAgo) {
        recent.push(log);
      } else {
        older.push(log);
      }
    });
    
    return { recent, older };
  };
  
  // Agrupar logs por mes
  const groupLogsByMonth = (logs: ImportLog[]): Record<string, ImportLog[]> => {
    const grouped: Record<string, ImportLog[]> = {};
    
    logs.forEach(log => {
      const monthKey = getMonthKey(log.timestamp);
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      
      grouped[monthKey].push(log);
    });
    
    return grouped;
  };
  
  // Alternar visualización de logs antiguos
  const toggleOlderLogs = (accountId: string) => {
    setShowOlderLogs(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };
  
  // Alternar expansión/colapso de acordeón de mes
  const toggleMonthExpansion = (accountId: string, monthKey: string) => {
    const key = `${accountId}-${monthKey}`;
    setExpandedMonths(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Función auxiliar para generar la clave de transacción para comparar duplicados
  const generateTransactionKey = (transaction: Transaction): string => {
    const t: any = transaction as any;
    const normalizedFechaStr = normalizeFechaStr(transaction.fechaStr);
    const normalizedDescripcion = normalizeDescripcion(transaction.descripcion || '');

    // Componente de referencia robusto
    const rawRef = (t.refTitularCuenta || '').toString().trim();
    const cleanedRef = rawRef.replace(/\s+/g, '');
    let referenceKey = cleanedRef;

    if (!referenceKey) {
      const detailsCode = extractDetailsCode(t.detallesAdicionales);
      if (detailsCode && detailsCode !== '-') {
        referenceKey = detailsCode;
      }
    }

    if (!referenceKey) {
      const regional = (t.regional || '').toString().trim();
      const tipoTransaccion = (t.tipoTransaccion || '').toString().trim();
      const oficina = (t.oficina || '').toString().trim();
      const combo = [regional, tipoTransaccion, oficina].filter(Boolean).join('|');
      referenceKey = combo || '-';
    }

    return `${transaction.accountId}|${normalizedFechaStr}|${transaction.valor}|${normalizedDescripcion}|${referenceKey}`;
  };

  const checkDuplicateTransactions = async (transactions: Transaction[]): Promise<DuplicateTransaction[]> => {
    const duplicates: DuplicateTransaction[] = [];
    const processedKeys = new Map<string, Transaction>(); // Mapa para rastrear transacciones por clave y detectar duplicados internos
    const internalDuplicatesCount = { count: 0 }; // Contador de duplicados internos
    const externalDuplicatesCount = { count: 0 }; // Contador de duplicados de base de datos
    
    // Filtrar transacciones para eliminar registros de saldo inicial/final
    const filteredTransactions = transactions.filter(transaction => {
      const isSaldoRecord = transaction.descripcion?.toUpperCase().includes('SALDO');
      if (isSaldoRecord) {
        console.log(`[Accounts] Ignorando registro de saldo: ${transaction.fechaStr} - ${transaction.descripcion}`);
      }
      return !isSaldoRecord;
    });
    
    console.log(`[Accounts] Analizando ${filteredTransactions.length} transacciones para detección de duplicados (${transactions.length - filteredTransactions.length} registros de saldo ignorados)`);
    
    // Paso 1: Encontrar duplicados internos (dentro del mismo archivo CSV)
    for (let i = 0; i < filteredTransactions.length; i++) {
      const transaction = filteredTransactions[i];
      const key = generateTransactionKey(transaction);
      
      console.log(`[Accounts] Verificando transacción #${i+1}: ${transaction.fechaStr} (${normalizeFechaStr(transaction.fechaStr)}) - ${transaction.valor} - ${transaction.descripcion} - Key: ${key}`);
      
      if (processedKeys.has(key)) {
        // Encontramos un duplicado interno
        const existingTransaction = processedKeys.get(key);
        internalDuplicatesCount.count++;
        
        console.log(`[Accounts] Duplicado INTERNO #${internalDuplicatesCount.count} encontrado: ${key}`);
        console.log(`   Original: ${existingTransaction?.fechaStr} - ${existingTransaction?.valor} - ${existingTransaction?.descripcion}`);
        console.log(`   Duplicado: ${transaction.fechaStr} - ${transaction.valor} - ${transaction.descripcion}`);
        
        // Agregamos este duplicado interno a la lista de duplicados
        duplicates.push({
          existing: existingTransaction as Transaction, // La primera ocurrencia
          new: transaction, // La ocurrencia duplicada
          approved: false,
          duplicateType: 'internal' // Marcamos que es un duplicado interno
        });
        
        // Continuamos con la siguiente transacción después de registrar el duplicado interno
        continue;
      }
      
      processedKeys.set(key, transaction);
    }
    
    console.log(`[Accounts] Total de duplicados INTERNOS encontrados: ${internalDuplicatesCount.count}`);
    
    // Paso 2: Verificar duplicados contra la base de datos (existentes en Firestore)
    // Solo verificamos las transacciones únicas (la primera ocurrencia de cada clave)
    for (const [key, transaction] of processedKeys.entries()) {
      // Normalizar la fecha para la consulta a Firestore
      const normalizedFechaStr = normalizeFechaStr(transaction.fechaStr);
      
      // Verificar en la base de datos utilizando la fecha normalizada
      // 1) Intento preferente: incluir referenceKey (si los documentos la tienen)
      const txRefKey = generateTransactionKey(transaction).split('|').pop();
      const baseConstraints = [
        where('accountId', '==', transaction.accountId),
        where('fechaStr', 'in', [transaction.fechaStr, normalizedFechaStr]),
        where('valor', '==', transaction.valor),
        where('descripcion', '==', transaction.descripcion)
      ] as any[];
      const duplicateQueryWithRef = query(
        collection(db, 'transactions'),
        ...baseConstraints,
        where('referenceKey', '==', txRefKey)
      );
      // 2) Fallback: sin referenceKey (para documentos antiguos)
      const duplicateQuery = query(
        collection(db, 'transactions'),
        ...baseConstraints
      );
      
      try {
        // Preferimos buscar con referenceKey para reducir falsos positivos
        let duplicateSnapshot = await getDocs(duplicateQueryWithRef);
        if (duplicateSnapshot.empty) {
          // Fallback a consulta amplia si no hay coincidencias por referenciaKey
          duplicateSnapshot = await getDocs(duplicateQuery);
        }
        // Validar coincidencia por referencia para evitar falsos positivos en el fallback
        if (!duplicateSnapshot.empty) {
          let matchedDoc: Transaction | null = null;

          for (const docSnap of duplicateSnapshot.docs) {
            const data: any = docSnap.data();
            // Si el documento ya tiene referenceKey persistido, úsalo primero
            if (data.referenceKey) {
              if (data.referenceKey === txRefKey) {
                matchedDoc = data as Transaction;
                break;
              }
              // Si tiene referenceKey pero no coincide, continuar
            }
            const rawRef = (data.refTitularCuenta || '').toString().trim().replace(/\s+/g, '');
            let referenceKey = rawRef;
            if (!referenceKey) {
              const detailsCode = extractDetailsCode(data.detallesAdicionales);
              if (detailsCode && detailsCode !== '-') {
                referenceKey = detailsCode;
              }
            }
            if (!referenceKey) {
              const regional = (data.regional || '').toString().trim();
              const tipoTransaccion = (data.tipoTransaccion || '').toString().trim();
              const oficina = (data.oficina || '').toString().trim();
              const combo = [regional, tipoTransaccion, oficina].filter(Boolean).join('|');
              referenceKey = combo || '-';
            }

            if (referenceKey === txRefKey) {
              matchedDoc = data as Transaction;
              break;
            }
          }

          if (matchedDoc) {
            externalDuplicatesCount.count++;
            console.log(`[Accounts] Duplicado EXTERNO #${externalDuplicatesCount.count} encontrado en base de datos: ${key}`);
            console.log(`   En Firestore: ${matchedDoc.fechaStr} - ${matchedDoc.valor} - ${matchedDoc.descripcion}`);
            console.log(`   En CSV: ${transaction.fechaStr} - ${transaction.valor} - ${transaction.descripcion}`);

            duplicates.push({
              existing: matchedDoc,
              new: transaction,
              approved: false,
              duplicateType: 'external'
            });
          }
        }
      } catch (error) {
        console.error('[Accounts] Error al buscar duplicados:', error);
        // Continuar con la siguiente transacción
        continue;
      }
    }
    
    console.log(`[Accounts] Total de duplicados EXTERNOS encontrados: ${externalDuplicatesCount.count}`);
    console.log(`[Accounts] Total combinado de duplicados: ${duplicates.length}`);
    
    return duplicates;
  };

  // Función para crear log de importación (actualmente no utilizada, se crea directamente en handleFileUpload)
  // const createImportLog = async (
  //   account: Account,
  //   fileName: string,
  //   totalRows: number,
  //   successfulImports: number,
  //   failedImports: number,
  //   duplicatesFound: number,
  //   duplicatesImported: number,
  //   errors: ImportError[],
  //   status: 'completed' | 'failed'
  // ) => {
  //   try {
  //     const importLog: ImportLog = {
  //       accountId: account.id || '',
  //       accountName: account.nombre,
  //       timestamp: new Date(),
  //       fileName,
  //       totalRows,
  //       successfulImports,
  //       failedImports,
  //       duplicatesFound,
  //       duplicatesImported,
  //       errors,
  //       status,
  //       userId: auth.currentUser?.email || ''
  //     };
  //
  //     await addDoc(collection(db, 'importLogs'), importLog);
  //   } catch (error) {
  //     console.error('Error al guardar el registro de importación:', error);
  //   }
  // };

  // Función para eliminar log de importación (actualmente no utilizada)
  // const deleteImportLog = async (logId: string) => {
  //   try {
  //     await deleteDoc(doc(db, 'importLogs', logId));
  //     toast.success('Registro de importación eliminado');
  //   } catch (error) {
  //     console.error('Error al eliminar el registro:', error);
  //     toast.error('Error al eliminar el registro');
  //   }
  // };

  const deleteImportedTransactions = async (log: ImportLog) => {
    if (!log.id) {
      toast.error('No se puede eliminar las transacciones: ID de importación no válido');
      return;
    }

    if (!window.confirm(`¿Está seguro de eliminar todas las transacciones de la importación "${log.fileName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      console.log('Buscando transacciones para eliminar. ImportId:', log.id);

      // Primero verificamos si hay transacciones para eliminar
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('importId', '==', log.id)
      );

      const querySnapshot = await getDocs(transactionsQuery);
      console.log('Transacciones encontradas:', querySnapshot.size);

      if (querySnapshot.empty) {
        toast.error('No se encontraron transacciones para eliminar');
        return;
      }

      // Crear un nuevo batch para la eliminación
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        console.log('Eliminando transacción:', doc.id);
        batch.delete(doc.ref);
      });

      // Ejecutar el batch
      await batch.commit();

      // Actualizar el registro de importación
      const importLogRef = doc(db, 'importLogs', log.id);
      await updateDoc(importLogRef, {
        status: 'deleted',
        successfulImports: 0
      });

      toast.success(`Se eliminaron ${querySnapshot.size} transacciones de la importación "${log.fileName}"`);
    } catch (error) {
      console.error('Error al eliminar las transacciones:', error);
      toast.error('Error al eliminar las transacciones. Por favor, intente nuevamente.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, account: Account) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    setProcessingImportAccount(account.id || null);
    const file = event.target.files[0];
    const errors: ImportError[] = [];
    let totalRows = 0;
    let successfulImports = 0;
    let failedImports = 0;

    try {
      const results = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(file, {
          complete: resolve,
          error: reject,
          header: true,
          skipEmptyLines: true
        });
      });

      totalRows = results.data.length;
      setImportProgress({ current: 0, total: totalRows });

      // Crear primero el registro de importación
      const importLogRef = await addDoc(collection(db, 'importLogs'), {
        accountId: account.id,
        accountName: account.nombre,
        timestamp: new Date(),
        fileName: file.name,
        totalRows,
        successfulImports: 0,
        failedImports: 0,
        duplicatesFound: 0,
        duplicatesImported: 0,
        errors: [],
        status: 'processing',
        userId: auth.currentUser?.email || ''
      });

      const processedTransactions = [];
      
      for (let i = 0; i < results.data.length; i++) {
        const row = results.data[i];
        try {
          const transaction = processTransaction(
            row,
            account.id || '',
            account.nombre || '',
            account.numeroCuenta || '',
            account.banco || '',
            importLogRef.id, // Usar el ID del documento de importLog
            i
          );
          if (transaction) {
            processedTransactions.push({
              ...transaction,
              importId: importLogRef.id // Asegurar que el importId está presente
            });
          }
          setImportProgress({ current: i + 1, total: totalRows });
        } catch (error) {
          errors.push({
            rowIndex: i,
            rowData: JSON.stringify(row),
            errorMessage: error instanceof Error ? error.message : 'Error desconocido',
            errorType: 'processing'
          });
          failedImports++;
        }
      }

      if (processedTransactions.length === 0) {
        await updateDoc(importLogRef, {
          status: 'failed',
          failedImports: totalRows,
          errors
        });
        toast.error('No se encontraron transacciones válidas en el archivo');
        return;
      }

      // Verificar duplicados
      const duplicates = await checkDuplicateTransactions(processedTransactions);
      
      if (duplicates.length > 0) {
        const uniqueTransactions = processedTransactions.filter(
          (transaction) => !duplicates.some((dup) => generateTransactionKey(dup.new) === generateTransactionKey(transaction))
        );

        if (uniqueTransactions.length > 0) {
          successfulImports = await importTransactions(uniqueTransactions);
        }

        setDuplicateTransactions(duplicates);
        setShowDuplicatesModal(true);

        await updateDoc(importLogRef, {
          status: 'completed',
          successfulImports,
          failedImports,
          duplicatesFound: duplicates.length,
          errors
        });
      } else {
        successfulImports = await importTransactions(processedTransactions);

        await updateDoc(importLogRef, {
          status: 'completed',
          successfulImports,
          failedImports,
          duplicatesFound: 0,
          errors
        });

        toast.success(
          `Importación exitosa: ${successfulImports} transacciones importadas` +
          (failedImports > 0 ? `, ${failedImports} registros con error` : '')
        );
      }

    } catch (error) {
      console.error('Error en la importación:', error);
      toast.error('Error al procesar el archivo CSV');
    } finally {
      setProcessingImportAccount(null);
      setImportProgress({ current: 0, total: 0 });
      event.target.value = '';
    }
  };

  const importTransactions = async (transactions: Transaction[]) => {
    // Verificar que no haya duplicados antes de importar
    const batchSize = 500; // Límite de operaciones por lote en Firestore
    let importedCount = 0;
    
    // Procesar en lotes para evitar sobrepasar límites de Firestore
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = writeBatch(db);
      const currentBatch = transactions.slice(i, i + batchSize);
      
      currentBatch.forEach(transaction => {
        const referenceKey = generateTransactionKey(transaction).split('|').pop();
        const docRef = doc(collection(db, 'transactions'));
        batch.set(docRef, {
          ...transaction,
          referenceKey,
          createdAt: new Date()
        });
      });

      await batch.commit();
      importedCount += currentBatch.length;
      console.log(`Lote ${Math.floor(i / batchSize) + 1} importado: ${currentBatch.length} transacciones`);
    }
    
    return importedCount;
  };

  const handleResolveDuplicates = async (resolvedDuplicates: DuplicateTransaction[]) => {
    const approvedDuplicates = resolvedDuplicates.filter(d => d.approved);
    await importTransactions(approvedDuplicates.map(d => d.new));
  };

  // Función para encontrar transacciones duplicadas (actualmente no utilizada)
  // const findDuplicateTransactions = async (account: Account) => {
  //   try {
  //     const transactionsRef = collection(db, 'transactions');
  //     const q = query(
  //       transactionsRef,
  //       where('accountId', '==', account.id)
  //     );
  //
  //     const snapshot = await getDocs(q);
  //     const transactions = snapshot.docs.map(doc => ({
  //       id: doc.id,
  //       ...doc.data()
  //     })) as Transaction[];
  //
  //     // Agrupar transacciones por características similares
  //     const groups = new Map<string, Transaction[]>();
  //     
  //     transactions.forEach(transaction => {
  //       const key = `${transaction.fechaStr}|${transaction.valor}|${transaction.descripcion}`;
  //       if (!groups.has(key)) {
  //         groups.set(key, []);
  //       }
  //       groups.get(key)?.push(transaction);
  //     });
  //
  //     // Convertir grupos a formato para el modal
  //     const duplicateGroups: DuplicateGroup[] = [];
  //     for (const [key, transactions] of groups) {
  //       if (transactions.length > 1) {
  //         duplicateGroups.push({
  //           key,
  //           transactions: transactions.sort((a, b) => {
  //             const dateA = a.fecha instanceof Timestamp ? a.fecha.toDate().getTime() : a.fecha.getTime();
  //             const dateB = b.fecha instanceof Timestamp ? b.fecha.toDate().getTime() : b.fecha.getTime();
  //             return dateB - dateA;
  //           }),
  //           selectedId: transactions[0].id, // Seleccionar la transacción más reciente por defecto
  //           isExpanded: false
  //         });
  //       }
  //     }
  //
  //     if (duplicateGroups.length === 0) {
  //       toast.success('No se encontraron transacciones duplicadas');
  //       return;
  //     }
  //
  //     setDuplicateGroups(duplicateGroups);
  //     setSelectedAccount(account);
  //     setShowCleanDuplicatesModal(true);
  //   } catch (error) {
  //     console.error('Error al buscar duplicados:', error);
  //     toast.error('Error al buscar transacciones duplicadas');
  //   }
  // };

  const handleSaveCleanupSelections = async (selections: { groupKey: string; selectedId: string }[]) => {
    if (!selectedAccount?.id) return;

    try {
      const batch = writeBatch(db);
      let deletedCount = 0;

      for (const group of duplicateGroups) {
        const selection = selections.find(s => s.groupKey === group.key);
        if (!selection) continue;

        // Eliminar todas las transacciones del grupo excepto la seleccionada
        for (const transaction of group.transactions) {
          if (transaction.id !== selection.selectedId) {
            batch.delete(doc(db, 'transactions', transaction.id));
            deletedCount++;
          }
        }
      }

      await batch.commit();

      // Registrar la limpieza en los logs
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'limpieza manual',
        entidad: 'transacciones',
        detalles: `Eliminó manualmente ${deletedCount} transacciones duplicadas de la cuenta ${selectedAccount.nombre}`,
        timestamp: new Date()
      });

      toast.success(`Se eliminaron ${deletedCount} transacciones duplicadas`);
      setShowCleanDuplicatesModal(false);
    } catch (error) {
      console.error('Error al eliminar duplicados:', error);
      toast.error('Error al eliminar las transacciones duplicadas');
    }
  };

  const handleDeleteTransactions = async (selectedIds: string[]): Promise<void> => {
    console.log('[Accounts] handleDeleteTransactions llamado con', selectedIds.length, 'IDs');
    console.log('[Accounts] IDs recibidos para eliminar:', selectedIds);
    console.log('[Accounts] INFO DIAGNÓSTICO - db config:', db.app.name, '/ app:', db.app.options.projectId || 'unknown');
    
    if (selectedIds.length === 0) {
      console.log('[Accounts] No hay IDs para eliminar, retornando');
      return;
    }
    
    try {
      // VERIFICACIÓN PREVIA: Comprobar que los documentos existen antes de intentar eliminarlos
      const docChecks = [];
      
      // Nota: Ya no usamos rutas alternativas, enfocándonos en buscar por campo 'id'
      
      // IMPORTANTE: Buscamos documentos cuyo CAMPO 'id' coincida con los IDs seleccionados, no el ID del documento
      console.log('[Accounts] DIAGNÓSTICO: Buscando documentos por CAMPO id, no por ID de documento');
      
      for (const idField of selectedIds) {
        try {
          // Buscar documento por campo 'id', no por ID de documento
          const transactionsRef = collection(db, 'transactions');
          const q = query(transactionsRef, where('id', '==', idField));
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) {
            console.warn(`[Accounts] No se encontró documento con campo id=${idField}`);
            docChecks.push({ id: idField, exists: false, reason: 'no_field_match' });
          } else {
            const doc = querySnapshot.docs[0];
            console.log(`[Accounts] ¡ENCONTRADO! Documento con campo id=${idField} encontrado. ID real del documento: ${doc.id}`);
            console.log(`[Accounts] Datos del documento:`, JSON.stringify(doc.data()));
            docChecks.push({ id: idField, exists: true, docId: doc.id, reason: 'found_by_field' });
          }
          
          // Verificar si también existe un documento con ese ID (poco probable)
          const directRef = doc(db, 'transactions', idField);
          const directSnap = await getDoc(directRef);
          if (directSnap.exists()) {
            console.log(`[Accounts] ATENCIÓN: También existe un documento con ID=${idField}`);
          }
          
        } catch (checkError) {
          console.error(`[Accounts] Error al verificar documento con campo id=${idField}:`, checkError);
          docChecks.push({ id: idField, error: checkError });
        }
      }
      
      // ELIMINACIÓN INDIVIDUAL con mejor diagnóstico
      console.log('[Accounts] Iniciando eliminación individual de documentos');
      const resultados = [];
      
      // Procesar los resultados de verificación previa para la eliminación
      const docsToDelete = docChecks.filter(check => check.exists && check.docId);
      console.log(`[Accounts] Se encontraron ${docsToDelete.length} documentos para eliminar con su ID real`);
      
      for (const docCheck of docsToDelete) {
        try {
          const idField = docCheck.id;      // El valor del campo 'id' (lo que se ve en la UI)
          const realDocId = docCheck.docId;  // El ID real del documento en Firestore
          
          console.log(`[Accounts] Eliminando documento: campo id=${idField}, ID real=${realDocId}`);
          
          try {
            // Eliminar usando el ID real del documento
            const transRef = doc(db, 'transactions', realDocId as string);
            console.log(`[Accounts] Eliminando documento con ID real=${realDocId}`);
            await deleteDoc(transRef);
            console.log(`[Accounts] Documento con ID real=${realDocId} eliminado con éxito`);
            resultados.push({ id: idField, realDocId, success: true, method: 'deleteDoc_by_real_id' });
          } catch (deleteError) {
            console.error(`[Accounts] Error al eliminar documento con ID real=${realDocId}:`, deleteError);
            
            // Intento alternativo con batch
            try {
              const batch = writeBatch(db);
              const batchRef = doc(db, 'transactions', realDocId as string);
              batch.delete(batchRef);
              console.log(`[Accounts] Intentando eliminar documento con ID real=${realDocId} usando writeBatch`);
              await batch.commit();
              console.log(`[Accounts] Documento con ID real=${realDocId} eliminado con éxito mediante batch`);
              resultados.push({ id: idField, realDocId, success: true, method: 'batch_by_real_id' });
            } catch (batchError) {
              console.error(`[Accounts] Error al eliminar documento con ID real=${realDocId} con batch:`, batchError);
              resultados.push({ id: idField, realDocId, success: false, error: batchError, method: 'batch_failed' });
            }
          }
        } catch (error) {
          console.error(`[Accounts] Error general al procesar documento ${docCheck.id}:`, error);
          resultados.push({ id: docCheck.id, docId: docCheck.docId, success: false, error, method: 'error_general' });
        }
      }
      
      // Para IDs que no se encontraron, registrarlos como no existentes
      const notFoundIds = docChecks.filter(check => !check.exists).map(check => check.id);
      for (const missingId of notFoundIds) {
        console.warn(`[Accounts] No se encontró documento con campo id=${missingId} para eliminar`);
        resultados.push({ id: missingId, success: true, method: 'skipped_not_exists' });
      }
      
      console.log('[Accounts] Resultado de eliminaciones individuales:', resultados);
      const fallos = resultados.filter(r => !r.success).length;
      
      if (fallos > 0) {
        console.error(`[Accounts] Fallaron ${fallos} de ${selectedIds.length} eliminaciones`);
      }
      
      // VERIFICACIÓN POSTERIOR: Comprobar que los documentos ya no existen
      console.log('[Accounts] Verificando eliminación efectiva...');
      for (const id of selectedIds) {
        const transRef = doc(db, 'transactions', id);
        const docSnap = await getDoc(transRef);
        console.log(`[Accounts] Verificando si ${id} fue eliminado: ${!docSnap.exists() ? 'ELIMINADO' : 'AÚN EXISTE'}`);
        if (docSnap.exists()) {
          console.error(`[Accounts] ERROR: El documento ${id} aún existe después de intentar eliminarlo`);
          console.log(`[Accounts] Datos del documento persistente:`, JSON.stringify(docSnap.data()));
        }
      }
      
      // Se puede añadir un log de auditoría si es necesario
      console.log('[Accounts] Agregando entrada al log de actividad');
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'eliminación manual',
        entidad: 'transacciones',
        detalles: `Intentó eliminar ${selectedIds.length} transacciones (${selectedIds.length - fallos} con éxito)`,
        timestamp: new Date(),
        resultado: JSON.stringify(resultados),
        diagnostico: JSON.stringify(docChecks)
      });
      console.log('[Accounts] Log de actividad agregado exitosamente');
      
      // Mostrar notificación de éxito al usuario
      console.log('[Accounts] Mostrando notificación de éxito');
      toast.success(`${selectedIds.length - fallos} transacciones procesadas.`);
      toast("Se ha realizado un diagnóstico completo. Revisa la consola para detalles.");
      
      console.log('[Accounts] handleDeleteTransactions completado exitosamente');
    } catch (error) {
      console.error('[Accounts] Error al eliminar transacciones:', error);
      toast.error('Error al eliminar las transacciones.');
      throw error;
    }
  };

  const openDeleteModal = (accountId: string) => {
    if (setSelectedAccountId) setSelectedAccountId(accountId);
    if (setIsDeleteModalOpen) setIsDeleteModalOpen(true);
  };

  const filteredAccounts = accounts?.filter(account => 
    account.nombre.toLowerCase().includes(search.toLowerCase()) ||
    account.numeroCuenta.includes(search)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cuentas Bancarias</h1>
          <p className="mt-1 text-sm text-gray-500">Gestiona tus cuentas bancarias y sus movimientos</p>
        </div>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre o número..."
              className="pl-10 pr-4 py-2.5 w-64 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <PlusCircle size={20} />
              Agregar cuenta
            </button>
            {/* Eliminado el botón general de eliminación de transacciones ya que se añadirá a cada tarjeta */}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAccounts?.map((account) => (
          <div 
            key={account.id} 
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{account.nombre}</h3>
                  <p className="text-sm text-gray-500 flex items-center">
                    <span className="mr-2">{account.banco}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {account.tipo === 'corriente' ? 'Cuenta Corriente' : 'Cuenta de Ahorros'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleEdit(account)}
                  className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
                  title="Editar cuenta"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => openDeleteModal(account.id!)}
                  className="p-2 text-gray-600 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors duration-200"
                  title="Eliminar transacciones"
                >
                  <FileX size={18} />
                </button>
                <button
                  onClick={() => handleDelete(account)}
                  className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200"
                  title="Eliminar cuenta"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">Número de cuenta:</span>
                <span className="text-sm text-gray-900 font-mono">{account.numeroCuenta}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(e, account)}
                    className="hidden"
                    id={`file-upload-${account.id}`}
                    disabled={processingImportAccount !== null}
                  />
                  <label
                    htmlFor={`file-upload-${account.id}`}
                    className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border cursor-pointer group w-full
                      ${processingImportAccount === account.id ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-blue-50 hover:border-blue-500'}`}
                  >
                    {processingImportAccount === account.id ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-600">
                          Procesando {importProgress.current} de {importProgress.total}
                          {' '}({Math.round((importProgress.current / importProgress.total) * 100)}%)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload size={18} className="text-gray-400 group-hover:text-blue-500" />
                        <span className="text-sm text-gray-600 group-hover:text-blue-600">Importar CSV</span>
                      </>
                    )}
                  </label>
                </div>
                
                
              </div>
            </div>

            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Historial de Importaciones</h4>
                <div className="space-y-2">
                {(() => {
                  // Obtener logs filtrados para esta cuenta
                  const { recent, older } = getFilteredImportLogs(importLogs || [], account.id || '');
                  
                  // Si no hay logs, mostrar mensaje
                  if ((recent.length + older.length) === 0) {
                    return <p className="text-sm text-gray-500">No hay registros de importación para esta cuenta.</p>;
                  }
                  
                  // Agrupar logs recientes por mes
                  const recentByMonth = groupLogsByMonth(recent);
                  // Ordenar las claves de mes en orden descendente (más reciente primero)
                  const sortedRecentMonths = Object.keys(recentByMonth).sort().reverse();
                  
                  // Componentes a renderizar
                  const components: JSX.Element[] = [];
                  
                  // Renderizar logs recientes agrupados por mes
                  sortedRecentMonths.forEach(monthKey => {
                    const logsForMonth = recentByMonth[monthKey];
                    const monthId = `${account.id}-${monthKey}`;
                    const isExpanded = expandedMonths[monthId] || false;
                    
                    components.push(
                      <div key={monthId} className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
                        <button 
                          onClick={() => toggleMonthExpansion(account.id || '', monthKey)}
                          className="w-full flex items-center justify-between bg-gray-50 p-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-100 transition-colors"
                        >
                          <h5 className="text-sm font-medium text-gray-700">{getMonthName(monthKey)}</h5>
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 mr-2">{logsForMonth.length} archivos</span>
                            {isExpanded ? 
                              <ChevronUp size={16} className="text-gray-500" /> : 
                              <ChevronDown size={16} className="text-gray-500" />
                            }
                          </div>
                        </button>
                        <div className={`space-y-2 px-3 pb-3 ${isExpanded ? 'block' : 'hidden'}`}>
                          {logsForMonth.map(log => (
                            <div key={log.id} className="text-sm bg-gray-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium">{log.fileName}</span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">
                                    {log.timestamp instanceof Date ? 
                                      log.timestamp.toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : 
                                      new Date((log.timestamp as any).seconds * 1000).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button
                                    onClick={() => deleteImportedTransactions(log)}
                                    className="p-1 hover:bg-yellow-100 rounded-full transition-colors"
                                    title="Eliminar transacciones"
                                  >
                                    <Trash2 size={14} className="text-yellow-500" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-gray-600 space-y-1">
                                <p>Total procesados: {log.totalRows}</p>
                                <p className="text-green-600">Importados: {log.successfulImports}</p>
                                {log.failedImports > 0 && (
                                  <p className="text-red-600">Fallidos: {log.failedImports}</p>
                                )}
                                {log.duplicatesFound > 0 && (
                                  <p className="text-yellow-600">
                                    Duplicados: {log.duplicatesFound}
                                    {log.duplicatesImported > 0 && ` (${log.duplicatesImported} importados)`}
                                  </p>
                                )}
                                {log.errors.length > 0 && (
                                  <div className="mt-2">
                                    <button
                                      onClick={() => {
                                        console.log('Errores:', log.errors);
                                        toast.error(
                                          <div className="max-h-60 overflow-auto">
                                            {log.errors.map((error, index) => (
                                              <div key={index} className="mb-2">
                                                <p>Fila {error.rowIndex + 1}: {error.errorMessage}</p>
                                                <p className="text-xs text-gray-500">Tipo: {error.errorType}</p>
                                              </div>
                                            ))}
                                          </div>,
                                          { duration: 5000 }
                                        );
                                      }}
                                      className="text-xs text-red-600 hover:text-red-800"
                                    >
                                      Ver {log.errors.length} errores
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                  
                  // Agregar botón "Ver más" si hay logs antiguos
                  if (older.length > 0) {
                    // Botón para mostrar/ocultar logs antiguos
                    components.push(
                      <div key={`${account.id}-older-toggle`} className="mt-2">
                        <button
                          onClick={() => toggleOlderLogs(account.id || '')}
                          className="flex items-center text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
                        >
                          {showOlderLogs[account.id || ''] ? (
                            <>
                              <ChevronUp size={16} className="mr-1" /> Ocultar registros antiguos
                            </>
                          ) : (
                            <>
                              <ChevronDown size={16} className="mr-1" /> Ver más ({older.length} registros anteriores)
                            </>
                          )}
                        </button>
                      </div>
                    );
                    
                    // Si el estado indica que se deben mostrar los logs antiguos, renderizarlos
                    if (showOlderLogs[account.id || '']) {
                      // Agrupar logs antiguos por mes
                      const olderByMonth = groupLogsByMonth(older);
                      // Ordenar las claves de mes en orden descendente (más reciente primero)
                      const sortedOlderMonths = Object.keys(olderByMonth).sort().reverse();
                      
                      components.push(
                        <div key={`${account.id}-older-logs`} className="mt-3 border-t pt-3">
                          {sortedOlderMonths.map(monthKey => {
                            const logsForMonth = olderByMonth[monthKey];
                            const monthId = `${account.id}-${monthKey}-older`;
                            const isExpanded = expandedMonths[monthId] || false;
                            
                            return (
                              <div key={monthId} className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
                                <button 
                                  onClick={() => toggleMonthExpansion(account.id || '', `${monthKey}-older`)}
                                  className="w-full flex items-center justify-between bg-gray-50 p-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-100 transition-colors"
                                >
                                  <h5 className="text-sm font-medium text-gray-700">{getMonthName(monthKey)}</h5>
                                  <div className="flex items-center">
                                    <span className="text-xs text-gray-500 mr-2">{logsForMonth.length} archivos</span>
                                    {isExpanded ? 
                                      <ChevronUp size={16} className="text-gray-500" /> : 
                                      <ChevronDown size={16} className="text-gray-500" />
                                    }
                                  </div>
                                </button>
                                <div className={`space-y-2 px-3 pb-3 ${isExpanded ? 'block' : 'hidden'}`}>
                                  {logsForMonth.map(log => (
                                    <div key={log.id} className="text-sm bg-gray-50 p-3 rounded-lg">
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium">{log.fileName}</span>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs text-gray-500">
                                            {log.timestamp instanceof Date ? 
                                              log.timestamp.toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : 
                                              new Date((log.timestamp as any).seconds * 1000).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                          <button
                                            onClick={() => deleteImportedTransactions(log)}
                                            className="p-1 hover:bg-yellow-100 rounded-full transition-colors"
                                            title="Eliminar transacciones"
                                          >
                                            <Trash2 size={14} className="text-yellow-500" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="text-gray-600 space-y-1">
                                        <p>Total procesados: {log.totalRows}</p>
                                        <p className="text-green-600">Importados: {log.successfulImports}</p>
                                        {log.failedImports > 0 && (
                                          <p className="text-red-600">Fallidos: {log.failedImports}</p>
                                        )}
                                        {log.duplicatesFound > 0 && (
                                          <p className="text-yellow-600">
                                            Duplicados: {log.duplicatesFound}
                                            {log.duplicatesImported > 0 && ` (${log.duplicatesImported} importados)`}
                                          </p>
                                        )}
                                        {log.errors.length > 0 && (
                                          <div className="mt-2">
                                            <button
                                              onClick={() => {
                                                console.log('Errores:', log.errors);
                                                toast.error(
                                                  <div className="max-h-60 overflow-auto">
                                                    {log.errors.map((error, index) => (
                                                      <div key={index} className="mb-2">
                                                        <p>Fila {error.rowIndex + 1}: {error.errorMessage}</p>
                                                        <p className="text-xs text-gray-500">Tipo: {error.errorType}</p>
                                                      </div>
                                                    ))}
                                                  </div>,
                                                  { duration: 5000 }
                                                );
                                              }}
                                              className="text-xs text-red-600 hover:text-red-800"
                                            >
                                              Ver {log.errors.length} errores
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  }
                  
                  return components;
                })()}
                </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDiagnosticAccountId(account.id!);
                  setShowDiagnosticModal(true);
                }}
                className="mt-4 flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 w-full justify-center"
              >
                <AlertTriangle size={18} />
                <span>Diagnosticar duplicados</span>
              </button>
            </div>
          </div>
        ))}
        
        {filteredAccounts?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Building2 className="h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No se encontraron cuentas</h3>
            <p className="text-sm text-gray-500 text-center mt-1">
              {search ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando una nueva cuenta bancaria'}
            </p>
            {!search && (
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <PlusCircle size={20} />
                <span>Agregar Cuenta</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la cuenta</label>
              <input
                type="text"
                required
                placeholder="Ej: Cuenta Principal"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                required
                placeholder="Ej: Banco Santander"
                value={formData.banco}
                onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta</label>
              <input
                type="text"
                required
                placeholder="Ej: 1234-5678-90"
                value={formData.numeroCuenta}
                onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value })}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-gray-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'ahorros' | 'corriente' })}
                className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="corriente">Cuenta Corriente</option>
                <option value="ahorros">Cuenta de Ahorros</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              >
                {editingAccount ? 'Guardar Cambios' : 'Crear Cuenta'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    
    {showCleanDuplicatesModal && selectedAccount && (
      <CleanDuplicatesModal
        isOpen={showCleanDuplicatesModal}
        onClose={() => setShowCleanDuplicatesModal(false)}
        duplicateGroups={duplicateGroups}
        onSaveSelections={handleSaveCleanupSelections}
        account={selectedAccount}
      />
    )}
    
    {/* Modal de diagnóstico de transacciones */}
    <TransactionDiagnosticModal
      isOpen={showDiagnosticModal}
      onClose={() => setShowDiagnosticModal(false)}
      accountId={diagnosticAccountId || undefined}
    />
    
    {selectedAccountId && (
      <DeleteTransactionsModal
        isOpen={isDeleteModalOpen || false}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedAccountId(null); // Limpiar al cerrar
        }}
        accountId={selectedAccountId}
        accounts={(accounts || []).map(account => ({
          id: account.id!, // Aseguramos que el id no es undefined
          name: account.nombre // Adaptar la propiedad 'nombre' como 'name' para el componente
        }))}
        onDelete={handleDeleteTransactions}
      />
    )}

    {showDuplicatesModal && (
      <DuplicateTransactionsModal
        duplicates={duplicateTransactions}
        onResolve={handleResolveDuplicates}
        onCancel={() => setShowDuplicatesModal(false)}
      />
    )}
    </div>
  );
}

export default Accounts;