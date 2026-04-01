import { Beaker } from 'lucide-react';
import toast from 'react-hot-toast';

export const duplicadosResponsablesTest = {
  id: 'duplicados-responsables',
  icon: <Beaker size={20} />,
  title: 'Detección de Duplicados',
  description: 'Lanza el modal de duplicados con datos mock (sin tocar datos reales).',
  action: () => {
    console.log('[TEST] Detección de Duplicados -> abrir modal mock');
    toast.success('Simulación: modal de duplicados abierto con datos mock');
  }
};
