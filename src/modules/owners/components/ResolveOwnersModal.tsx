import { useState } from 'react';
import { X, UserPlus, ChevronRight, AlertCircle, CircleSlash, Building } from 'lucide-react';
import type { OwnerSuggestion } from '../../../utils/fuzzyMatch';
import { formatCOPAmount } from '../../../utils/moneyUtils';

export interface UnresolvedOwner {
  propietario: string;
  nit: string;
  saldo: number;
  status: 'needs_owner' | 'needs_account';
  existingResponsible?: {
    id: string;
    name: string;
    identificacion?: string;
  };
  suggestions: OwnerSuggestion[];
}

export interface OwnerResolution {
  nit: string;
  action: 'create_new_with_account' | 'create_account_for_existing' | 'skip';
  existingResponsibleId?: string;
  newOwnerData?: {
    name: string;
    identificacion: string;
  };
  accountData: {
    pagarA: string;
    documentoBeneficiario: string;
    numeroCuenta: string;
    banco: string;
    tipoCuenta: 'AHORROS' | 'CORRIENTE';
    observaciones?: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  unresolvedOwners: UnresolvedOwner[];
  onResolved: (resolutions: OwnerResolution[]) => void;
}

export default function ResolveOwnersModal({ isOpen, onClose, unresolvedOwners, onResolved }: Props) {
  const [resolutions, setResolutions] = useState<Record<string, OwnerResolution>>({});
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, OwnerSuggestion>>({});

  if (!isOpen) return null;

  const allResolved = unresolvedOwners.every(owner => {
    const res = resolutions[owner.nit];
    if (!res) return false;
    if (res.action === 'skip') return true;
    return res.accountData?.numeroCuenta && res.accountData?.banco;
  });

  const handleSelectSuggestion = (nit: string, suggestion: OwnerSuggestion) => {
    setSelectedSuggestions(prev => ({
      ...prev,
      [nit]: suggestion
    }));
  };

  const handleSkip = (nit: string) => {
    setResolutions(prev => ({
      ...prev,
      [nit]: {
        nit,
        action: 'skip',
        accountData: { pagarA: '', documentoBeneficiario: '', numeroCuenta: '', banco: '', tipoCuenta: 'AHORROS' }
      }
    }));
  };

  const handleSubmitNewOwner = (nit: string, ownerName: string, ownerDoc: string, accountData: OwnerResolution['accountData']) => {
    setResolutions(prev => ({
      ...prev,
      [nit]: {
        nit,
        action: 'create_new_with_account',
        newOwnerData: {
          name: ownerName,
          identificacion: ownerDoc
        },
        accountData
      }
    }));
  };

  const handleSubmitExistingOwner = (nit: string, responsibleId: string, accountData: OwnerResolution['accountData']) => {
    setResolutions(prev => ({
      ...prev,
      [nit]: {
        nit,
        action: 'create_account_for_existing',
        existingResponsibleId: responsibleId,
        accountData
      }
    }));
  };

  const handleConfirm = () => {
    if (!allResolved) return;
    onResolved(Object.values(resolutions));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="text-orange-500" size={24} />
              Resolver Propietarios - Crear Cuentas Bancarias
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {unresolvedOwners.length} propietario(s) necesitan cuenta bancaria para poder importar los saldos.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {unresolvedOwners.map((owner) => {
            const resolution = resolutions[owner.nit];

            return (
              <div key={owner.nit} className="border-2 rounded-lg p-5 bg-gray-50">
                {/* Owner Info */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <div className="font-semibold text-lg flex items-center gap-2">
                      {owner.propietario}
                      {owner.status === 'needs_account' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                          Propietario registrado - Necesita cuenta
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                          Nuevo propietario
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">NIT: {owner.nit}</div>
                    {owner.status === 'needs_account' && owner.existingResponsible && (
                      <div className="mt-2 text-xs text-blue-700 flex items-center gap-2">
                        <Building size={14} />
                        Responsable registrado: {owner.existingResponsible.name}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Saldo del mes</div>
                    <div className={`font-semibold ${owner.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCOPAmount(owner.saldo)}
                    </div>
                  </div>
                </div>

                {resolution?.action === 'skip' ? (
                  <div className="bg-gray-100 border border-gray-300 rounded p-4 text-center">
                    <p className="text-sm text-gray-600">Este propietario fue omitido. Podrás importarlo más tarde.</p>
                    <button
                      onClick={() => {
                        const newRes = { ...resolutions };
                        delete newRes[owner.nit];
                        setResolutions(newRes);
                        const newSugg = { ...selectedSuggestions };
                        delete newSugg[owner.nit];
                        setSelectedSuggestions(newSugg);
                      }}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Deshacer omisión
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Sugerencias de propietarios existentes */}
                    {owner.suggestions.length > 0 && (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-blue-900 mb-1">
                          💡 ¿Es alguno de estos propietarios?
                        </div>
                        <div className="text-xs text-blue-700 mb-3">
                          Selecciona el propietario correcto y luego ingresa los datos de su cuenta bancaria
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {owner.suggestions.map(suggestion => (
                            <label
                              key={suggestion.id}
                              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                                selectedSuggestions[owner.nit]?.id === suggestion.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`suggestion_${owner.nit}`}
                                checked={selectedSuggestions[owner.nit]?.id === suggestion.id}
                                onChange={() => handleSelectSuggestion(owner.nit, suggestion)}
                                className="mt-1 mr-3"
                              />
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
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formularios según selección */}
                    <div>
                      {selectedSuggestions[owner.nit] ? (
                        <CreateAccountForExistingOwnerForm
                          nit={owner.nit}
                          existingResponsible={{
                            id: selectedSuggestions[owner.nit].id,
                            name: selectedSuggestions[owner.nit].name,
                            identificacion: selectedSuggestions[owner.nit].documento
                          }}
                          onSubmit={(accountData) => handleSubmitExistingOwner(owner.nit, selectedSuggestions[owner.nit].id, accountData)}
                          onSkip={() => handleSkip(owner.nit)}
                        />
                      ) : owner.status === 'needs_owner' ? (
                        <CreateNewOwnerWithAccountForm
                          nit={owner.nit}
                          defaultName={owner.propietario}
                          onSubmit={(accountData) => handleSubmitNewOwner(owner.nit, owner.propietario, owner.nit, accountData)}
                          onSkip={() => handleSkip(owner.nit)}
                        />
                      ) : owner.existingResponsible ? (
                        <CreateAccountForExistingOwnerForm
                          nit={owner.nit}
                          existingResponsible={owner.existingResponsible}
                          onSubmit={(accountData) => handleSubmitExistingOwner(owner.nit, owner.existingResponsible!.id, accountData)}
                          onSkip={() => handleSkip(owner.nit)}
                        />
                      ) : (
                        <div className="text-sm text-red-600 text-center py-4">
                          Error: No se encontró información del propietario
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 border-t px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {Object.keys(resolutions).length} / {unresolvedOwners.length} resueltos
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
              disabled={!allResolved}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Continuar
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Formulario para crear propietario nuevo + cuenta
function CreateNewOwnerWithAccountForm({
  nit,
  defaultName,
  onSubmit,
  onSkip
}: {
  nit: string;
  defaultName: string;
  onSubmit: (accountData: OwnerResolution['accountData']) => void;
  onSkip: () => void;
}) {
  const [pagarA, setPagarA] = useState(defaultName);
  const [documentoBeneficiario, setDocumentoBeneficiario] = useState(nit);
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState<'AHORROS' | 'CORRIENTE'>('AHORROS');
  const [observaciones, setObservaciones] = useState('');

  const handleSubmit = () => {
    if (!numeroCuenta || !banco) {
      alert('Debes ingresar al menos el número de cuenta y el banco');
      return;
    }
    onSubmit({
      pagarA,
      documentoBeneficiario,
      numeroCuenta,
      banco,
      tipoCuenta,
      observaciones
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 p-3 rounded">
        <UserPlus size={16} />
        Se creará un nuevo propietario con los siguientes datos:
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-gray-700 uppercase">Datos de la Cuenta Bancaria *</div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Pagar A</label>
            <input
              type="text"
              value={pagarA}
              onChange={e => setPagarA(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Beneficiario"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Doc. Beneficiario</label>
            <input
              type="text"
              value={documentoBeneficiario}
              onChange={e => setDocumentoBeneficiario(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">No. Cuenta *</label>
            <input
              type="text"
              value={numeroCuenta}
              onChange={e => setNumeroCuenta(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Número de cuenta"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Banco *</label>
            <input
              type="text"
              value={banco}
              onChange={e => setBanco(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Nombre del banco"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
            <select
              value={tipoCuenta}
              onChange={e => setTipoCuenta(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="AHORROS">AHORROS</option>
              <option value="CORRIENTE">CORRIENTE</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            ✓ Crear Propietario + Cuenta
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
          >
            <CircleSlash size={16} className="inline mr-1" />
            Omitir
          </button>
        </div>
      </div>
    </div>
  );
}

// Formulario para crear cuenta para propietario existente
function CreateAccountForExistingOwnerForm({
  nit,
  existingResponsible,
  onSubmit,
  onSkip
}: {
  nit: string;
  existingResponsible: { id: string; name: string; identificacion?: string };
  onSubmit: (accountData: OwnerResolution['accountData']) => void;
  onSkip: () => void;
}) {
  const [pagarA, setPagarA] = useState(existingResponsible.name);
  const [documentoBeneficiario, setDocumentoBeneficiario] = useState(existingResponsible.identificacion || nit);
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState<'AHORROS' | 'CORRIENTE'>('AHORROS');
  const [observaciones, setObservaciones] = useState('');

  const handleSubmit = () => {
    if (!numeroCuenta || !banco) {
      alert('Debes ingresar al menos el número de cuenta y el banco');
      return;
    }
    onSubmit({
      pagarA,
      documentoBeneficiario,
      numeroCuenta,
      banco,
      tipoCuenta,
      observaciones
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 p-3 rounded">
        <Building size={16} />
        Se creará una cuenta bancaria para el propietario registrado: <strong>{existingResponsible.name}</strong>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-gray-700 uppercase">Datos de la Cuenta Bancaria *</div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Pagar A</label>
            <input
              type="text"
              value={pagarA}
              onChange={e => setPagarA(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Doc. Beneficiario</label>
            <input
              type="text"
              value={documentoBeneficiario}
              onChange={e => setDocumentoBeneficiario(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">No. Cuenta *</label>
            <input
              type="text"
              value={numeroCuenta}
              onChange={e => setNumeroCuenta(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Número de cuenta"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Banco *</label>
            <input
              type="text"
              value={banco}
              onChange={e => setBanco(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Nombre del banco"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
            <select
              value={tipoCuenta}
              onChange={e => setTipoCuenta(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="AHORROS">AHORROS</option>
              <option value="CORRIENTE">CORRIENTE</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            ✓ Crear Cuenta Bancaria
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
          >
            <CircleSlash size={16} className="inline mr-1" />
            Omitir
          </button>
        </div>
      </div>
    </div>
  );
}
