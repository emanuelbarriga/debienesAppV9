import { useState } from 'react';
import { X, Building, ChevronRight, AlertCircle } from 'lucide-react';
import { BANCOS_COLOMBIA } from '../../../constants/banks';
import { formatCOPAmount } from '../../../utils/moneyUtils';

export interface OwnerNeedingAccount {
  nit: string;
  propietario: string;
  saldo: number;
  responsibleId: string;
  responsibleName: string;
}

export interface AccountCreation {
  nit: string;
  responsibleId: string;
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
  ownersNeedingAccounts: OwnerNeedingAccount[];
  onAccountsCreated: (accounts: AccountCreation[]) => void;
}

export default function CreateAccountsModal({ isOpen, onClose, ownersNeedingAccounts, onAccountsCreated }: Props) {
  const [accounts, setAccounts] = useState<Record<string, AccountCreation>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const allAccountsHandled = ownersNeedingAccounts.every(owner => {
    if (skipped.has(owner.nit)) return true;
    const acc = accounts[owner.nit];
    return acc && acc.accountData.numeroCuenta && acc.accountData.banco;
  });

  const handleToggleSkip = (nit: string) => {
    setSkipped(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nit)) {
        newSet.delete(nit);
      } else {
        newSet.add(nit);
        // Si estaba en accounts, lo removemos al omitir
        if (accounts[nit]) {
          const newAccs = { ...accounts };
          delete newAccs[nit];
          setAccounts(newAccs);
        }
      }
      return newSet;
    });
  };

  const handleAccountSubmit = (nit: string, accountData: AccountCreation['accountData']) => {
    // Buscar el responsibleId para este nit desde ownersNeedingAccounts
    const owner = ownersNeedingAccounts.find(o => o.nit === nit);
    if (!owner) return;

    const responsibleId = owner.responsibleId;
    
    // Si se guarda una cuenta, dejamos de omitir
    setSkipped(prev => {
      if (prev.has(nit)) {
        const newSet = new Set(prev);
        newSet.delete(nit);
        return newSet;
      }
      return prev;
    });

    setAccounts(prev => ({
      ...prev,
      [nit]: {
        nit,
        responsibleId,
        accountData
      }
    }));
  };

  const handleConfirm = () => {
    if (!allAccountsHandled) return;
    onAccountsCreated(Object.values(accounts));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="text-blue-500" size={24} />
              Paso 2: Crear Cuentas Bancarias
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {ownersNeedingAccounts.length} propietario(s) sin cuenta bancaria. Ingresa los datos de sus cuentas.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {ownersNeedingAccounts.map((owner) => {
            const accountCreation = accounts[owner.nit];
            const isSkipped = skipped.has(owner.nit);

            return (
              <div key={owner.nit} className={`border-2 rounded-lg p-5 ${isSkipped ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'}`}>
                {/* Owner Info */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-semibold text-lg flex items-center gap-2">
                      <Building size={20} className={isSkipped ? 'text-amber-600' : 'text-blue-600'} />
                      {owner.responsibleName}
                    </div>
                    <div className="text-sm text-gray-600">NIT: {owner.nit}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Saldo del mes</div>
                      <div className={`font-semibold ${owner.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCOPAmount(owner.saldo)}
                      </div>
                    </div>
                    {!accountCreation && (
                      <button
                        onClick={() => handleToggleSkip(owner.nit)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          isSkipped 
                            ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' 
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {isSkipped ? '✓ Omitido (Click para restaurar)' : 'Omitir por ahora'}
                      </button>
                    )}
                  </div>
                </div>

                {isSkipped ? (
                  <div className="bg-amber-100 border border-amber-300 rounded p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={20} className="text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Cuenta omitida temporalmente
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Podrás completar los datos bancarios más tarde desde el perfil del propietario.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : accountCreation ? (
                  <div className="bg-green-50 border border-green-300 rounded p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          ✓ Cuenta creada
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          {accountCreation.accountData.banco} - {accountCreation.accountData.numeroCuenta}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newAcc = { ...accounts };
                          delete newAcc[owner.nit];
                          setAccounts(newAcc);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ) : (
                  <CreateAccountForm
                    nit={owner.nit}
                    responsibleName={owner.responsibleName}
                    onSubmit={(accountData) => handleAccountSubmit(owner.nit, accountData)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 border-t px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {Object.keys(accounts).length} creadas, {skipped.size} omitidas de {ownersNeedingAccounts.length}
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
              disabled={!allAccountsHandled}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Finalizar e Importar
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateAccountForm({
  nit,
  responsibleName,
  onSubmit
}: {
  nit: string;
  responsibleName: string;
  onSubmit: (accountData: AccountCreation['accountData']) => void;
}) {
  const [pagarA, setPagarA] = useState(responsibleName);
  const [documentoBeneficiario, setDocumentoBeneficiario] = useState(nit);
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState<'AHORROS' | 'CORRIENTE'>('AHORROS');
  const [observaciones, setObservaciones] = useState('');
  const [showCustomBanco, setShowCustomBanco] = useState(false);
  const [customBanco, setCustomBanco] = useState('');

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
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-700 uppercase mb-2">
        Datos de la Cuenta Bancaria
      </div>

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
          <select
            value={showCustomBanco ? 'OTRO' : banco}
            onChange={e => {
              const value = e.target.value;
              if (value === 'OTRO') {
                setShowCustomBanco(true);
                setCustomBanco('');
                setBanco('');
              } else {
                setShowCustomBanco(false);
                setBanco(value);
              }
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Seleccionar banco...</option>
            {BANCOS_COLOMBIA.filter(b => b !== 'OTRO').map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value="OTRO">➕ Otro banco (especificar)</option>
          </select>
          
          {showCustomBanco && (
            <div className="mt-2">
              <input
                type="text"
                value={customBanco}
                onChange={e => {
                  const value = e.target.value.toUpperCase();
                  setCustomBanco(value);
                  setBanco(value);
                }}
                placeholder="Ingrese el nombre del banco"
                className="w-full px-3 py-2 border border-orange-300 rounded-lg bg-orange-50 text-sm"
                autoFocus
              />
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Se guardará como "OTRO". Considera agregarlo al catálogo oficial.
              </p>
            </div>
          )}
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

      <button
        type="button"
        onClick={handleSubmit}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm mt-2"
      >
        ✓ Guardar Cuenta
      </button>
    </div>
  );
}
