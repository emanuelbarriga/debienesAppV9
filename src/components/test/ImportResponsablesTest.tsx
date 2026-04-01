import { FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

export const importResponsablesTest = {
  id: 'import-responsables',
  icon: <FileSpreadsheet size={20} />,
  title: 'Importación de Responsables',
  description: 'Simula carga de CSV y despliegue del resumen (sin escribir datos).',
  action: () => {
    console.log('[TEST] Importación de Responsables -> Mostrar resumen (mock)');
    toast.success('Simulación: resumen de importación desplegado');
  }
};
