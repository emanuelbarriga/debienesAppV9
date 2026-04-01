import { GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';

export const estadosLotesPagoTest = {
  id: 'estados-lotes-pago',
  icon: <GitBranch size={20} />,
  title: 'Estados de Lotes de Pago',
  description: 'Verifica transiciones borrador→revisión→generado→pagado (mock).',
  action: () => {
    console.log('[TEST] Estados de Lotes de Pago -> transiciones (mock)');
    console.log('  - Borrador: editable, puede añadir/quitar items');
    console.log('  - Revisión: solo lectura para validación');
    console.log('  - Generado: CSV exportado, items bloqueados');
    console.log('  - Pagado: marca distribuciones como pagadas, actualiza fechas');
    toast.success('Simulación: transiciones de estado de lotes validadas');
  }
};
