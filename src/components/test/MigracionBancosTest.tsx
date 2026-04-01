import { ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export const migracionBancosTest = {
  id: 'migracion-bancos',
  icon: <ArrowRightLeft size={20} />,
  title: 'Migración de Bancos',
  description: 'Valida normalización de nombres de bancos (BBVA→BBVA COLOMBIA) (mock).',
  action: () => {
    console.log('[TEST] Migración de Bancos -> normalización (mock)');
    console.log('  - Detectar variantes: BBVA, Banco BBVA, BBVA Colombia');
    console.log('  - Normalizar a catálogo oficial');
    console.log('  - Actualizar cuentas y balances existentes');
    console.log('  - Resumen: X cuentas migradas');
    toast.success('Simulación: migración de bancos validada');
  }
};
