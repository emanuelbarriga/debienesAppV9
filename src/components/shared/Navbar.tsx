// React se importa automáticamente al usar JSX en configuraciones modernas
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { LogOut, LayoutDashboard, FileSpreadsheet, Users, Building2, Wallet } from 'lucide-react';
import { useAuthState } from '../../hooks/useAuthState';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthState();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/iniciar-sesion');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (!user) return null;

  const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Panel' },
    { path: '/transacciones', icon: <FileSpreadsheet size={20} />, label: 'Transacciones' },
    // { path: '/t2', icon: <FileSpreadsheet size={20} />, label: 'T2' }, // Oculto temporalmente
    { path: '/responsables', icon: <Users size={20} />, label: 'Responsables' },
    // { path: '/responsables2', icon: <Users size={20} />, label: 'R2' }, // Oculto temporalmente
    { path: '/cuentas', icon: <Building2 size={20} />, label: 'Cuentas' },
    { path: '/cuentas-propietarios', icon: <Wallet size={20} />, label: 'Cuentas de Propietarios' },
    // { path: '/asignaciones', icon: <ClipboardList size={20} />, label: 'Asignaciones' }, // Oculto temporalmente
    // { path: '/registros', icon: <Activity size={20} />, label: 'Registros' }, // Oculto temporalmente
    // { path: '/tests', icon: <TestTube2 size={20} />, label: 'Pruebas' }, // Oculto temporalmente
  ];

  return (
    <>
      <nav className="bg-white/80 backdrop-blur-sm fixed w-full top-0 z-50 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link 
                to="/" 
                className="text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
              >
                Debienes App V1.0
              </Link>
              <div className="hidden lg:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
                      location.pathname === item.path
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      {/* Espaciador para evitar que el contenido se oculte detrás del navbar */}
      <div className="h-16"></div>
    </>
  );
}

export default Navbar;