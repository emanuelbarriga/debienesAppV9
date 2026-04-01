import { useState, useEffect } from 'react';
import { X, Search, DollarSign } from 'lucide-react';
import { useCollection } from '../../../hooks/useCollection';
import { OwnerAccount, BalancePendingDistribution } from '../../../types';
import { parseCOPAmount } from '../../../utils/moneyUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onProceedToDistribution: (distribution: BalancePendingDistribution) => void;
}

export default function AddBalanceManualModal({
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  onProceedToDistribution
}: Props) {
  const { data: accounts } = useCollection<OwnerAccount>('ownerAccounts');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwnerDoc, setSelectedOwnerDoc] = useState<string>('');
  const [saldoInput, setSaldoInput] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedOwnerDoc('');
      setSaldoInput('');
      setShowResults(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Obtener propietarios únicos
  const uniqueOwners = Array.from(
    new Map(
      accounts
        .filter(acc => acc.status === 'activa')
        .map(acc => [acc.documentoPropietario, acc])
    ).values()
  ).sort((a, b) => a.propietario.localeCompare(b.propietario));

  // Filtrar por búsqueda
  const filteredOwners = uniqueOwners.filter(owner =>
    owner.propietario.toLowerCase().includes(searchQuery.toLowerCase()) ||
    owner.documentoPropietario.includes(searchQuery)
  );

  const selectedOwner = uniqueOwners.find(o => o.documentoPropietario === selectedOwnerDoc);
  const ownerAccounts = selectedOwner 
    ? accounts.filter(acc => acc.documentoPropietario === selectedOwner.documentoPropietario && acc.status === 'activa')
    : [];

  const rawSaldo = parseCOPAmount(saldoInput);
  const payableSaldo = rawSaldo > 0 ? -Math.abs(rawSaldo) : rawSaldo;
  const isValid = selectedOwnerDoc && payableSaldo !== 0;

  const handleSubmit = () => {
    if (!isValid || !selectedOwner) return;

    // Respetar el signo ingresado:
    // Positivo = deuda del propietario a la inmobiliaria
    // Negativo = deuda de la inmobiliaria al propietario (a pagar)
    const distribution: BalancePendingDistribution = {
      documentoPropietario: selectedOwner.documentoPropietario,
      propietario: selectedOwner.propietario,
      saldo: payableSaldo,
      mes: selectedMonth,
      anio: selectedYear,
      cuentasDisponibles: ownerAccounts
    };

    onProceedToDistribution(distribution);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-semibold">Agregar Saldo Manual</h2>
            <p className="text-sm text-gray-600 mt-1">
              {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Buscar propietario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1. Selecciona el propietario
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                  if (!e.target.value) setSelectedOwnerDoc('');
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Buscar por nombre o documento..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {/* Resultados de búsqueda */}
            {showResults && searchQuery && (
              <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg bg-white shadow-lg">
                {filteredOwners.length > 0 ? (
                  filteredOwners.map(owner => (
                    <button
                      key={owner.documentoPropietario}
                      onClick={() => {
                        setSelectedOwnerDoc(owner.documentoPropietario);
                        setSearchQuery(owner.propietario);
                        setShowResults(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-medium">{owner.propietario}</div>
                      <div className="text-sm text-gray-600">{owner.documentoPropietario}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {accounts.filter(a => a.documentoPropietario === owner.documentoPropietario && a.status === 'activa').length} cuenta(s) activa(s)
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-500 text-sm text-center">
                    No se encontraron propietarios
                  </div>
                )}
              </div>
            )}

            {/* Propietario seleccionado */}
            {selectedOwner && !showResults && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-blue-900">{selectedOwner.propietario}</div>
                    <div className="text-sm text-blue-700">NIT: {selectedOwner.documentoPropietario}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      {ownerAccounts.length} cuenta(s) disponible(s)
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedOwnerDoc('');
                      setSearchQuery('');
                      setShowResults(false);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Cambiar
                  </button>
                </div>

                {/* Mostrar cuentas disponibles */}
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-medium text-blue-700">Cuentas disponibles:</div>
                  {ownerAccounts.map((acc, idx) => (
                    <div key={idx} className="text-xs text-blue-600 flex items-center gap-2">
                      <span>•</span>
                      <span className="font-medium">{acc.banco}</span>
                      <span>•••{acc.numeroCuenta.slice(-4)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        acc.tipoCuenta === 'AHORROS' ? 'bg-blue-100' : 'bg-purple-100'
                      }`}>
                        {acc.tipoCuenta}
                      </span>
                      {acc.isDefault && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          ⭐ Preferida
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ingresar saldo */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo (COP)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={saldoInput}
                onChange={(e) => setSaldoInput(e.target.value)}
                placeholder="Ingresa el valor"
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Los pagos a propietarios se guardan en negativo automáticamente para que aparezcan en "Por pagar".
            </p>
            <p className="mt-1 text-xs text-gray-500">
              💡 Negativo = a pagar al propietario | Positivo = deuda del propietario
            </p>
          </div>

          {/* Información adicional */}
          {selectedOwner && payableSaldo !== 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">¿Qué sucederá?</div>
              <ul className="space-y-1 text-sm text-gray-600">
                {ownerAccounts.length === 1 ? (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Se asignará automáticamente el 100% a la única cuenta disponible</span>
                  </li>
                ) : (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">→</span>
                    <span>Se abrirá el asistente de distribución para que elijas cómo repartir el saldo entre las {ownerAccounts.length} cuentas</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>El saldo se guardará para {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
