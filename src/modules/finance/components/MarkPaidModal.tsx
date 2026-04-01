import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { BankPaymentBatch } from '../../../types';
import { formatCOPAmount } from '../../../utils/moneyUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  batch: BankPaymentBatch;
  onConfirm: (data: { fechaPago: Date; comprobante: string }) => void;
}

export default function MarkPaidModal({
  isOpen,
  onClose,
  batch,
  onConfirm
}: Props) {
  const [fechaPago, setFechaPago] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [comprobante, setComprobante] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      fechaPago: new Date(fechaPago),
      comprobante
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={24} />
            <h3 className="text-lg font-semibold">Confirmar Pago</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-900">{batch.referencia}</div>
          <div className="text-xs text-green-700 mt-1">{batch.banco}</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div>
              <span className="text-gray-600">Cuentas:</span>
              <div className="font-semibold">{batch.items.length}</div>
            </div>
            <div>
              <span className="text-gray-600">Total:</span>
              <div className="font-semibold">{formatCOPAmount(batch.totalMonto)}</div>
            </div>
          </div>
        </div>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-900">
            ¿Confirmar que este lote fue pagado exitosamente?
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Esta acción marcará todas las cuentas como pagadas.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha real de pago *
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprobante/Referencia
            </label>
            <input
              type="text"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="REF-BANCOL-123456789"
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
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
