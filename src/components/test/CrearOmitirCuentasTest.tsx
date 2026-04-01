import { Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

export const crearOmitirCuentasTest = {
  id: 'crear-cuentas-omitir',
  icon: <Wallet size={20} />,
  title: 'Crear/Omitir Cuentas',
  description: 'Prueba marca de omitir/restaurar (mock, sin persistir).',
  action: () => {
    console.log('[TEST] Crear/Omitir Cuentas -> omitir/restaurar mock');
    toast.success('Simulación: propietario marcado como omitido/restaurado');
  }
};
