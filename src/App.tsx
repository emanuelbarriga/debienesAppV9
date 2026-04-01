//import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/shared/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Transactions2 from './pages/Transactions2.tsx';
import Responsibles from './pages/Responsibles';
// import Responsibles2 from './pages/Responsibles2';
import Accounts from './pages/Accounts';
import Assignments from './pages/Assignments';
import Logs from './pages/Logs';
import Tests from './pages/Tests';
import OwnerAccounts from './pages/OwnerAccounts';
import ProtectedRoute from './components/shared/ProtectedRoute';

// Componente principal de la aplicación
function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/iniciar-sesion" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transacciones" element={<Transactions />} />
              <Route path="/t2" element={<Transactions2 />} />
              <Route path="/responsables" element={<Responsibles />} />
              {/* <Route path="/responsibles2" element={<Responsibles2 />} /> */}
              <Route path="/cuentas" element={<Accounts />} />
              <Route path="/cuentas-propietarios" element={<OwnerAccounts />} />
              <Route path="/asignaciones" element={<Assignments />} />
              <Route path="/registros" element={<Logs />} />
              <Route path="/tests" element={<Tests />} />
            </Route>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;