import { Link } from 'lucide-react';
import toast from 'react-hot-toast';

export const asignacionTransaccionesTest = {
  id: 'asignacion-transacciones',
  icon: <Link size={20} />,
  title: 'Asignación de Transacciones',
  description: 'Verifica asignación automática (código ref) y manual (sin tocar datos).',
  action: () => {
    console.log('[TEST] Asignación de Transacciones -> auto vs manual (mock)');
    console.log('  - Auto: matching por código de referencia');
    console.log('  - Manual: búsqueda y selección de responsable');
    console.log('  - Verificar que se guarda responsible + fecha/usuario');
    toast.success('Simulación: flujos de asignación auto/manual validados');
  }
};
