import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Layout from './components/shared/Layout';

// Carga diferida (Lazy loading) de páginas
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Transactions2 = lazy(() => import('./pages/Transactions2'));
const Responsibles = lazy(() => import('./pages/Responsibles'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Assignments = lazy(() => import('./pages/Assignments'));
const Logs = lazy(() => import('./pages/Logs'));
const Tests = lazy(() => import('./pages/Tests'));
const OwnerAccounts = lazy(() => import('./pages/OwnerAccounts'));

// Componente de carga para Suspense
const LoadingFallback = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Componente principal de la aplicación
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública: Login sin Layout (sin Navbar) */}
        <Route
          path="/iniciar-sesion"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Login />
            </Suspense>
          }
        />

        {/* Rutas protegidas: con Layout (Navbar + Toaster + main container) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transacciones" element={<Transactions />} />
            <Route path="/t2" element={<Transactions2 />} />
            <Route path="/responsables" element={<Responsibles />} />
            <Route path="/cuentas" element={<Accounts />} />
            <Route path="/cuentas-propietarios" element={<OwnerAccounts />} />
            <Route path="/asignaciones" element={<Assignments />} />
            <Route path="/registros" element={<Logs />} />
            <Route path="/tests" element={<Tests />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;