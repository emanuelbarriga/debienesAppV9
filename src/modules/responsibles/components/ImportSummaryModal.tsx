import React, { useState, useMemo, useEffect } from 'react';
import { Responsible } from '../../../types';
import { X, Plus, RefreshCw, Filter, Trash2, ChevronDown } from 'lucide-react';

interface ImportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<Partial<Responsible> & { status: 'new' | 'duplicate' | 'update'; existingId?: string }>;
  onStartImport: () => void;
  onCancel: () => void;
  onCustomImport?: (items: Array<Partial<Responsible> & { status: 'new' | 'duplicate' | 'update'; existingId?: string; action?: 'create' | 'update' | 'ignore' }>) => void;
}

const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({
  isOpen,
  onClose,
  items,
  onStartImport,
  onCancel,
  onCustomImport
}) => {
  if (!isOpen) return null;

  // Estado para los elementos seleccionados
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  // Estado para las acciones asignadas a cada elemento
  const [itemActions, setItemActions] = useState<Record<string, 'create' | 'update' | 'ignore'>>({});
  // Estado para el filtro activo
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'update' | 'duplicate'>('all');
  // Estado para el término de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  // Estado para mostrar/ocultar el menú de filtros
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Inicializar acciones predeterminadas basadas en el estado
  useEffect(() => {
    const initialActions: Record<string, 'create' | 'update' | 'ignore'> = {};
    items.forEach((item, index) => {
      if (item.status === 'new') {
        initialActions[`${index}`] = 'create';
      } else if (item.status === 'update') {
        initialActions[`${index}`] = 'update';
      } else {
        initialActions[`${index}`] = 'ignore';
      }
    });
    setItemActions(initialActions);
  }, [items]);

  // Filtrar elementos según el filtro activo y el término de búsqueda
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Aplicar filtro de estado
      if (activeFilter !== 'all' && item.status !== activeFilter) {
        return false;
      }
      
      // Aplicar filtro de búsqueda
      if (searchTerm && !item.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [items, activeFilter, searchTerm]);

  // Verificar si todos los elementos están seleccionados
  const allSelected = useMemo(() => {
    return filteredItems.length > 0 && filteredItems.every((_, index) => selectedItems[`${index}`]);
  }, [filteredItems, selectedItems]);

  // Función para seleccionar/deseleccionar todos los elementos
  const toggleSelectAll = () => {
    if (allSelected) {
      // Deseleccionar todos
      setSelectedItems({});
    } else {
      // Seleccionar todos los filtrados
      const newSelected: Record<string, boolean> = {};
      filteredItems.forEach((_, index) => {
        newSelected[`${index}`] = true;
      });
      setSelectedItems(newSelected);
    }
  };

  // Función para seleccionar/deseleccionar un elemento
  const toggleSelectItem = (index: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [`${index}`]: !prev[`${index}`]
    }));
  };

  // Función para cambiar la acción de un elemento
  const setItemAction = (index: number, action: 'create' | 'update' | 'ignore') => {
    setItemActions(prev => ({
      ...prev,
      [`${index}`]: action
    }));
  };

  // Función para aplicar una acción a todos los elementos seleccionados
  const applyActionToSelected = (action: 'create' | 'update' | 'ignore') => {
    const newActions = { ...itemActions };
    Object.keys(selectedItems).forEach(indexStr => {
      if (selectedItems[indexStr]) {
        newActions[indexStr] = action;
      }
    });
    setItemActions(newActions);
  };

  // Función para iniciar la importación personalizada
  const handleCustomImport = () => {
    if (onCustomImport) {
      const itemsWithActions = items.map((item, index) => ({
        ...item,
        action: itemActions[`${index}`]
      }));
      onCustomImport(itemsWithActions);
    } else {
      // Si no se proporciona la función onCustomImport, usar la función estándar
      onStartImport();
    }
  };

  // Contar elementos por tipo de acción
  const actionCounts = useMemo(() => {
    const counts = { create: 0, update: 0, ignore: 0 };
    Object.values(itemActions).forEach(action => {
      counts[action]++;
    });
    return counts;
  }, [itemActions]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Resumen de Importación</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className={`p-2 rounded ${allSelected ? 'bg-blue-100' : 'bg-gray-100'}`}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="mr-2"
                />
                {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="p-2 bg-gray-100 rounded flex items-center gap-1"
                >
                  <Filter size={16} />
                  Filtrar
                  <ChevronDown size={16} />
                </button>
                {showFilterMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-10">
                    <button
                      onClick={() => { setActiveFilter('all'); setShowFilterMenu(false); }}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'all' ? 'bg-blue-100' : ''}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => { setActiveFilter('new'); setShowFilterMenu(false); }}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'new' ? 'bg-blue-100' : ''}`}
                    >
                      Nuevos
                    </button>
                    <button
                      onClick={() => { setActiveFilter('update'); setShowFilterMenu(false); }}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'update' ? 'bg-blue-100' : ''}`}
                    >
                      Actualizaciones
                    </button>
                    <button
                      onClick={() => { setActiveFilter('duplicate'); setShowFilterMenu(false); }}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${activeFilter === 'duplicate' ? 'bg-blue-100' : ''}`}
                    >
                      Duplicados
                    </button>
                  </div>
                )}
              </div>
              
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="p-2 border rounded"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => applyActionToSelected('create')}
                className="p-2 bg-green-100 text-green-700 rounded flex items-center gap-1"
                disabled={Object.keys(selectedItems).length === 0}
              >
                <Plus size={16} />
                Crear nuevos
              </button>
              <button
                onClick={() => applyActionToSelected('update')}
                className="p-2 bg-blue-100 text-blue-700 rounded flex items-center gap-1"
                disabled={Object.keys(selectedItems).length === 0}
              >
                <RefreshCw size={16} />
                Actualizar existentes
              </button>
              <button
                onClick={() => applyActionToSelected('ignore')}
                className="p-2 bg-gray-100 text-gray-700 rounded flex items-center gap-1"
                disabled={Object.keys(selectedItems).length === 0}
              >
                <Trash2 size={16} />
                Ignorar
              </button>
            </div>
          </div>
          
          <div className="flex gap-4 text-sm text-gray-600">
            <div>Total: {items.length} registros</div>
            <div>A crear: {actionCounts.create}</div>
            <div>A actualizar: {actionCounts.update}</div>
            <div>A ignorar: {actionCounts.ignore}</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seleccionar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Identificación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item, index) => (
                <tr key={index} className={selectedItems[`${index}`] ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={!!selectedItems[`${index}`]}
                      onChange={() => toggleSelectItem(index)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.status === 'new'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'update'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {item.status === 'new'
                        ? 'Nuevo'
                        : item.status === 'update'
                        ? 'Actualización'
                        : 'Duplicado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.identificacion}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={itemActions[`${index}`] || 'ignore'}
                      onChange={(e) => setItemAction(index, e.target.value as 'create' | 'update' | 'ignore')}
                      className="p-1 border rounded"
                    >
                      <option value="create">Crear nuevo</option>
                      <option value="update">Actualizar existente</option>
                      <option value="ignore">Ignorar</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleCustomImport}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Importar ({actionCounts.create + actionCounts.update})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportSummaryModal;
