import { useState } from 'react';
import { X, UserPlus, ChevronRight, AlertCircle, Search } from 'lucide-react';
import type { OwnerSuggestion } from '../../../utils/fuzzyMatch';
import { formatCOPAmount } from '../../../utils/moneyUtils';
import { useCollection } from '../../../hooks/useCollection';
import { Responsible } from '../../../types';
import { normalizeDocumento } from '../../../utils/ownerAccountUtils';

export interface UnidentifiedOwner {
  propietario: string;
  nit: string;
  saldo: number;
  suggestions: OwnerSuggestion[];
}

export interface OwnerIdentification {
  nit: string;
  action: 'link_existing' | 'create_new' | 'skip';
  existingResponsibleId?: string;
  newOwnerData?: {
    name: string;
    identificacion: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  unidentifiedOwners: UnidentifiedOwner[];
  onIdentified: (identifications: OwnerIdentification[]) => void;
}

export default function IdentifyOwnerModal({ isOpen, onClose, unidentifiedOwners, onIdentified }: Props) {
  const [identifications, setIdentifications] = useState<Record<string, OwnerIdentification>>({});
  const [manualSearchQuery, setManualSearchQuery] = useState<Record<string, string>>({});
  const { data: allResponsibles } = useCollection<Responsible>('responsibles');

  if (!isOpen) return null;

  const allIdentified = unidentifiedOwners.every(owner => identifications[owner.nit]);

  const handleSelectExisting = (nit: string, responsibleId: string) => {
    setIdentifications(prev => ({
      ...prev,
      [nit]: {
        nit,
        action: 'link_existing',
        existingResponsibleId: responsibleId
      }
    }));
  };

  const handleCreateNew = (nit: string, name: string, identificacion: string) => {
    setIdentifications(prev => ({
      ...prev,
      [nit]: {
        nit,
        action: 'create_new',
        newOwnerData: {
          name,
          identificacion
        }
      }
    }));
  };

  const handleSkip = (nit: string) => {
    setIdentifications(prev => ({
      ...prev,
      [nit]: {
        nit,
        action: 'skip'
      }
    }));
  };

  const handleConfirm = () => {
    if (!allIdentified) return;
    onIdentified(Object.values(identifications));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="text-orange-500" size={24} />
              Paso 1: Identificar Propietarios
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {unidentifiedOwners.length} propietario(s) sin identificar. Selecciona uno existente o crea uno nuevo.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {unidentifiedOwners.map((owner) => {
            const identification = identifications[owner.nit];

            return (
              <div key={owner.nit} className="border-2 rounded-lg p-5 bg-gray-50">
                {/* Owner Info */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-semibold text-lg">{owner.propietario}</div>
                    <div className="text-sm text-gray-600">NIT: {owner.nit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Saldo del mes</div>
                    <div className={`font-semibold ${owner.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCOPAmount(owner.saldo)}
                    </div>
                  </div>
                </div>

                {identification ? (
                  <div className={`border rounded p-4 ${
                    identification.action === 'skip' 
                      ? 'bg-gray-50 border-gray-300' 
                      : 'bg-green-50 border-green-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${
                          identification.action === 'skip' 
                            ? 'text-gray-800' 
                            : 'text-green-800'
                        }`}>
                          {identification.action === 'skip' 
                            ? '⊘ Propietario omitido - No se importará' 
                            : identification.action === 'link_existing'
                              ? '✓ Vinculado con propietario existente'
                              : '✓ Se creará nuevo propietario'
                          }
                        </p>
                        {identification.newOwnerData && (
                          <p className="text-xs text-green-700 mt-1">
                            {identification.newOwnerData.name} - {identification.newOwnerData.identificacion}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const newId = { ...identifications };
                          delete newId[owner.nit];
                          setIdentifications(newId);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Sugerencias */}
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-blue-900 mb-1">
                          💡 ¿Es alguno de estos propietarios?
                        </div>
                        <div className="text-xs text-blue-700 mb-3">
                          Selecciona si encuentras al propietario correcto
                        </div>
                        
                        {owner.suggestions.length > 0 ? (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {owner.suggestions.map(suggestion => (
                              <button
                                key={suggestion.id}
                                onClick={() => handleSelectExisting(owner.nit, suggestion.id)}
                                className="w-full text-left flex items-start p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all border-gray-300 bg-white"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{suggestion.name}</div>
                                  <div className="text-xs text-gray-600">Doc: {suggestion.documento}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      suggestion.score > 0.7 ? 'bg-green-100 text-green-700' :
                                      suggestion.score > 0.5 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {(suggestion.score * 100).toFixed(0)}% similitud
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {suggestion.source === 'responsible' ? '👤 Propietario' : '🏦 Cuenta'}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight size={20} className="text-gray-400 mt-1" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <ManualSearchPanel
                            allResponsibles={allResponsibles}
                            manualSearchQuery={manualSearchQuery[owner.nit] || ''}
                            onSearchChange={(query: string) => setManualSearchQuery(prev => ({ ...prev, [owner.nit]: query }))}
                            onSelectResponsible={(responsibleId: string) => handleSelectExisting(owner.nit, responsibleId)}
                          />
                        )}
                      </div>

                      {/* Crear Nuevo */}
                      <div className="bg-white border rounded-lg p-4">
                        <div className="text-sm font-medium mb-3 text-gray-700 flex items-center gap-2">
                          <UserPlus size={16} /> Crear nuevo propietario
                        </div>
                        <CreateNewOwnerForm
                          nit={owner.nit}
                          defaultName={owner.propietario}
                          onSubmit={(name, identificacion) => handleCreateNew(owner.nit, name, identificacion)}
                        />
                      </div>
                    </div>

                    {/* Botón Omitir */}
                    <div className="mt-4">
                      <button
                        onClick={() => handleSkip(owner.nit)}
                        className="w-full px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <X size={16} />
                        Omitir este propietario (no se importará)
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 border-t px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {Object.keys(identifications).length} / {unidentifiedOwners.length} identificados
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allIdentified}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Siguiente: Verificar Cuentas
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualSearchPanel({
  allResponsibles,
  manualSearchQuery,
  onSearchChange,
  onSelectResponsible
}: {
  allResponsibles: Responsible[];
  manualSearchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectResponsible: (responsibleId: string) => void;
}) {
  const filteredResponsibles = allResponsibles
    .filter(r => r.type === 'owner')
    .filter(r => {
      if (!manualSearchQuery) return false;
      const query = manualSearchQuery.toLowerCase();
      const name = r.name.toLowerCase();
      const doc = normalizeDocumento(r.identificacion || '');
      return name.includes(query) || doc.includes(query);
    })
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500 text-center py-2">
        No se encontraron coincidencias similares
      </div>
      
      <div className="border-t pt-3">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          🔍 Buscar manualmente
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={manualSearchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Nombre o documento..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {manualSearchQuery && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredResponsibles.length > 0 ? (
            filteredResponsibles.map(responsible => (
              <button
                key={responsible.id}
                onClick={() => onSelectResponsible(responsible.id!)}
                className="w-full text-left flex items-start p-2 border rounded hover:border-blue-500 hover:bg-blue-50 transition-all border-gray-200 bg-white"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{responsible.name}</div>
                  <div className="text-xs text-gray-600">Doc: {responsible.identificacion}</div>
                </div>
                <ChevronRight size={16} className="text-gray-400 mt-1" />
              </button>
            ))
          ) : (
            <div className="text-xs text-gray-500 text-center py-4">
              No se encontraron resultados para "{manualSearchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateNewOwnerForm({
  nit,
  defaultName,
  onSubmit
}: {
  nit: string;
  defaultName: string;
  onSubmit: (name: string, identificacion: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [identificacion, setIdentificacion] = useState(nit);

  const handleSubmit = () => {
    if (!name || !identificacion) {
      alert('Debes ingresar nombre e identificación');
      return;
    }
    onSubmit(name, identificacion);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Nombre del propietario"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Identificación *</label>
        <input
          type="text"
          value={identificacion}
          onChange={e => setIdentificacion(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="NIT/Cédula"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
      >
        Crear Propietario
      </button>
    </div>
  );
}
