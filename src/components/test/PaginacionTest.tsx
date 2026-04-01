import { ChevronsUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

export const paginacionTest = {
  id: 'paginacion',
  icon: <ChevronsUpDown size={20} />,
  title: 'Paginación',
  description: 'Verifica cambio de página, ítems por página, navegación (mock).',
  action: () => {
    console.log('[TEST] Paginación -> navegación y límites (mock)');
    console.log('  - Cambio de página: next/prev/first/last');
    console.log('  - Ítems por página: 10/25/50/100');
    console.log('  - Mantener filtros al cambiar página');
    console.log('  - Deshabilitar botones en límites (primera/última)');
    toast.success('Simulación: paginación validada');
  }
};
