import { useState, useMemo, useEffect } from 'react';
import { useCollection } from '../hooks/useCollection';
import { Assignment, Transaction, Responsible, Account } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Trash2, Users, Brain, User } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/shared/Pagination';

function Assignments() {
  const { data: assignments, loading } = useCollection<Assignment>('assignments', {
    orderBy: [{ field: 'assignedAt', direction: 'desc' }]
  });
  const { data: transactions } = useCollection<Transaction>('transactions');
  const { data: responsibles } = useCollection<Responsible>('responsibles');
  const { data: accounts } = useCollection<Account>('accounts');
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [filterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAssignedBy, setFilterAssignedBy] = useState<'all' | 'auto' | 'manual'>('all');

  // Establecer cuenta por defecto
  useEffect(() => {
    if (transactions && transactions.length > 0 && !selectedAccount) {
      const firstAccount = transactions[0].accountName;
      setSelectedAccount(firstAccount);
    }
  }, [transactions]);

  // Establecer mes actual por defecto
  useEffect(() => {
    if (!selectedMonth) {
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      setSelectedMonth(currentMonth);
    }
  }, []);

  // Obtener cuentas únicas
  const uniqueAccounts = useMemo(() => {
    return [...new Set(transactions?.map(t => t.accountName) || [])].sort();
  }, [transactions]);

  // Obtener años únicos
  const uniqueYears = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map(t => {
      const [, , year] = t.fechaStr.split('/');
      return year;
    }).filter(Boolean))].sort((a, b) => (a || '').localeCompare(b || ''));
  }, [transactions]);

  // Obtener meses disponibles para el año seleccionado
  const availableMonths = useMemo(() => {
    if (!transactions) return [];
    return Array.from(new Set(
      transactions
        .filter(t => {
          const [,  , year] = t.fechaStr.split('/');
          return selectedYear === 'all' || year === selectedYear;
        })
        .map(t => {
          const [, month] = t.fechaStr.split('/');
          return month;
        })
    )).sort()
    .map(month => ({
      value: month,
      label: new Date(2000, parseInt(month) - 1).toLocaleString('es', { month: 'long' })
    }));
  }, [transactions, selectedYear]);

  const getTransactionDetails = (id: string) => 
    transactions?.find(t => t.id === id);

  const getResponsibleDetails = (id: string) =>
    responsibles?.find(r => r.id === id);

  const getAccountDetails = (id: string) =>
    accounts?.find(a => a.id === id);

  // Filtrado de asignaciones con useMemo
  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    
    return assignments.filter(assignment => {
      const transaction = getTransactionDetails(assignment.transactionId);
      const responsible = getResponsibleDetails(assignment.responsibleId);
      
      const matchesSearch = 
        transaction?.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
        responsible?.name?.toLowerCase().includes(search.toLowerCase()) ||
        assignment.responsibleType?.toLowerCase().includes(search.toLowerCase());

      // Filtro por cuenta
      const matchesAccount = selectedAccount === '' || 
        transaction?.accountName === selectedAccount;

      // Filtro por fecha
      const [, month, year] = (transaction?.fechaStr || '').split('/');
      const matchesDate = (selectedMonth === '' || month === selectedMonth) &&
                         (selectedYear === 'all' || year === selectedYear);

      // Filtro por tipo de asignación (AUTO/MANUAL)
      const matchesAssignedBy = filterAssignedBy === 'all' || 
        (filterAssignedBy === 'auto' && assignment.assignmentMethod === 'automatic') ||
        (filterAssignedBy === 'manual' && assignment.assignmentMethod !== 'automatic');

      // Filtro por tipo de transacción (INGRESO/EGRESO)
      const matchesType = filterType === 'all' 
        ? true 
        : filterType === 'income' 
          ? (transaction?.valor || 0) > 0 
          : (transaction?.valor || 0) < 0;

      return matchesSearch && matchesAccount && matchesDate && matchesAssignedBy && matchesType;
    });
  }, [
    assignments,
    transactions,
    responsibles,
    search,
    selectedAccount,
    selectedMonth,
    selectedYear,
    filterAssignedBy,
    filterType
  ]);

  // Paginación
  const {
    currentPage,
    totalPages,
    pageItems: paginatedAssignments,
    setCurrentPage,
    setItemsPerPage,
    itemsPerPage,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    pageNumbers
  } = usePagination(filteredAssignments, {
    itemsPerPage: 25,
    maxPages: 5
  });

  const getTotalAssigned = () => {
    if (!filteredAssignments) return 0;
    return filteredAssignments.reduce((sum, assignment) => {
      const transaction = getTransactionDetails(assignment.transactionId);
      return sum + (transaction?.valor || 0);
    }, 0);
  };

  const formatDate = (dateStr: any) => {
    try {
      // Si es un Timestamp de Firestore
      if (dateStr && typeof dateStr === 'object' && 'seconds' in dateStr) {
        const date = new Date(dateStr.seconds * 1000);
        return format(date, 'dd MMM yyyy', { locale: es });
      }
      
      // Si la fecha está en formato DD/MM/YYYY
      if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/').map(num => num.trim());
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return format(date, 'dd MMM yyyy', { locale: es });
      }
      
      // Para otros formatos de fecha
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      return format(date, 'dd MMM yyyy', { locale: es });
    } catch (error) {
      console.error('Error al formatear fecha:', error, 'para la fecha:', dateStr);
      return 'Fecha inválida';
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await deleteDoc(doc(db, 'assignments', assignmentId));
      toast.success('Asignación eliminada exitosamente');
    } catch (error) {
      console.error('Error al eliminar la asignación:', error);
      toast.error('Error al eliminar la asignación');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Historial de Asignaciones</h1>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar asignaciones..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-1">
              {/* Filtro de cuenta */}
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                style={{
                  backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>')`
                }}
              >
                <option value="">Todas las cuentas</option>
                {uniqueAccounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>

              {/* Filtro de mes */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                style={{
                  backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>')`
                }}
              >
                <option value="">Todos los meses</option>
                {availableMonths.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </option>
                ))}
              </select>

              {/* Filtro de año */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                style={{
                  backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>')`
                }}
              >
                <option value="all">Todos los años</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {/* Filtro de asignación AUTO/MANUAL */}
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setFilterAssignedBy('all')}
                  className={`px-3 py-2 ${
                    filterAssignedBy === 'all'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Todas las asignaciones"
                >
                  <Users size={18} />
                </button>
                <button
                  onClick={() => setFilterAssignedBy('auto')}
                  className={`px-3 py-2 ${
                    filterAssignedBy === 'auto'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Asignación Automática"
                >
                  <Brain size={18} />
                </button>
                <button
                  onClick={() => setFilterAssignedBy('manual')}
                  className={`px-3 py-2 ${
                    filterAssignedBy === 'manual'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Asignación Manual"
                >
                  <User size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <br></br>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Asignaciones</div>
          <div className="text-2xl font-bold">{filteredAssignments?.length || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Monto Total Asignado</div>
          <div className={`text-2xl font-bold ${getTotalAssigned() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${Math.abs(getTotalAssigned()).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Última Asignación</div>
          <div className="text-2xl font-bold">
            {assignments && assignments.length > 0
              ? formatDate(assignments[0].assignedAt)
              : 'Sin asignaciones'}
          </div>
        </div>
      </div>

   

      <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de Asignación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de Transacción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transacción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cuenta
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Responsable
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Asignado Por
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Observaciones
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedAssignments.map((assignment) => {
              const transaction = getTransactionDetails(assignment.transactionId);
              const responsible = getResponsibleDetails(assignment.responsibleId);
              const account = transaction ? getAccountDetails(transaction.accountId) : null;
              
              // Debug de la fecha de transacción
              if (transaction) {
                console.log('Fecha de transacción:', {
                  original: transaction.fecha,
                  tipo: typeof transaction.fecha
                });
              }
              
              return (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(assignment.assignedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction?.fecha ? formatDate(transaction.fecha) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                    {transaction?.descripcion || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={transaction?.valor && transaction.valor >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${Math.abs(transaction?.valor || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account?.nombre || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {responsible?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {assignment.assignedBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction?.observaciones || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => assignment.id && handleDeleteAssignment(assignment.id)}
                      className="text-red-600 hover:text-red-900 transition-colors duration-200"
                      title="Eliminar asignación"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          onPageChange={setCurrentPage}
          onFirstPage={goToFirstPage}
          onLastPage={goToLastPage}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredAssignments.length}
        />
      </div>
    </div>
  );
}

export default Assignments;