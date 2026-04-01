import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Trash2, Plus, Edit2, Search } from 'lucide-react';
import { useCollection } from '../../../hooks/useCollection';
import { OwnerAccount, OwnerMonthlyBalance, BalancePendingDistribution, CompletedDistribution, Responsible } from '../../../types';
import { formatCOPAmount } from '../../../utils/moneyUtils';
import { buildBalanceId } from '../../../utils/importBalanceHelpers';
import { normalizeDocumento } from '../../../utils/ownerAccountUtils';
import { processBalanceRowFromCSV } from '../../../utils/balanceImportUtils';
import { detectCSVDelimiter } from '../../../utils/csvUtils';
import { getTopSuggestions } from '../../../utils/fuzzyMatch';
import { canDeleteBalance, canEditBalance, getBalanceStatus } from '../../../utils/balanceUtils';
import { doc, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import DistributeBalanceModal from './DistributeBalanceModal';
import IdentifyOwnerModal from '../../owners/components/IdentifyOwnerModal';
import { UnidentifiedOwner, OwnerIdentification } from '../../owners/components/IdentifyOwnerModal';
import CreateAccountsModal from '../../owners/components/CreateAccountsModal';
import { OwnerNeedingAccount, AccountCreation } from '../../owners/components/CreateAccountsModal';
import AddBalanceManualModal from './AddBalanceManualModal';

interface ParsedBalanceRow {
  propietario: string;
  nit: string;
  saldo: number;
  mes: number;
  anio: number;
}

export default function MonthlyBalancesTab() {
  const { data: balances, loading } = useCollection<OwnerMonthlyBalance>('ownerMonthlyBalances');
  const { data: accounts } = useCollection<OwnerAccount>('ownerAccounts');
  const { data: responsibles } = useCollection<Responsible>('responsibles');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modales
  const [showIdentifyOwnersModal, setShowIdentifyOwnersModal] = useState(false);
  const [unidentifiedOwners, setUnidentifiedOwners] = useState<UnidentifiedOwner[]>([]);
  const [showCreateAccountsModal, setShowCreateAccountsModal] = useState(false);
  const [ownersNeedingAccounts, setOwnersNeedingAccounts] = useState<OwnerNeedingAccount[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [pendingDistributions, setPendingDistributions] = useState<BalancePendingDistribution[]>([]);
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingBalance, setEditingBalance] = useState<OwnerMonthlyBalance | null>(null);
  
  // Selección múltiple y paginación
  const [selectedBalances, setSelectedBalances] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBanco, setFilterBanco] = useState('todos');
  const [filterDistribucion, setFilterDistribucion] = useState<'todos' | 'unica' | 'multiple'>('todos');

  // Datos temporales durante el proceso de importación
  const [parsedRows, setParsedRows] = useState<ParsedBalanceRow[]>([]);

  // Refs para mantener datos frescos dentro de callbacks asíncronos
  const accountsRef = useRef<OwnerAccount[]>([]);
  const responsiblesRef = useRef<Responsible[]>([]);
  const parsedRowsRef = useRef<ParsedBalanceRow[]>([]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    responsiblesRef.current = responsibles;
  }, [responsibles]);

  useEffect(() => {
    parsedRowsRef.current = parsedRows;
  }, [parsedRows]);

  const handleImportBalances = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const monthLabel = new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const confirmText = `Importar saldos de ${monthLabel}\n\nEsto sobrescribirá saldos existentes del mismo mes para cada NIT. ¿Continuar?`;
    if (!window.confirm(confirmText)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
    const parsed: ParsedBalanceRow[] = [];
    const unidentified: UnidentifiedOwner[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    try {
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;

        try {
          const result = processBalanceRowFromCSV(row);

          if (!result.isValid) {
            errors.push({ row: rowNum, message: result.error || 'Datos inválidos' });
            continue;
          }

          const { propietario, nit, saldo } = result;

          console.log('[Import CSV] Fila procesada', { rowNum, propietario, nit, saldoGuardado: saldo });

          parsed.push({
            propietario,
            nit,
            saldo,
            mes: selectedMonth,
            anio: selectedYear
          });

          // PASO 1: Verificar si el propietario existe (como responsible)
          const matchingResponsible = responsiblesRef.current.find(r =>
            normalizeDocumento(r.identificacion || '') === nit
          );

          if (!matchingResponsible) {
            // Propietario NO existe: necesita identificación
            console.warn('[Import CSV] Propietario no identificado', { propietario, nit });

            const suggestions = getTopSuggestions(
              propietario,
              nit,
              responsiblesRef.current.filter(r => r.type === 'owner').map(r => ({
                id: r.id!,
                name: r.name,
                identificacion: r.identificacion
              })),
              accountsRef.current.map(a => ({
                id: a.id!,
                propietario: a.propietario,
                documentoPropietario: a.documentoPropietario
              })),
              5
            );

            unidentified.push({
              propietario,
              nit,
              saldo,
              suggestions
            });
          }
        } catch (error) {
          errors.push({ row: rowNum, message: String(error) });
        }
      }

      if (errors.length > 0) {
        console.error('Errores durante parseo:', errors);
        toast.error(`${errors.length} errores encontrados (ver consola)`);
      }

      // Guardar datos parseados
      setParsedRows(parsed);

      // PASO 1: Si hay propietarios sin identificar, mostrar modal
      if (unidentified.length > 0) {
        setUnidentifiedOwners(unidentified);
        setShowIdentifyOwnersModal(true);
      } else {
        // Todos identificados, verificar cuentas
        await checkAccountsAndProceed(parsed);
      }

    } catch (error) {
      console.error('Error in import:', error);
      toast.error('Error durante la importación');
      setImporting(false);
    }
  };

  // PASO 1: Handler cuando se identifican los propietarios
  const handleOwnersIdentified = async (identifications: OwnerIdentification[]) => {
    setShowIdentifyOwnersModal(false);

    try {
      // Mapear NITs del CSV a NITs correctos y responsibleIds
      const nitToResponsibleId = new Map<string, string>();
      const nitMapping = new Map<string, string>(); // NIT CSV → NIT real del propietario

      // Separar propietarios omitidos de los que se procesarán
      const skippedNits = new Set<string>();
      
      // Crear los propietarios nuevos (sin cuentas todavía)
      for (const identification of identifications) {
        if (identification.action === 'skip') {
          skippedNits.add(identification.nit);
          console.log('[Identify Owners] Propietario omitido', { nit: identification.nit });
        } else if (identification.action === 'create_new' && identification.newOwnerData) {
          const { name, identificacion } = identification.newOwnerData;

          const responsibleData = {
            name,
            type: 'owner' as const,
            identificacion,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const responsibleRef = await addDoc(collection(db, 'responsibles'), responsibleData);
          nitToResponsibleId.set(identification.nit, responsibleRef.id);
          nitMapping.set(identification.nit, normalizeDocumento(identificacion)); // NIT CSV → NIT creado
          console.log('[Identify Owners] Propietario nuevo creado', { name, identificacion, id: responsibleRef.id });
        } else if (identification.action === 'link_existing' && identification.existingResponsibleId) {
          nitToResponsibleId.set(identification.nit, identification.existingResponsibleId);
          
          // Buscar el NIT real del propietario existente
          const existingResponsible = responsiblesRef.current.find(r => r.id === identification.existingResponsibleId);
          if (existingResponsible && existingResponsible.identificacion) {
            const realNit = normalizeDocumento(existingResponsible.identificacion);
            nitMapping.set(identification.nit, realNit); // NIT CSV → NIT del propietario existente
            console.log('[Identify Owners] Vinculado con propietario existente', { 
              nitCSV: identification.nit, 
              nitReal: realNit,
              responsibleId: identification.existingResponsibleId 
            });
          }
        }
      }

      const processedCount = identifications.length - skippedNits.size;

      if (skippedNits.size > 0) {
        toast(`${skippedNits.size} propietario(s) omitido(s), ${processedCount} procesado(s)`);
      } else {
        toast.success(`${identifications.length} propietario(s) identificados`);
      }

      // Actualizar parsedRows con los NITs correctos y filtrar omitidos
      const updatedRows = parsedRowsRef.current
        .filter(row => !skippedNits.has(row.nit)) // Excluir omitidos
        .map(row => {
          if (nitMapping.has(row.nit)) {
            return { ...row, nit: nitMapping.get(row.nit)! };
          }
          return row;
        });
      setParsedRows(updatedRows);

      // Si no hay filas para procesar, terminar
      if (updatedRows.length === 0) {
        toast('No hay propietarios para procesar. Todos fueron omitidos.');
        setImporting(false);
        return;
      }

      // Esperar a que Firestore actualice
      setTimeout(async () => {
        // PASO 2: Verificar qué propietarios necesitan cuentas (pasando el mapa de IDs)
        await checkAccountsAndProceed(updatedRows, nitToResponsibleId);
      }, 1000);

    } catch (error) {
      console.error('Error identifying owners:', error);
      toast.error('Error al identificar propietarios');
      setImporting(false);
    }
  };

  // PASO 2: Verificar cuentas y proceder
  const checkAccountsAndProceed = async (rows: ParsedBalanceRow[], nitToResponsibleIdMap?: Map<string, string>) => {
    const needingAccounts: OwnerNeedingAccount[] = [];

    for (const row of rows) {
      const { propietario, nit, saldo } = row;

      // Buscar el responsible (primero en el mapa si existe, luego en el ref)
      let responsible: Responsible | undefined;
      let responsibleId: string | undefined;

      if (nitToResponsibleIdMap && nitToResponsibleIdMap.has(nit)) {
        // Usar el ID del mapa (recién identificado)
        responsibleId = nitToResponsibleIdMap.get(nit);
        responsible = responsiblesRef.current.find(r => r.id === responsibleId);
        
        // Si no está en el ref todavía, intentar encontrarlo por NIT (puede estar recargando)
        if (!responsible) {
          responsible = responsiblesRef.current.find(r =>
            normalizeDocumento(r.identificacion || '') === nit
          );
        }
      } else {
        // Buscar normalmente por NIT
        responsible = responsiblesRef.current.find(r =>
          normalizeDocumento(r.identificacion || '') === nit
        );
      }

      if (!responsible && !responsibleId) {
        console.error('[Check Accounts] Responsible no encontrado para', { nit });
        continue;
      }

      // Si tenemos responsibleId pero no el objeto completo, usar lo que tenemos
      const finalResponsibleId = responsibleId || responsible?.id;
      const finalResponsibleName = responsible?.name || propietario;

      if (!finalResponsibleId) {
        console.error('[Check Accounts] No se pudo determinar responsibleId para', { nit });
        continue;
      }

      // Verificar si tiene cuentas
      const ownerAccounts = accountsRef.current.filter(acc =>
        acc.documentoPropietario === nit && acc.status === 'activa'
      );

      if (ownerAccounts.length === 0) {
        needingAccounts.push({
          nit,
          propietario,
          saldo,
          responsibleId: finalResponsibleId,
          responsibleName: finalResponsibleName
        });
      }
    }

    if (needingAccounts.length > 0) {
      // Mostrar modal de crear cuentas
      console.log('[Check Accounts] Propietarios necesitan cuentas:', needingAccounts);
      setOwnersNeedingAccounts(needingAccounts);
      setShowCreateAccountsModal(true);
    } else {
      // Todos tienen cuentas, proceder a distribución
      await proceedToDistribution(rows);
    }
  };

  // PASO 2: Handler cuando se crean las cuentas
  const handleAccountsCreated = async (accounts: AccountCreation[]) => {
    setShowCreateAccountsModal(false);

    try {
      // Crear las cuentas bancarias y guardar los NITs
      const createdAccountNits = new Set<string>();
      
      for (const accountCreation of accounts) {
        const responsible = responsiblesRef.current.find(r => r.id === accountCreation.responsibleId);

        if (responsible) {
          const accountDocData: Omit<OwnerAccount, 'id'> = {
            propietario: responsible.name,
            documentoPropietario: normalizeDocumento(responsible.identificacion || accountCreation.nit),
            pagarA: accountCreation.accountData.pagarA,
            documentoBeneficiario: accountCreation.accountData.documentoBeneficiario,
            numeroCuenta: accountCreation.accountData.numeroCuenta,
            banco: accountCreation.accountData.banco,
            tipoCuenta: accountCreation.accountData.tipoCuenta,
            observaciones: accountCreation.accountData.observaciones || '',
            status: 'activa',
            responsibleId: responsible.id!,
            responsibleName: responsible.name,
            createdAt: new Date(),
            createdBy: auth.currentUser?.email || ''
          };

          await addDoc(collection(db, 'ownerAccounts'), accountDocData);
          createdAccountNits.add(normalizeDocumento(responsible.identificacion || accountCreation.nit));
          console.log('[Create Accounts] Cuenta creada', { 
            responsibleName: responsible.name, 
            banco: accountCreation.accountData.banco,
            nit: normalizeDocumento(responsible.identificacion || accountCreation.nit)
          });
        }
      }

      toast.success(`${accounts.length} cuenta(s) bancaria(s) creada(s)`);

      // Esperar más tiempo para que Firestore sincronice las cuentas
      console.log('[Create Accounts] Esperando sincronización de Firestore...');
      
      // Verificar periódicamente que las cuentas estén disponibles
      let attempts = 0;
      const maxAttempts = 10;
      const checkInterval = 500;

      const waitForAccounts = setInterval(() => {
        attempts++;
        
        // Verificar si todas las cuentas creadas están ahora en accountsRef
        const allAccountsAvailable = Array.from(createdAccountNits).every(nit => {
          const hasAccount = accountsRef.current.some(acc => 
            acc.documentoPropietario === nit && acc.status === 'activa'
          );
          return hasAccount;
        });

        if (allAccountsAvailable) {
          clearInterval(waitForAccounts);
          console.log('[Create Accounts] Cuentas sincronizadas, procediendo a distribución');
          proceedToDistribution(parsedRowsRef.current);
        } else if (attempts >= maxAttempts) {
          clearInterval(waitForAccounts);
          console.warn('[Create Accounts] Timeout esperando sincronización, procediendo de todas formas');
          proceedToDistribution(parsedRowsRef.current);
        } else {
          console.log(`[Create Accounts] Intento ${attempts}/${maxAttempts} - Esperando cuentas...`);
        }
      }, checkInterval);

    } catch (error) {
      console.error('Error creating accounts:', error);
      toast.error('Error al crear cuentas bancarias');
      setImporting(false);
    }
  };

  const proceedToDistribution = async (rows: ParsedBalanceRow[]) => {
    let imported = 0;
    const requiresDistribution: BalancePendingDistribution[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    try {
      console.group('[Import CSV] Inicio de distribución');
      console.log('Filas a procesar:', rows.length, rows);
      console.log('Cuentas disponibles en ref:', accountsRef.current.length);
      
      for (const row of rows) {
        const { propietario, nit, saldo } = row;

        // Buscar cuentas del propietario usando accountsRef.current (siempre actualizado)
        const ownerAccounts = accountsRef.current.filter(acc => 
          acc.documentoPropietario === nit && acc.status === 'activa'
        );

        console.log(`[Import CSV] Cuentas encontradas para ${propietario} (${nit}):`, ownerAccounts.length, ownerAccounts);

        if (ownerAccounts.length === 0) {
          console.warn('[Import CSV] Se omitió propietario sin cuentas durante distribución', { propietario, nit });
          errors.push({ row: 0, message: `Sin cuentas para ${propietario}` });
          continue;
        }

        if (ownerAccounts.length === 1) {
          // Una sola cuenta: asignar automáticamente
          const account = ownerAccounts[0];
          const balanceId = buildBalanceId(nit, selectedYear, selectedMonth);

          await setDoc(
            doc(db, 'ownerMonthlyBalances', balanceId),
            {
              documentoPropietario: nit,
              propietario,
              saldo, // Ya viene negativo desde el parseo
              mes: selectedMonth,
              anio: selectedYear,
              distribucion: [{
                ownerAccountId: account.id!,
                banco: account.banco,
                numeroCuenta: account.numeroCuenta,
                monto: saldo, // Mismo signo que el saldo (negativo)
                porcentaje: 100
              }],
              distribuidoManualmente: false,
              fechaImportacion: new Date(),
              importadoPor: auth.currentUser?.email || ''
            },
            { merge: true }
          );

          imported++;
          console.log('[Import CSV] Saldo asignado automáticamente', { propietario, nit, saldo, balanceId });
        } else {
          // Múltiples cuentas: requiere distribución manual
          console.log('[Import CSV] Propietario requiere distribución manual', { propietario, nit, saldo, cuentas: ownerAccounts.length });
          requiresDistribution.push({
            documentoPropietario: nit,
            propietario,
            saldo,
            cuentasDisponibles: ownerAccounts,
            mes: selectedMonth,
            anio: selectedYear
          });
        }
      }

      if (requiresDistribution.length > 0) {
        // Mostrar modal de distribución
        setPendingDistributions(requiresDistribution);
        setShowDistributeModal(true);
        console.log('[Import CSV] Distribución manual requerida para', requiresDistribution.length, 'propietario(s)');
      } else {
        toast.success(`Importación completada: ${imported} saldos`);
        setImporting(false);
      }

      if (errors.length > 0) {
        console.warn('[Import CSV] Errores durante distribución:', errors);
        toast.error(`${errors.length} propietario(s) sin cuentas bancarias`);
      }
      
      if (imported > 0) {
        console.log('[Import CSV] Saldos importados automáticamente:', imported);
      }

      console.groupEnd();
    } catch (error) {
      console.error('Error in distribution:', error);
      toast.error('Error durante la distribución');
      setImporting(false);
      console.groupEnd();
    }
  };

  const handleDistributionComplete = async (distributions: CompletedDistribution[]) => {
    try {
      for (const dist of distributions) {
        const balanceId = buildBalanceId(dist.documentoPropietario, dist.anio, dist.mes);

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
      setParsedRows([]);
    }
  };

  const handleDeleteBalance = async (balance: OwnerMonthlyBalance) => {
    if (!balance.id) return;

    // NUEVA VALIDACIÓN: Verificar distribuciones individuales
    if (!canDeleteBalance(balance)) {
      const status = getBalanceStatus(balance);
      toast.error(`No se puede eliminar. ${status.inBatchDistributions.length} distribución(es) están en lotes de pago.`);
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

  const handleBulkDelete = async () => {
    setShowDeleteConfirm(false);
    
    const balancesToDelete = filteredBalances.filter(b => b.id && selectedBalances.has(b.id));
    
    if (balancesToDelete.length === 0) {
      toast.error('No hay saldos seleccionados');
      return;
    }

    // NUEVA VALIDACIÓN: Verificar distribuciones individuales
    const withDistributionsInBatch = balancesToDelete.filter(b => !canDeleteBalance(b));
    if (withDistributionsInBatch.length > 0) {
      toast.error(`${withDistributionsInBatch.length} saldo(s) tienen distribuciones en lotes y no se pueden eliminar`);
      return;
    }

    try {
      for (const balance of balancesToDelete) {
        await deleteDoc(doc(db, 'ownerMonthlyBalances', balance.id!));
        
        // Log de auditoría
        await addDoc(collection(db, 'logs'), {
          usuarioEmail: auth.currentUser?.email,
          accion: 'eliminación masiva',
          entidad: 'owner_monthly_balance',
          detalles: `Eliminó saldo de ${balance.propietario} - ${formatCOPAmount(balance.saldo)} (${balance.mes}/${balance.anio})`,
          timestamp: new Date()
        });
      }

      toast.success(`${balancesToDelete.length} saldo(s) eliminado(s) correctamente`);
      setSelectedBalances(new Set());
    } catch (error) {
      console.error('Error deleting balances:', error);
      toast.error('Error al eliminar los saldos');
    }
  };

  const toggleSelectAll = () => {
    const allIds = paginatedBalances.flatMap(ownerData => 
      ownerData.balances.map(b => b.id).filter(Boolean) as string[]
    );
    
    if (selectedBalances.size === allIds.length && allIds.length > 0) {
      setSelectedBalances(new Set());
    } else {
      setSelectedBalances(new Set(allIds));
    }
  };

  const toggleSelectBalance = (balanceId: string) => {
    const newSelected = new Set(selectedBalances);
    if (newSelected.has(balanceId)) {
      newSelected.delete(balanceId);
    } else {
      newSelected.add(balanceId);
    }
    setSelectedBalances(newSelected);
  };

  const handleEditBalance = (balance: OwnerMonthlyBalance) => {
    // NUEVA VALIDACIÓN: Advertir si tiene distribuciones en lote
    if (!canEditBalance(balance)) {
      const status = getBalanceStatus(balance);
      toast.error(`No se puede editar. Todas las ${status.inBatchDistributions.length} distribuciones están en lotes de pago.`);
      return;
    }
    
    // Advertencia si tiene algunas en lote
    const status = getBalanceStatus(balance);
    if (status.someInBatch && !status.allInBatch) {
      toast(`⚠️ Advertencia: ${status.inBatchDistributions.length} distribución(es) están en lotes y no se podrán editar`, {
        duration: 4000,
        icon: '⚠️'
      });
    }
    
    // Preparar balance para distribución/edición
    const cuentasDisponibles = accounts.filter(acc => 
      acc.documentoPropietario === balance.documentoPropietario && 
      acc.status === 'activa'
    );

    if (cuentasDisponibles.length === 0) {
      toast.error('Este propietario no tiene cuentas bancarias activas');
      return;
    }

    const pendingDist: BalancePendingDistribution = {
      propietario: balance.propietario,
      documentoPropietario: balance.documentoPropietario,
      saldo: balance.saldo,
      cuentasDisponibles,
      mes: balance.mes,
      anio: balance.anio,
      distribucionExistente: balance.distribucion // Pasar distribución previa para edición
    };

    setEditingBalance(balance);
    setPendingDistributions([pendingDist]);
    setShowDistributeModal(true);
  };

  const handleEditDistributionComplete = async (distributions: CompletedDistribution[]) => {
    if (!editingBalance || distributions.length === 0) return;

    const distribution = distributions[0];

    try {
      const updatedBalance: Partial<OwnerMonthlyBalance> = {
        saldo: distribution.saldo,
        distribucion: distribution.distribucion,
        distribuidoManualmente: true
      };

      await setDoc(doc(db, 'ownerMonthlyBalances', editingBalance.id!), updatedBalance, { merge: true });

      // Log de auditoría
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'edición',
        entidad: 'owner_monthly_balance',
        detalles: `Editó y redistribuyó saldo de ${editingBalance.propietario} - ${formatCOPAmount(distribution.saldo)}`,
        timestamp: new Date()
      });

      toast.success('Saldo actualizado y redistribuido correctamente');
      setEditingBalance(null);
      setShowDistributeModal(false);
      setPendingDistributions([]);
    } catch (error) {
      console.error('Error updating balance:', error);
      toast.error('Error al actualizar el saldo');
    }
  };

  // Obtener lista única de bancos
  const uniqueBancos = useMemo(() => {
    const bancosSet = new Set<string>();
    balances.forEach(balance => {
      balance.distribucion?.forEach(dist => {
        bancosSet.add(dist.banco);
      });
    });
    return Array.from(bancosSet).sort();
  }, [balances]);

  // Filtrar saldos por mes/año seleccionado
  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      // Filtro por mes/año
      if (b.mes !== selectedMonth || b.anio !== selectedYear) return false;
      
      // Filtro por búsqueda (propietario, documento, beneficiario)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchPropietario = b.propietario.toLowerCase().includes(query);
        const matchDocumento = b.documentoPropietario.toLowerCase().includes(query);
        
        // Buscar en beneficiarios de las cuentas
        let matchBeneficiario = false;
        if (b.distribucion) {
          matchBeneficiario = b.distribucion.some(dist => {
            const account = accounts.find(acc => acc.id === dist.ownerAccountId);
            return account?.pagarA?.toLowerCase().includes(query) || 
                   account?.documentoBeneficiario?.toLowerCase().includes(query);
          });
        }
        
        if (!matchPropietario && !matchDocumento && !matchBeneficiario) return false;
      }
      
      // Filtro por banco
      if (filterBanco !== 'todos') {
        if (!b.distribucion) return false;
        const hasBanco = b.distribucion.some(dist => dist.banco === filterBanco);
        if (!hasBanco) return false;
      }
      
      // Filtro por tipo de distribución
      if (filterDistribucion !== 'todos') {
        const numCuentas = b.distribucion?.length || 0;
        if (filterDistribucion === 'unica' && numCuentas !== 1) return false;
        if (filterDistribucion === 'multiple' && numCuentas <= 1) return false;
      }
      
      return true;
    });
  }, [balances, selectedMonth, selectedYear, searchQuery, filterBanco, filterDistribucion, accounts]);

  // Calcular totales por propietario
  const balancesByOwner = useMemo(() => {
    return filteredBalances.reduce((acc, balance) => {
      if (!acc[balance.documentoPropietario]) {
        acc[balance.documentoPropietario] = {
          propietario: balance.propietario,
          documento: balance.documentoPropietario,
          saldoTotal: 0,
          balances: []
        };
      }
      acc[balance.documentoPropietario].saldoTotal += balance.saldo;
      acc[balance.documentoPropietario].balances.push(balance);
      return acc;
    }, {} as Record<string, { propietario: string; documento: string; saldoTotal: number; balances: OwnerMonthlyBalance[] }>);
  }, [filteredBalances]);

  // Convertir a array y ordenar alfabéticamente para paginación
  const balancesArray = Object.values(balancesByOwner)
    .sort((a, b) => a.propietario.localeCompare(b.propietario, 'es', { sensitivity: 'base' }));
  
  const totalPages = Math.ceil(balancesArray.length / itemsPerPage);
  const paginatedBalances = balancesArray.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return <div className="text-center py-8">Cargando saldos...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header - Todo en una línea */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Controles de fecha y acciones */}
          <div className="flex items-center gap-3">
            {/* Mes */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Mes</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Año */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Año</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg w-24 text-sm"
              />
            </div>

            {/* Separador vertical */}
            <div className="h-8 w-px bg-gray-300"></div>

            {/* Botones de acción */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              <Upload size={18} />
              {importing ? 'Importando...' : 'Importar Saldos'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportBalances}
              className="hidden"
            />

            <button
              onClick={() => setShowAddManualModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={18} />
              Agregar Manual
            </button>

            {selectedBalances.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                <Trash2 size={18} />
                Eliminar ({selectedBalances.size})
              </button>
            )}
          </div>

          {/* Contador de resultados */}
          <div className="flex flex-col items-end text-sm text-gray-600">
            <span className="font-medium">{Object.keys(balancesByOwner).length} propietarios • {filteredBalances.length} saldos</span>
            {selectedBalances.size > 0 && (
              <span className="text-blue-600 font-medium">{selectedBalances.size} seleccionado(s)</span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
        <div className="flex items-center gap-4">
          {/* Buscador */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por propietario, beneficiario o identificación..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtro por banco */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Banco:</label>
            <select
              value={filterBanco}
              onChange={(e) => setFilterBanco(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
            >
              <option value="todos">Todos los bancos</option>
              {uniqueBancos.map(banco => (
                <option key={banco} value={banco}>{banco}</option>
              ))}
            </select>
          </div>

          {/* Filtro por tipo de distribución */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Distribución:</label>
            <select
              value={filterDistribucion}
              onChange={(e) => setFilterDistribucion(e.target.value as 'todos' | 'unica' | 'multiple')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
            >
              <option value="todos">Todas</option>
              <option value="unica">Una cuenta</option>
              <option value="multiple">Múltiples cuentas</option>
            </select>
          </div>

          {/* Botón para limpiar filtros */}
          {(searchQuery || filterBanco !== 'todos' || filterDistribucion !== 'todos') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterBanco('todos');
                setFilterDistribucion('todos');
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title="Limpiar filtros"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla agrupada por propietario */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedBalances.size > 0 && selectedBalances.size === paginatedBalances.flatMap(o => o.balances.map(b => b.id).filter(Boolean)).length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Propietario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuentas/Distribución</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Total</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedBalances.map((ownerData) => {
              const balance = ownerData.balances[0]; // Tomamos el primer balance para info general
              
              return (
                <tr key={ownerData.documento} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={balance.id ? selectedBalances.has(balance.id) : false}
                      onChange={() => balance.id && toggleSelectBalance(balance.id)}
                      disabled={!canDeleteBalance(balance)}
                      className="w-4 h-4 text-blue-600 rounded disabled:opacity-30"
                      title={!canDeleteBalance(balance) ? 'Tiene distribuciones en lotes' : ''}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{ownerData.propietario}</div>
                    <div className="text-xs text-gray-500">{ownerData.documento}</div>
                  </td>
                  <td className="px-4 py-3">
                    {balance.distribucion && balance.distribucion.length > 0 ? (
                      <div className="space-y-2">
                        {balance.distribucion.map((dist, idx) => {
                          // Buscar la cuenta para obtener el nombre del beneficiario
                          const cuenta = accounts.find(a => a.id === dist.ownerAccountId);
                          
                          return (
                            <div key={idx} className="text-xs border-l-2 border-blue-300 pl-2">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-700">{dist.banco}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-500">•••{dist.numeroCuenta.slice(-4)}</span>
                              </div>
                              {cuenta && cuenta.pagarA && cuenta.pagarA !== ownerData.propietario && (
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  A nombre de: {cuenta.pagarA}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-bold text-green-600">
                                  {formatCOPAmount(Math.abs(dist.monto))}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 font-medium">{dist.porcentaje}%</span>
                                
                                {/* NUEVO: Badge de estado por distribución */}
                                {dist.batchId && (
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                                    dist.batchStatus === 'pagado' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {dist.batchStatus === 'pagado' ? '✓ Pagado' : '📦 En lote'}
                                  </span>
                                )}
                              </div>
                              
                              {/* NUEVO: Referencia del lote */}
                              {dist.batchRef && (
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  Lote: {dist.batchRef}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {balance.distribucion.length > 1 && (
                          <div className="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-2">
                            <span className="font-medium">{balance.distribucion.length} cuentas</span> utilizadas
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin distribución</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-green-600">
                      {formatCOPAmount(Math.abs(ownerData.saldoTotal))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {balance.distribucion ? (
                        <span className={`px-2 py-1 text-xs rounded ${
                          balance.distribuidoManualmente 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {balance.distribuidoManualmente ? 'Manual' : 'Auto'}
                        </span>
                      ) : null}
                      {/* NUEVO: Badge dinámico basado en distribuciones */}
                      {(() => {
                        const status = getBalanceStatus(balance);
                        if (status.allPaid) {
                          return (
                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                              ✓ Pagado
                            </span>
                          );
                        }
                        if (status.someInBatch) {
                          return (
                            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
                              {status.inBatchDistributions.length}/{balance.distribucion?.length} en lote
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditBalance(balance)}
                        disabled={!canEditBalance(balance)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!canEditBalance(balance) ? 'Todas las distribuciones están en lotes' : 'Editar saldo'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBalance(balance)}
                        disabled={!canDeleteBalance(balance)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!canDeleteBalance(balance) ? 'Tiene distribuciones en lotes' : 'Eliminar saldo'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {Object.keys(balancesByOwner).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay saldos para {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modales */}
      <IdentifyOwnerModal
        isOpen={showIdentifyOwnersModal}
        onClose={() => {
          setShowIdentifyOwnersModal(false);
          setUnidentifiedOwners([]);
          setImporting(false);
        }}
        unidentifiedOwners={unidentifiedOwners}
        onIdentified={handleOwnersIdentified}
      />

      <CreateAccountsModal
        isOpen={showCreateAccountsModal}
        onClose={() => {
          setShowCreateAccountsModal(false);
          setOwnersNeedingAccounts([]);
          setImporting(false);
        }}
        ownersNeedingAccounts={ownersNeedingAccounts}
        onAccountsCreated={handleAccountsCreated}
      />

      <DistributeBalanceModal
        isOpen={showDistributeModal}
        onClose={() => {
          setShowDistributeModal(false);
          setPendingDistributions([]);
          setEditingBalance(null);
        }}
        pendingDistributions={pendingDistributions}
        onComplete={editingBalance ? handleEditDistributionComplete : handleDistributionComplete}
      />

      <AddBalanceManualModal
        isOpen={showAddManualModal}
        onClose={() => setShowAddManualModal(false)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onProceedToDistribution={(distribution) => {
          setPendingDistributions([distribution]);
          setShowDistributeModal(true);
          setShowAddManualModal(false);
        }}
      />

      {/* Modal de confirmación de eliminación masiva */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trash2 className="text-red-600" size={24} />
              Confirmar eliminación
            </h3>
            <p className="text-gray-700 mb-6">
              ¿Estás seguro de eliminar <strong>{selectedBalances.size}</strong> saldo(s) seleccionado(s)?
              <br /><br />
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
