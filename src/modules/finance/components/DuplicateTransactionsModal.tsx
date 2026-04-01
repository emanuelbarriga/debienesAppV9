import React from 'react';
import { DuplicateTransaction } from '../../../types';
import { Check, X, AlertTriangle, Database, FileDiff } from 'lucide-react';

interface Props {
  duplicates: DuplicateTransaction[];
  onResolve: (approved: DuplicateTransaction[]) => void;
  onCancel: () => void;
}

export function DuplicateTransactionsModal({ duplicates, onResolve, onCancel }: Props) {
  const [resolvedTransactions, setResolvedTransactions] = React.useState<DuplicateTransaction[]>(
    duplicates.map(d => ({ ...d, approved: false }))
  );

  const handleToggleApproval = (index: number) => {
    setResolvedTransactions(prev => 
      prev.map((t, i) => i === index ? { ...t, approved: !t.approved } : t)
    );
  };

  const handleResolve = () => {
    onResolve(resolvedTransactions);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Transacciones Duplicadas Detectadas</h2>
            <p className="text-sm text-gray-500">
              Se encontraron {duplicates.length} transacciones duplicadas.
              Por favor, revise cada una y decida si desea importarla.
            </p>
            <div className="flex gap-6 mt-2 text-sm">
              <div className="flex items-center gap-1">
                <FileDiff className="h-4 w-4 text-amber-500" />
                <span>
                  Duplicados internos: {duplicates.filter(d => d.duplicateType === 'internal').length} 
                  <span className="text-xs text-gray-500">(dentro del mismo archivo)</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Database className="h-4 w-4 text-blue-500" />
                <span>
                  Duplicados externos: {duplicates.filter(d => d.duplicateType === 'external').length} 
                  <span className="text-xs text-gray-500">(existentes en Firestore)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {resolvedTransactions.map((duplicate, index) => (
            <div key={index} className={`border rounded-lg p-4 ${duplicate.duplicateType === 'internal' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {duplicate.duplicateType === 'internal' ? (
                      <>
                        <FileDiff className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Duplicado Interno</span>
                        <span className="text-xs text-gray-500">(dentro del mismo archivo CSV)</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Duplicado Externo</span>
                        <span className="text-xs text-gray-500">(existente en la base de datos)</span>
                      </>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {duplicate.duplicateType === 'internal' ? 'Primera Ocurrencia' : 'Transacción Existente'}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm">
                        <p><span className="text-gray-500">Fecha:</span> {duplicate.existing.fechaStr}</p>
                        <p><span className="text-gray-500">Descripción:</span> {duplicate.existing.descripcion}</p>
                        <p><span className="text-gray-500">Valor:</span> ${duplicate.existing.valor.toLocaleString()}</p>
                        <p><span className="text-gray-500">Tipo:</span> {duplicate.existing.tipoTransaccion || '-'}</p>
                        <p><span className="text-gray-500">Código Ref:</span> {duplicate.existing.codigoReferencia || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {duplicate.duplicateType === 'internal' ? 'Ocurrencia Duplicada' : 'Nueva Transacción'}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm">
                        <p><span className="text-gray-500">Fecha:</span> {duplicate.new.fechaStr}</p>
                        <p><span className="text-gray-500">Descripción:</span> {duplicate.new.descripcion}</p>
                        <p><span className="text-gray-500">Valor:</span> ${duplicate.new.valor.toLocaleString()}</p>
                        <p><span className="text-gray-500">Tipo:</span> {duplicate.new.tipoTransaccion || '-'}</p>
                        <p><span className="text-gray-500">Código Ref:</span> {duplicate.new.codigoReferencia || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleApproval(index)}
                  className={`ml-4 p-2 rounded-lg transition-colors duration-200 ${
                    duplicate.approved
                      ? 'bg-green-100 text-green-600 hover:bg-green-200'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  {duplicate.approved ? <Check size={20} /> : <X size={20} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleResolve}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
          >
            Confirmar Selección
          </button>
        </div>
      </div>
    </div>
  );
}
