import { useState } from 'react';
import { Transaction } from '../../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, X, ChevronRight, ChevronDown } from 'lucide-react';

interface DuplicateGroup {
  key: string;
  transactions: Transaction[];
  selectedId: string | null;
  isExpanded: boolean;
}

interface CleanDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: DuplicateGroup[];
  onSaveSelections: (selectedTransactions: { groupKey: string; selectedId: string }[]) => void;
  account: {
    nombre: string;
    banco: string;
    numeroCuenta: string;
  };
}

export function CleanDuplicatesModal({
  isOpen,
  onClose,
  duplicateGroups,
  onSaveSelections,
  account
}: CleanDuplicatesModalProps) {
  const [groups, setGroups] = useState<DuplicateGroup[]>(duplicateGroups);

  if (!isOpen) return null;

  const handleSelect = (groupIndex: number, transactionId: string) => {
    setGroups(prevGroups => {
      const newGroups = [...prevGroups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        selectedId: transactionId
      };
      return newGroups;
    });
  };

  const toggleGroup = (groupIndex: number) => {
    setGroups(prevGroups => {
      const newGroups = [...prevGroups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        isExpanded: !newGroups[groupIndex].isExpanded
      };
      return newGroups;
    });
  };

  const handleSave = () => {
    const selections = groups
      .filter(group => group.selectedId)
      .map(group => ({
        groupKey: group.key,
        selectedId: group.selectedId!
      }));
    onSaveSelections(selections);
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Limpiar Transacciones Duplicadas</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700">{account.nombre}</h3>
          <p className="text-gray-600">
            {account.banco} - {account.numeroCuenta}
          </p>
        </div>

        <div className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={group.key} className="border rounded-lg">
              <div
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                onClick={() => toggleGroup(groupIndex)}
              >
                <div className="flex items-center gap-2">
                  {group.isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span className="font-medium">
                    {formatCurrency(group.transactions[0].valor)} - {group.transactions[0].descripcion}
                  </span>
                </div>
                <span className="text-gray-500">
                  {group.transactions.length} transacciones
                </span>
              </div>

              {group.isExpanded && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-[auto,1fr,1fr,auto] gap-4 text-sm font-medium text-gray-500 pb-2">
                    <div>Seleccionar</div>
                    <div>Fecha</div>
                    <div>Detalles</div>
                    <div>Valor</div>
                  </div>
                  {group.transactions.map(transaction => (
                    <div
                      key={transaction.id}
                      className={`grid grid-cols-[auto,1fr,1fr,auto] gap-4 items-center p-2 rounded ${
                        group.selectedId === transaction.id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => handleSelect(groupIndex, transaction.id)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                          group.selectedId === transaction.id
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {group.selectedId === transaction.id && <Check size={14} />}
                      </button>
                      <div>
                        {format(transaction.fecha instanceof Date ? transaction.fecha : (transaction.fecha as any).toDate(), 'dd/MM/yyyy', { locale: es })}
                      </div>
                      <div className="text-gray-600">
                        <div>{transaction.descripcion}</div>
                        <div className="text-sm text-gray-400">
                          {transaction.tipoTransaccion} - {transaction.oficina}
                        </div>
                      </div>
                      <div className="text-right font-medium">
                        {formatCurrency(transaction.valor)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Guardar Selección
          </button>
        </div>
      </div>
    </div>
  );
}
