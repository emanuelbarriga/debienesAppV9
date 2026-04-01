import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const distribucionSaldosTest = {
  id: 'distribucion-saldos',
  icon: <RefreshCw size={20} />,
  title: 'Distribución de Saldos',
  description: 'Confirma flujo hacia distribución (1 cuenta vs múltiples) en modo mock.',
  action: () => {
    console.log('[TEST] Distribución de Saldos -> flujo con 1 vs múltiples cuentas (mock)');
    toast.success('Simulación: flujo de distribución validado (mock)');
  }
};
