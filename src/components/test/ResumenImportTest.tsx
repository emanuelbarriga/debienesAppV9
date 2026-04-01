import { Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export const resumenImportTest = {
  id: 'resumen-import',
  icon: <Layers size={20} />,
  title: 'Resumen de Importación',
  description: 'Verifica acciones create/update/ignore en modo mock.',
  action: () => {
    console.log('[TEST] Resumen de Importación -> aplicar acciones mock');
    toast.success('Simulación: acciones aplicadas a elementos del resumen');
  }
};
