import { Navigate, Outlet } from 'react-router-dom';
import { useAuthState } from '../../hooks/useAuthState';

// Componente para proteger rutas que requieren autenticación
function ProtectedRoute() {
  const { user, loading } = useAuthState();

  // Mostrar indicador de carga mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Redirigir a la página de inicio de sesión si no hay usuario autenticado
  if (!user) {
    return <Navigate to="/iniciar-sesion" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;