import { CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export const validacionFormulariosTest = {
  id: 'validacion-formularios',
  icon: <CheckSquare size={20} />,
  title: 'Validación de Formularios',
  description: 'Valida campos requeridos y formatos (NIT, email, teléfono, montos) (mock).',
  action: () => {
    console.log('[TEST] Validación de Formularios -> campos y formatos (mock)');
    console.log('  - NIT: solo números, sin puntos/guiones');
    console.log('  - Email: formato válido');
    console.log('  - Teléfono: formato flexible');
    console.log('  - Montos: parseo COP ($ 1.234.567,00)');
    console.log('  - Fechas: formato DD/MM/YYYY');
    toast.success('Simulación: validaciones de formularios verificadas');
  }
};
