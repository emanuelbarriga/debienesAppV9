import { useState } from 'react';
import { X } from 'lucide-react';
import { formatCOPAmount } from '../../../utils/moneyUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  banco: string;
  cuentasSeleccionadas: number;
  propietariosAfectados: number;
  totalMonto: number;
  mes: number;
  anio: number;
  onConfirm: (data: { referencia: string; fechaProgramada: Date; observaciones: string }) => void;
}

export default function CreateBatchModal({
  isOpen,
  onClose,
  banco,
  cuentasSeleccionadas,
  propietariosAfectados,
  totalMonto,
  mes,
  anio,
  onConfirm
}: Props) {
  const [referencia, setReferencia] = useState(() => {
    const monthStr = mes.toString().padStart(2, '0');
    const bancoShort = banco.substring(0, 6).toUpperCase().replace(/\s/g, '');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LOTE-${bancoShort}-${anio}${monthStr}-${randomNum}`;
  });

  const [fechaProgramada, setFechaProgramada] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [observaciones, setObservaciones] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      referencia,
      fechaProgramada: new Date(fechaProgramada),
      observaciones
    });
  };

  const monthName = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long' });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Crear Lote de Pago</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-900">{banco}</div>
          <div className="text-xs text-blue-700 mt-1">
            {monthName} {anio}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <div>
              <span className="text-gray-600">Cuentas:</span>
              <div className="font-semibold">{cuentasSeleccionadas}</div>
            </div>
            <div>
              <span className="text-gray-600">Propietarios:</span>
              <div className="font-semibold">{propietariosAfectados}</div>
            </div>
            <div>
              <span className="text-gray-600">Total:</span>
              <div className="font-semibold">{formatCOPAmount(totalMonto)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia del lote *
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="LOTE-BANCOL-202510-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha programada de pago
            </label>
            <input
              type="date"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Información adicional sobre este lote..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!referencia.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Crear Lote
          </button>
        </div>
      </div>
    </div>
  );
}
