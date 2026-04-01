// pages/Responsibles.tsx (Completo y Corregido)

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestoreOptimized } from '../hooks/useFirestoreOptimized';
import { Responsible, ResponsibleType } from '../types';
import { Timestamp } from 'firebase/firestore';
import { parseISO, isValid, format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

// Componentes y Hooks importados
import { FirestoreMetrics } from '../components/shared/FirestoreMetrics';
import { usePagination } from '../hooks/usePagination';
import DuplicateResolverModal from '../modules/responsibles/components/DuplicateResolverModal';
import ImportSummaryModal from '../modules/responsibles/components/ImportSummaryModal';
import ResponsibleForm from '../modules/responsibles/components/ResponsibleForm';
import ResponsiblesTable from '../modules/responsibles/components/ResponsiblesTable'; // Corregí el nombre para que coincida

// Iconos
import {
  Search,
  UserPlus,
  Users,
  Home,
  Building2,
  CircleDot,
  Clock,
  AlertCircle,
  CheckCircle2,
  Upload,
  TestTube
} from 'lucide-react';

// --- FUNCIONES DE AYUDA GLOBALES ---

const parseDate = (fecha: any): Date | null => {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (fecha instanceof Timestamp) return fecha.toDate();
  if (typeof fecha === 'string') {
    let parsed = parseISO(fecha);
    if (isValid(parsed)) return parsed;
    if (fecha.includes('/')) {
      const [day, month, year] = fecha.split('/').map(Number);
      parsed = new Date(year, month - 1, day);
      if (isValid(parsed)) return parsed;
    }
  }
  return null;
};

// --- TIPOS Y DATOS INICIALES ---

type ResponsibleFormData = Omit<Responsible, 'id' | 'createdAt' | 'updatedAt'> & {
  f_inicial_contrato?: Date | null;
  f_final_contrato?: Date | null;
  phones: string[];
  identificacion: string;
};

const initialFormData: ResponsibleFormData = {
  name: '',
  type: 'tenant',
  identificacion: '',
  email: '',
  phones: [],
  direccion: '',
  valor: 0,
  empresa: '',
  f_inicial_contrato: undefined,
  f_final_contrato: undefined
};

// --- COMPONENTE PRINCIPAL ---

export default function Responsibles() {
  // --- ESTADO Y HOOKS DE DATOS ---
  const {
    data: responsibles,
    loading,
    metrics,
    updateItem,
    deleteItem,
    addItem
  } = useFirestoreOptimized<Responsible>('responsibles', {
    expireTime: 5,
    localStorageKey: 'responsiblesCache',
  });

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ResponsibleType | 'all'>('all');
  const [filterContract, setFilterContract] = useState<'all' | 'expired' | 'expiring'>('all');
  const [formInitialData, setFormInitialData] = useState<ResponsibleFormData>(initialFormData);

  // Estados para importación
  const [importData, setImportData] = useState<Partial<Responsible>[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState<number>(-1);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [duplicateData, setDuplicateData] = useState<{ existing: Responsible | null; new: Partial<Responsible> | null; }>({ existing: null, new: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [testData, setTestData] = useState<Partial<Responsible> | null>(null);
  const [showImportSummary, setShowImportSummary] = useState<boolean>(false);
  const [importSummaryItems, setImportSummaryItems] = useState<Array<Partial<Responsible> & { status: 'new' | 'duplicate' | 'update'; existingId?: string }>>([]);

  // --- LÓGICA DE NEGOCIO Y FILTRADO ---

  const isContractExpired = (responsible: Responsible): boolean => {
    if (!responsible.f_final_contrato) return false;
    const endDate = parseDate(responsible.f_final_contrato);
    return endDate ? endDate < new Date() : false;
  };

  const isContractExpiring = (responsible: Responsible): boolean => {
    if (!responsible.f_final_contrato) return false;
    const endDate = parseDate(responsible.f_final_contrato);
    if (!endDate) return false;
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    return endDate > today && endDate <= thirtyDaysFromNow;
  };

  // Función para encontrar duplicados
  const findDuplicateResponsible = (data: Partial<Responsible>): Responsible | null => {
    if (!responsibles) return null;
    return responsibles.find(r =>
      r.name.toLowerCase() === data.name?.toLowerCase() ||
      (data.identificacion && r.identificacion === data.identificacion)
    ) || null;
  };

  const filteredResponsibles = useMemo(() => {
    if (!responsibles) return [];
    let data = [...responsibles];
    if (testMode && testData) {
      data = [testData as Responsible, ...data];
    }
    return data.filter((responsible) => {
      const searchTerm = search.toLowerCase();
      const matchesSearch =
        responsible.name?.toLowerCase().includes(searchTerm) ||
        responsible.identificacion?.toLowerCase().includes(searchTerm) ||
        (responsible.phones && responsible.phones.some(phone => phone.toLowerCase().includes(searchTerm))) ||
        responsible.email?.toLowerCase().includes(searchTerm) ||
        responsible.empresa?.toLowerCase().includes(searchTerm);
      const matchesType = filterType === 'all' || responsible.type === filterType;
      let matchesContract = true;
      if (filterContract === 'expired') matchesContract = isContractExpired(responsible);
      else if (filterContract === 'expiring') matchesContract = isContractExpiring(responsible);
      return matchesSearch && matchesType && matchesContract;
    });
  }, [responsibles, search, filterType, filterContract, testMode, testData]);

  // CORRECCIÓN: Extraer todas las propiedades necesarias del hook de paginación
  const paginationResult = usePagination(filteredResponsibles, {
    itemsPerPage: 10,
    maxPages: 5
  });
  
  // Adaptar las propiedades de paginación al formato esperado por ResponsiblesTable
  const paginationProps = {
    currentPage: paginationResult.currentPage,
    totalPages: paginationResult.totalPages,
    totalItems: filteredResponsibles.length,
    itemsPerPage: paginationResult.itemsPerPage,
    onPageChange: paginationResult.setCurrentPage,
    onItemsPerPageChange: paginationResult.setItemsPerPage
  };

  // --- MANEJADORES DE EVENTOS (CRUD) ---

  const handleOpenForm = (responsible?: Responsible) => {
    if (responsible) {
      setEditingId(responsible.id || null);
      setFormInitialData({
        ...responsible,
        f_inicial_contrato: parseDate(responsible.f_inicial_contrato) || undefined,
        f_final_contrato: parseDate(responsible.f_final_contrato) || undefined,
        phones: responsible.phones || [],
        identificacion: responsible.identificacion || '',
      });
    } else {
      setEditingId(null);
      setFormInitialData(initialFormData);
    }
    setShowForm(true);
  };
  
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (formData: ResponsibleFormData) => {
    try {
      const dataToSave = {
        ...formData,
        f_inicial_contrato: formData.f_inicial_contrato ? format(formData.f_inicial_contrato, 'dd/MM/yyyy', { locale: es }) : '',
        f_final_contrato: formData.f_final_contrato ? format(formData.f_final_contrato, 'dd/MM/yyyy', { locale: es }) : '',
        updatedAt: new Date(),
      };
      if (editingId) {
        await updateItem(editingId, dataToSave);
        toast.success('Responsable actualizado');
      } else {
        await addItem({ ...dataToSave, createdAt: new Date() });
        toast.success('Responsable agregado');
      }
      handleCloseForm();
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error al guardar los datos.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar?')) {
      try {
        await deleteItem(id);
        toast.success('Responsable eliminado');
      } catch (error) {
        console.error('Error al eliminar:', error);
        toast.error('Error al eliminar.');
      }
    }
  };

  // --- LÓGICA DE IMPORTACIÓN ---
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data.map((row: any) => ({
          name: row.name || row.nombre || '',
          type: row.type || row.tipo || 'tenant',
          identificacion: row.identificacion || row.id || '',
          email: row.email || row.correo || '',
          phones: row.phones?.split(',') || row.telefonos?.split(',') || [],
          direccion: row.direccion || row.address || '',
          valor: parseFloat(row.valor || row.value || '0') || 0,
          empresa: row.empresa || row.company || '',
          f_inicial_contrato: row.f_inicial_contrato || row.start_date || '',
          f_final_contrato: row.f_final_contrato || row.end_date || ''
        }));
        setImportData(parsedData);
        toast.success(`${parsedData.length} registros cargados para importar`);
        prepareImportSummary(parsedData as Partial<Responsible>[]);
      },
      error: (error) => {
        console.error('Error al parsear CSV:', error);
        toast.error('Error al procesar el archivo CSV');
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  // Función para procesar un item de importación
  const processImportItem = async (item: Partial<Responsible> & { _existingId?: string; _forceCreate?: boolean }) => {
    try {
      if (!item.name) return true;

      // Si tiene ID existente (desde el resumen), actualizar
      if (item._existingId && !item._forceCreate) {
        await updateItem(item._existingId, {
          ...item,
          updatedAt: new Date()
        });
        toast.success(`Actualizado: ${item.name}`);
        return true;
      }

      // Buscar duplicado si no se fuerza creación
      const duplicate = !item._forceCreate ? findDuplicateResponsible(item) : null;

      if (!duplicate || item._forceCreate) {
        await addItem({
          ...item,
          name: item.name,
          type: item.type || 'tenant',
          createdAt: new Date(),
          updatedAt: new Date()
        } as Responsible);
        toast.success(`Creado: ${item.name}`);
        return true;
      }

      // Hay conflicto, mostrar modal
      setDuplicateData({ existing: duplicate, new: item });
      setShowDuplicateModal(true);
      return false;
    } catch (error) {
      console.error('Error al procesar item:', error);
      toast.error(`Error con ${item.name}`);
      return true;
    }
  };

  const processNextImport = async () => { 
    if (currentImportIndex >= 0 && currentImportIndex < importData.length) {
      const currentItem = importData[currentImportIndex];
      const success = await processImportItem(currentItem);
      if (success) {
        setCurrentImportIndex(prev => prev + 1);
      }
    } else {
      setImportData([]);
      setCurrentImportIndex(-1);
      toast.success('Importación finalizada');
    }
  };
  
  const handleResolveConflict = (action: 'keep' | 'update' | 'create', updateData?: Partial<Responsible>) => { 
    if (currentImportIndex >= 0 && currentImportIndex < importData.length) {
      const currentItem = importData[currentImportIndex];
      
      const proceed = async () => {
        try {
          if (action === 'update' && duplicateData.existing?.id) {
            await updateItem(duplicateData.existing.id, { ...updateData, updatedAt: new Date() });
            toast.success('Registro actualizado');
          } else if (action === 'create') {
            await addItem({ ...currentItem, createdAt: new Date(), updatedAt: new Date() } as Responsible);
            toast.success('Nuevo registro creado');
          }
          setShowDuplicateModal(false);
          setCurrentImportIndex(prev => prev + 1);
        } catch (error) {
          console.error('Error resolving conflict:', error);
          toast.error('Error al resolver conflicto');
        }
      };
      
      proceed();
    }
  };
  
  const handleTestConflictResolution = (testData: Partial<Responsible>) => { 
    setTestData(testData); 
    setTestMode(true); 
    toast.success('Modo prueba activado.'); 
  };
  
  const handleTestDuplicateResolution = () => { 
    if (!responsibles || responsibles.length === 0) {
      toast.error('No hay responsables para simular un duplicado');
      return;
    }

    const seed = responsibles[0];
    const testResponsible: Partial<Responsible> = {
      ...seed,
      id: undefined, // Forzar como nuevo
      name: `${seed.name} (TEST)`,
      email: 'test@example.com',
      phones: ['555-1234'],
      updatedAt: new Date(),
      createdAt: new Date()
    };

    const duplicate = findDuplicateResponsible(testResponsible);
    if (duplicate) {
      setDuplicateData({ existing: duplicate, new: testResponsible });
      setShowDuplicateModal(true);
      setTestMode(true);
      toast.success('Prueba de duplicado iniciada');
    } else {
      toast('No se encontró duplicado para probar');
    }
  };
  
  const prepareImportSummary = (data: Partial<Responsible>[]) => { 
    if (!responsibles) return;

    const summaryItems = data.map(item => {
      const duplicate = findDuplicateResponsible(item);
      
      if (!duplicate) {
        return { ...item, status: 'new' as const };
      } else {
        const needsUpdate = 
          (item.valor !== undefined && item.valor !== duplicate.valor) ||
          (item.f_inicial_contrato !== undefined && item.f_inicial_contrato !== duplicate.f_inicial_contrato) ||
          (item.f_final_contrato !== undefined && item.f_final_contrato !== duplicate.f_final_contrato);
        
        return {
          ...item,
          status: needsUpdate ? 'update' as const : 'duplicate' as const,
          existingId: duplicate.id
        };
      }
    });

    setImportSummaryItems(summaryItems);
    setShowImportSummary(true);
  };
  
  const handleStartImport = () => { 
    setShowImportSummary(false);
    if (importData.length > 0) {
      setCurrentImportIndex(0);
    }
  };
  
  const handleCustomImport = (customItems: Array<Partial<Responsible> & { status: 'new' | 'duplicate' | 'update'; existingId?: string; action?: 'create' | 'update' | 'ignore' }>) => { 
    const itemsToProcess = customItems.filter(item => item.action !== 'ignore');
    
    if (itemsToProcess.length === 0) {
      setShowImportSummary(false);
      setImportData([]);
      return;
    }

    const newImportData = itemsToProcess.map(item => ({
      ...item,
      _existingId: item.action === 'update' ? item.existingId : undefined,
      _forceCreate: item.action === 'create'
    }));

    setImportData(newImportData);
    setShowImportSummary(false);
    setCurrentImportIndex(0);
  };
  
  useEffect(() => {
    if (currentImportIndex >= 0 && !showDuplicateModal) {
      processNextImport();
    }
  }, [currentImportIndex, showDuplicateModal]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col w-full gap-4">
        {/* Encabezado y métricas */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Responsables</h1>
            <FirestoreMetrics {...metrics} />
          </div>
          <div className="flex space-x-2">
            {testMode && <button onClick={() => { setTestMode(false); setTestData(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white hover:bg-yellow-600 rounded-lg text-sm font-medium"><AlertCircle className="w-4 h-4" />Salir prueba</button>}
            <button onClick={() => handleOpenForm()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium"><UserPlus className="w-4 h-4" />Nuevo</button>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="file-import" />
            <label htmlFor="file-import" className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium cursor-pointer"><Upload className="w-4 h-4" />Importar</label>
            <button onClick={handleTestDuplicateResolution} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium"><TestTube className="w-4 h-4" />Probar</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="relative flex-grow sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
              <button onClick={() => setFilterType('all')} className={`px-3 py-2 ${filterType === 'all' ? 'bg-gray-200' : 'hover:bg-gray-200'}`} title="Todos los responsables"><Users className="w-4 h-4" /></button>
              <button onClick={() => setFilterType('tenant')} className={`px-3 py-2 ${filterType === 'tenant' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`} title="Arrendatarios"><Home className="w-4 h-4" /></button>
              <button onClick={() => setFilterType('owner')} className={`px-3 py-2 ${filterType === 'owner' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-200'}`} title="Propietarios"><Building2 className="w-4 h-4" /></button>
              <button onClick={() => setFilterType('admin')} className={`px-3 py-2 ${filterType === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-gray-200'}`} title="Administradores"><CircleDot className="w-4 h-4" /></button>
              <button onClick={() => setFilterType('third-party')} className={`px-3 py-2 ${filterType === 'third-party' ? 'bg-violet-100 text-violet-700' : 'hover:bg-gray-200'}`} title="Terceros"><CircleDot className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
              <button onClick={() => setFilterContract('all')} className={`px-3 py-2 ${filterContract === 'all' ? 'bg-gray-200' : 'hover:bg-gray-200'}`}><CheckCircle2 className="w-4 h-4" /></button>
              <button onClick={() => setFilterContract('expired')} className={`px-3 py-2 ${filterContract === 'expired' ? 'bg-red-100 text-red-700' : 'hover:bg-gray-200'}`}><AlertCircle className="w-4 h-4" /></button>
              <button onClick={() => setFilterContract('expiring')} className={`px-3 py-2 ${filterContract === 'expiring' ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-gray-200'}`}><Clock className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        
        {/* Renderizado de la tabla a través del componente */}
        <ResponsiblesTable
            responsibles={paginationResult.pageItems}
            onEdit={handleOpenForm}
            onDelete={handleDelete}
            paginationProps={paginationProps}
            filterType={filterType}
            filterContract={filterContract}
        />
        
        {/* Renderizado del formulario a través del componente */}
        <ResponsibleForm
            isOpen={showForm}
            onClose={handleCloseForm}
            onSubmit={handleSubmit}
            initialData={formInitialData}
            isEditing={!!editingId}
        />

        {/* Modales de importación */}
        {showDuplicateModal && <DuplicateResolverModal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} existing={duplicateData.existing} new={duplicateData.new} onResolve={handleResolveConflict} onTest={handleTestConflictResolution} />}
        {showImportSummary && <ImportSummaryModal isOpen={showImportSummary} onClose={() => setShowImportSummary(false)} items={importSummaryItems} onStartImport={handleStartImport} onCancel={() => { setShowImportSummary(false); setImportData([]); setCurrentImportIndex(-1); }} onCustomImport={handleCustomImport} />}
      </div>
    </div>
  );
}