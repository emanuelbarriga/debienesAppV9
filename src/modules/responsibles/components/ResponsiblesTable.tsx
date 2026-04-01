import React from 'react';
import { Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SimpleTypeTag } from '../../../components/shared/SimpleTypeTag';
import { Responsible, ResponsibleType } from '../../../types';
import { Timestamp } from 'firebase/firestore';
import { parseISO, isValid, format } from 'date-fns';
import { es } from 'date-fns/locale';

// Función para manejar correctamente fechas que pueden ser string, Date o Timestamp
const parseDate = (fecha: any): Date | null => {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (fecha instanceof Timestamp) return fecha.toDate();
  if (typeof fecha === 'string') {
    // Primero intentar parsearlo como fecha ISO
    const parsed = parseISO(fecha);
    if (isValid(parsed)) return parsed;
    
    // Si falla, intentar con formato dd/mm/yyyy
    if (fecha.includes('/')) {
      const [day, month, year] = fecha.split('/');
      if (day && month && year) {
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (isValid(dateObj)) return dateObj;
      }
    }
  }
  return null;
};

// Función para formatear fechas
const formatDateForDisplay = (dateVal: string | Date | Timestamp | undefined | null): string => {
  if (!dateVal) return '-';
  try {
    // Use the global parseDate function to handle all date types including Timestamp
    const parsedDate = parseDate(dateVal);
    if (!parsedDate) return '-';
    
    // Use the format function with a proper Date object
    return format(parsedDate, 'dd/MM/yyyy', { locale: es });
  } catch (error) {
    console.error('Error formatting date:', dateVal, error);
    return '-';
  }
};

// Función para verificar si un contrato está vencido
const isContractExpired = (responsible: Responsible): boolean => {
  if (!responsible.f_final_contrato) return false;
  // @ts-ignore - parseDate can handle Timestamp but TypeScript doesn't recognize this
  const endDate = parseDate(responsible.f_final_contrato);
  if (!endDate) return false;
  return endDate < new Date();
};

// Función para verificar si un contrato está próximo a vencer (30 días)
const isContractExpiring = (responsible: Responsible): boolean => {
  if (!responsible.f_final_contrato) return false;
  // @ts-ignore - parseDate can handle Timestamp but TypeScript doesn't recognize this
  const endDate = parseDate(responsible.f_final_contrato);
  if (!endDate) return false;
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  return endDate > today && endDate <= thirtyDaysFromNow;
};

interface PaginationSettings {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
}

interface ResponsiblesTableProps {
  responsibles: Responsible[];
  onEdit: (responsible: Responsible) => void;
  onDelete: (id: string) => void;
  paginationProps: PaginationSettings;
  filterType: ResponsibleType | 'all';
  filterContract: 'all' | 'expired' | 'expiring';
}

const ResponsiblesTable: React.FC<ResponsiblesTableProps> = ({
  responsibles,
  onEdit,
  onDelete,
  paginationProps,
  filterType,
  filterContract
}) => {
  return (
    <div className="mt-4">
      <div className="shadow-sm border rounded-lg overflow-hidden">
        {responsibles && responsibles.length > 0 ? (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                  <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración del Contrato</th>
                  <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {responsibles.map((responsible, index) => {
                  return (
                    <tr key={responsible.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {responsible.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {responsible.identificacion}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {responsible.email || '-'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {responsible.phones ? responsible.phones.join(', ') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <SimpleTypeTag type={responsible.type} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {responsible.valor 
                          ? `$${responsible.valor.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {responsible.empresa || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className="text-gray-500">Inicio:</span>{' '}
                          {responsible?.f_inicial_contrato ? formatDateForDisplay(responsible.f_inicial_contrato) : '-'}
                        </div>
                        <div className={`text-sm ${isContractExpired(responsible) ? 'text-red-600 font-medium' : isContractExpiring(responsible) ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                          <span className="text-gray-500">Final:</span>{' '}
                          {responsible?.f_final_contrato ? formatDateForDisplay(responsible.f_final_contrato) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-4 justify-center">
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => responsible.id && onEdit(responsible)}
                            title="Editar"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => responsible.id ? onDelete(responsible.id) : undefined}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center">
                <span className="mr-2 text-xs text-gray-500">Mostrar</span>
                <select 
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  value={paginationProps.itemsPerPage}
                  onChange={(e) => paginationProps.onItemsPerPageChange(Number(e.target.value))}
                >
                  <option>10</option>
                  <option>20</option>
                  <option>50</option>
                  <option>100</option>
                </select>
                <span className="ml-2 text-xs text-gray-500">por página</span>
              </div>
              
              <div className="text-xs text-gray-600">
                Mostrando {paginationProps.totalItems > 0 ? (paginationProps.currentPage - 1) * paginationProps.itemsPerPage + 1 : 0} a {Math.min(paginationProps.currentPage * paginationProps.itemsPerPage, paginationProps.totalItems)} de {paginationProps.totalItems} resultados
              </div>
              
              <div className="flex space-x-1">
                <button className="p-2 border border-gray-300 rounded text-xs hover:bg-gray-50">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button className="px-3 py-2 border border-gray-300 rounded text-xs bg-blue-600 text-white">1</button>
                {Array.from({ length: Math.min(5, paginationProps.totalPages) }, (_, i) => i + 1).map(page => (
                  page === paginationProps.currentPage ? null : (
                    <button 
                      key={page} 
                      onClick={() => paginationProps.onPageChange(page)}
                      className="px-3 py-2 border border-gray-300 rounded text-xs hover:bg-gray-50"
                    >
                      {page}
                    </button>
                  )
                )).filter(Boolean)}
                <button className="p-2 border border-gray-300 rounded text-xs hover:bg-gray-50">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {filterType !== 'all' || filterContract !== 'all' ? (
              <p>No hay responsables que coincidan con los filtros seleccionados.</p>
            ) : (
              <p>No hay responsables registrados. Agrega uno nuevo usando el botón "Nuevo Responsable".</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponsiblesTable;
