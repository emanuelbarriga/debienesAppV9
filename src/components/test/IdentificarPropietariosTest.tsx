import { UserSearch } from 'lucide-react';
import toast from 'react-hot-toast';

export const identificarPropietariosTest = {
  id: 'identificar-propietarios',
  icon: <UserSearch size={20} />,
  title: 'Identificación de Propietarios',
  description: 'Valida modal de identificación con NITs desconocidos (mock: link/create/skip).',
  action: () => {
    console.log('[TEST] Identificación de Propietarios -> opciones link/create/skip (mock)');
    console.log('  - Vinculación con propietario existente');
    console.log('  - Creación de nuevo propietario');
    console.log('  - Omitir propietario');
    toast.success('Simulación: modal de identificación con 3 opciones validado');
  }
};
