import React, { useState } from 'react';
import { Responsible } from '../../../types';
import { X, Check, AlertCircle, TestTube } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';

interface DuplicateResolverModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  existing: Responsible | null;
  new: Partial<Responsible> | null;
  onResolve: (action: 'keep' | 'update' | 'create', data?: Partial<Responsible>) => void;
  onTest?: (data: Partial<Responsible>) => void;
}

const DuplicateResolverModal: React.FC<DuplicateResolverModalProps> = ({
  isOpen,
  onClose,
  existing,
  new: newResponsible,
  onResolve,
  onTest
}) => {
  const [resolution, setResolution] = useState<'keep' | 'update' | 'create'>('keep');
  const [updateValue, setUpdateValue] = useState(true);
  const [updateDates, setUpdateDates] = useState(true);

  const formatDateSafely = (date: string | Date | Timestamp | undefined, formatString?: string): string => {
    if (!date) return 'N/A';
    
    if (date instanceof Timestamp) {
      return formatDateSafely(date.toDate(), formatString);
    } else if (date instanceof Date) {
      try {
        if (isValid(date)) {
          return format(date, formatString || 'dd/MM/yyyy', { locale: es });
        }
        return 'Fecha inválida';
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
      }
    } else if (typeof date === 'string') {
      try {
        const parsedDate = new Date(date);
        if (isValid(parsedDate)) {
          return format(parsedDate, formatString || 'dd/MM/yyyy', { locale: es });
        } else {
          return 'Fecha inválida';
        }
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
      }
    } else {
      return 'N/A';
    }
  };

  if (!isOpen || !existing || !newResponsible) return null;

  const handleResolve = () => {
    if (resolution === 'update') {
      // Solo actualizar los campos seleccionados
      const updatedData: Partial<Responsible> = {
        updatedAt: new Date(),
      };
      
      if (updateValue && newResponsible.valor !== undefined) {
        updatedData.valor = newResponsible.valor;
      }
      
      if (updateDates) {
        if (newResponsible.f_inicial_contrato) {
          updatedData.f_inicial_contrato = newResponsible.f_inicial_contrato;
        }
        if (newResponsible.f_final_contrato) {
          updatedData.f_final_contrato = newResponsible.f_final_contrato;
        }
      }
      
      onResolve('update', updatedData);
    } else {
      onResolve(resolution);
    }
    
    onClose?.();
  };

  const handleTest = () => {
    if (!onTest || !existing) return;
    
    try {
      // Crear una copia de los datos para la prueba
      const testData: Partial<Responsible> = {
        ...existing,
        id: `test-${existing.id}`,
        name: `[TEST] ${existing.name}`
      };
      
      // Aplicar las actualizaciones seleccionadas
      if (resolution === 'update') {
        if (updateValue && newResponsible.valor !== undefined) {
          testData.valor = newResponsible.valor;
        }
        
        if (updateDates) {
          if (newResponsible.f_inicial_contrato) {
            testData.f_inicial_contrato = newResponsible.f_inicial_contrato;
          }
          if (newResponsible.f_final_contrato) {
            testData.f_final_contrato = newResponsible.f_final_contrato;
          }
        }
      }
      
      onTest(testData);
      toast.success('Prueba iniciada: se ha creado una copia temporal para verificar los cambios');
    } catch (error) {
      console.error('Error en prueba:', error);
      toast.error('Error al realizar la prueba');
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-xl z-10 w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <AlertCircle className="mr-2 text-yellow-500" size={24} />
            Conflicto de duplicado detectado
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="mb-4 text-gray-700">
            Se ha detectado un responsable existente con datos similares. Por favor, seleccione cómo desea proceder:
          </p>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2 text-blue-600">Registro existente</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Nombre:</td>
                    <td>{existing.name}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Identificación:</td>
                    <td>{existing.identificacion}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Empresa:</td>
                    <td>{existing.empresa}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Valor:</td>
                    <td className="font-semibold">{existing.valor?.toLocaleString('es-CO')}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Fecha inicial:</td>
                    <td>
                      {formatDateSafely(existing.f_inicial_contrato)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Fecha final:</td>
                    <td>
                      {formatDateSafely(existing.f_final_contrato)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Última actualización:</td>
                    <td>
                      {formatDateSafely(existing.updatedAt, 'dd/MM/yyyy HH:mm')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="border rounded-lg p-4 bg-yellow-50">
              <h3 className="font-semibold mb-2 text-green-600">Nuevo registro</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Nombre:</td>
                    <td>{newResponsible.name}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Identificación:</td>
                    <td>{newResponsible.identificacion}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Empresa:</td>
                    <td>{newResponsible.empresa}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Valor:</td>
                    <td className="font-semibold">{newResponsible.valor?.toLocaleString('es-CO')}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Fecha inicial:</td>
                    <td>
                      {formatDateSafely(newResponsible.f_inicial_contrato)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-600">Fecha final:</td>
                    <td>
                      {formatDateSafely(newResponsible.f_final_contrato)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="keep"
                name="resolution"
                checked={resolution === 'keep'}
                onChange={() => setResolution('keep')}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="keep" className="text-gray-700">
                Mantener registro existente (ignorar nuevo)
              </label>
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="update"
                  name="resolution"
                  checked={resolution === 'update'}
                  onChange={() => setResolution('update')}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="update" className="text-gray-700">
                  Actualizar registro existente con datos seleccionados:
                </label>
              </div>
              
              {resolution === 'update' && (
                <div className="ml-6 mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="updateValue"
                      checked={updateValue}
                      onChange={() => setUpdateValue(!updateValue)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <label htmlFor="updateValue" className="text-gray-700">
                      Actualizar valor ({newResponsible.valor?.toLocaleString('es-CO')})
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="updateDates"
                      checked={updateDates}
                      onChange={() => setUpdateDates(!updateDates)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <label htmlFor="updateDates" className="text-gray-700">
                      Actualizar fechas de contrato
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="create"
                name="resolution"
                checked={resolution === 'create'}
                onChange={() => setResolution('create')}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="create" className="text-gray-700">
                Crear nuevo registro (duplicar)
              </label>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
          {onTest && (
            <button
              onClick={handleTest}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
            >
              <TestTube size={18} className="mr-1" />
              Probar cambios
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleResolve}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Check size={18} className="mr-1" />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateResolverModal;
