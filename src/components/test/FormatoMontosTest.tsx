import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const formatoMontosTest = {
  id: 'formato-montos',
  icon: <CheckCircle2 size={20} />,
  title: 'Formato y Parseo de Montos',
  description: 'Ejecuta validaciones de parseo/formateo COP (mock).',
  action: () => {
    console.log('[TEST] Formato/Parseo de Montos -> validación COP (mock)');
    toast.success('Simulación: parseo/formateo COP validado');
  }
};
