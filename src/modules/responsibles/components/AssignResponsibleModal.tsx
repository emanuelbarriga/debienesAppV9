import { useState } from 'react';
import { Transaction } from '../../../types';
import { Responsible } from '../../../types';
import { useAssignResponsible } from '../../../hooks/useAssignResponsible';
import { ResponsibleSearchInput } from './ResponsibleSearchInput';
import { useResponsibleSearch } from '../../../hooks/useResponsibleSearch';

interface AssignResponsibleModalProps {
  transaction: Transaction;
  onClose: () => void;
  onAssign: (responsibleId: string) => void;
  isOpen: boolean; // Declared but its value is never read, as parent likely controls rendering
  responsibles: Responsible[];
}

export default function AssignResponsibleModal({
  transaction,
  onClose,
  onAssign,
  //isOpen, // Keeping this prop as is, likely for parent's conditional rendering
  responsibles
}: AssignResponsibleModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponsible, setSelectedResponsible] = useState<Responsible | null>(null);
  const { assignResponsible, loading } = useAssignResponsible();
  const filteredResponsibles = useResponsibleSearch(responsibles, searchTerm);

  const handleAssign = async () => {
    // Validamos que haya un responsable seleccionado y que tenga un ID definido.
    // Esto es crucial si 'Responsible.id' es opcional (id?: string)
    if (!selectedResponsible || !selectedResponsible.id) {
      console.warn('No hay responsable seleccionado o su ID es inválido.');
      return;
    }
    
    try {
      // Ahora selectedResponsible.id está garantizado como string
      await assignResponsible(transaction.id, selectedResponsible.id);
      onAssign(selectedResponsible.id);
      onClose(); // Generalmente, después de una asignación exitosa, se cierra el modal
    } catch (error) {
      console.error('Error al asignar responsable:', error);
      // Podrías añadir un estado de error o notificación al usuario aquí
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Asignar Responsable
          </h3>

          <div className="space-y-4">
            {/* Detalles de la transacción */}
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-500">Transacción</div>
              <div className="font-medium">{transaction.descripcion}</div>
              <div className="text-sm text-gray-500">{transaction.fechaStr}</div>
              <div className="text-sm font-medium">
                {transaction.tipo === 'INGRESO' ? '+' : '-'}${transaction.valor}
              </div>
            </div>

            {/* Buscador de responsables */}
            <div className="space-y-2">
              <ResponsibleSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar responsable por nombre, identificación, teléfono..."
              />
              
              <div className="mt-2 max-h-60 overflow-auto border border-gray-300 rounded-md">
                {/* Si no hay responsables filtrados, puedes mostrar un mensaje */}
                {filteredResponsibles.length === 0 && (
                  <div className="p-2 text-gray-500 text-center">
                    No se encontraron responsables.
                  </div>
                )}
                {filteredResponsibles.map((responsible) => {
                  // Obtener el primer número de teléfono, si existe
                  const firstPhone = responsible.phones?.[0];

                  return (
                    <div
                      key={responsible.id} // Asumiendo que responsible.id siempre existe y es string aquí
                      onClick={() => setSelectedResponsible(responsible)}
                      className={`p-2 cursor-pointer hover:bg-gray-50 ${
                        selectedResponsible?.id === responsible.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{responsible.name}</div>
                          <div className="text-sm text-gray-500">
                            {responsible.identificacion}
                            {/* Renderizar el número de teléfono solo si existe */}
                            {firstPhone && ` • ${firstPhone}`}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {responsible.type === 'tenant' && 'Arrendatario'}
                          {responsible.type === 'owner' && 'Propietario'}
                          {responsible.type === 'admin' && 'Administración'}
                          {responsible.type === 'other' && 'Otro'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssign}
              // Deshabilitar si no hay responsable seleccionado O si el ID del responsable no es válido
              disabled={!selectedResponsible || !selectedResponsible.id || loading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                !selectedResponsible || !selectedResponsible.id || loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Asignando...' : 'Asignar Responsable'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}