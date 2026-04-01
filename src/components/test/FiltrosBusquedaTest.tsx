import { Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export const filtrosBusquedaTest = {
  id: 'filtros-busqueda',
  icon: <Filter size={20} />,
  title: 'Filtros y Búsqueda',
  description: 'Valida filtros por tipo, estado, banco, búsqueda por texto (mock).',
  action: () => {
    console.log('[TEST] Filtros y Búsqueda -> múltiples criterios (mock)');
    console.log('  - Búsqueda por texto: nombre, NIT, email');
    console.log('  - Filtro por tipo: tenant/owner/admin');
    console.log('  - Filtro por estado contrato: activo/vencido/próximo');
    console.log('  - Filtro por banco en balances');
    console.log('  - Combinación de filtros');
    toast.success('Simulación: filtros y búsqueda validados');
  }
};
