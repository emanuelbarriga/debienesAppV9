import React from 'react';
import { Search, ArrowUpCircle, ArrowDownCircle, BanknoteIcon, UserCheck, UserX, FileText, Paintbrush, Download, Wand2, XCircle, Ban } from 'lucide-react';

interface TransactionFiltersProps {
  search: string;
  setSearch: (search: string) => void;
  filterType: 'all' | 'income' | 'expense';
  setFilterType: (type: 'all' | 'income' | 'expense') => void;
  filterResponsible: 'all' | 'assigned' | 'unassigned';
  // setFilterResponsible no se usa en el componente, pero lo mantenemos en la interfaz por compatibilidad
  setFilterResponsible: (type: 'all' | 'assigned' | 'unassigned') => void;
  filterDetails: 'all' | 'withObservaciones';
  setFilterDetails: (type: 'all' | 'withObservaciones') => void;
  // filterDocContable no se usa en el componente, pero lo mantenemos en la interfaz por compatibilidad
  filterDocContable: 'all' | 'withDoc' | 'withoutDoc';
  selectedAccount: string;
  setSelectedAccount: (account: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  uniqueAccounts: string[];
  uniqueYears: string[];
  availableMonths: { value: string; label: string }[];
  hideZeroValues: boolean;
  setHideZeroValues: (hide: boolean) => void;
  hideGravDesc: boolean;
  setHideGravDesc: (hide: boolean) => void;
  isColorDropdownOpen: boolean;
  setIsColorDropdownOpen: (isOpen: boolean) => void;
  selectedColors: Set<string>;
  handleColorToggle: (color: string) => void;
  handleResponsibleFilterClick: () => void;
  handleAutoAssign: () => Promise<void>;
  handleExportCSV: () => void;
  totalBalance?: number;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  search,
  setSearch,
  filterType,
  setFilterType,
  filterResponsible,
  // Renombrado con _ para indicar que es intencional pero no utilizado
  setFilterResponsible: _setFilterResponsible,
  filterDetails,
  setFilterDetails,
  // Renombrado con _ para indicar que es intencional pero no utilizado
  filterDocContable: _filterDocContable,
  selectedAccount,
  setSelectedAccount,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  uniqueAccounts,
  uniqueYears,
  availableMonths,
  hideZeroValues,
  setHideZeroValues,
  hideGravDesc,
  setHideGravDesc,
  isColorDropdownOpen,
  setIsColorDropdownOpen,
  selectedColors,
  handleColorToggle,
  handleResponsibleFilterClick,
  handleAutoAssign,
  handleExportCSV,
}) => {
  return (
    <div className="mb-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 w-full">
 
        <div className="flex flex-wrap gap-2 items-center w-full">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar transacciones..."
              className="w-full sm:w-[420px] pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 flex items-center justify-center ${
                filterType === 'all'
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Todas las transacciones"
            >
              <BanknoteIcon size={18} />
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-4 py-2 flex items-center justify-center ${
                filterType === 'income'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Ingresos"
            >
              <ArrowUpCircle size={18} />
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-4 py-2 flex items-center justify-center ${
                filterType === 'expense'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Egresos"
            >
              <ArrowDownCircle size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                style={{
                  backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16a2 2 0 0 1 2 2v6a10 10 0 0 1-10 10A10 10 0 0 1 2 11V5a2 2 0 0 1 2-2z"></path><polyline points="8 10 12 14 16 10"></polyline></svg>')`
                }}
                title="Seleccionar cuenta"
              >
                <option value="">Todas las cuentas</option>
                {uniqueAccounts.map((account) => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                style={{
                  backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>')`
                }}
                title="Seleccionar mes"
              >
                <option value="">Todos los meses</option>
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-no-repeat bg-[length:18px] bg-[center_left_8px]"
                style={{
                  backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>')`
                }}
                title="Seleccionar año"
              >
                <option value="all">Todos los años</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

         

          <div className="ml-auto flex gap-1 items-center">
          <button
            onClick={() => setHideZeroValues(!hideZeroValues)}
            className={`p-2 rounded-lg ${
              hideZeroValues
                ? 'bg-gray-200 text-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Mostrar valores 0"
          >
            <XCircle size={18} />
          </button>

          <button
            onClick={() => setHideGravDesc(!hideGravDesc)}
            className={`p-2 rounded-lg ${
              hideGravDesc
                ? 'bg-gray-200 text-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Mostrar GRAV"
          >
            <Ban size={18} />
          </button>
          <button
            onClick={handleResponsibleFilterClick}
            className={`p-2 rounded-lg ${
              filterResponsible === 'assigned'
                ? 'bg-green-100 text-green-700'
                : filterResponsible === 'unassigned'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={
              filterResponsible === 'all'
                ? 'Filtrar por responsables'
                : filterResponsible === 'assigned'
                ? 'Ver solo transacciones asignadas'
                : 'Ver solo transacciones sin asignar'
            }
          >
            {
              filterResponsible === 'unassigned' ? <UserX size={18} /> : <UserCheck size={18} />
            }
          </button>

          <button
            onClick={() => setFilterDetails(filterDetails === 'all' ? 'withObservaciones' : 'all')}
            className={`p-2 rounded-lg ${
              filterDetails === 'withObservaciones'
                ? 'bg-gray-200 text-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={filterDetails === 'all' ? 'Todos los detalles' : 'Solo con observaciones'}
          >
            <FileText size={18} />
          </button>
            <button
              onClick={handleAutoAssign}
              className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
              title="Asignar automáticamente usando códigos de detalle"
            >
              <Wand2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              title="Exportar a CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            
            <div className="relative">
              
            <button
              onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors duration-200 ${
                isColorDropdownOpen || selectedColors.size > 0
                  ? 'bg-gray-100 hover:bg-gray-200'
                  : 'bg-white hover:bg-gray-100 border border-gray-200'
              }`}
              title="Filtrar por estado"
            >
              <div className="flex items-center gap-1.5">
                <Paintbrush size={18} className="text-gray-600" />
                {!selectedColors.has('all') && (
                  <div className="flex -space-x-1">
                    {selectedColors.has('blue') && (
                      <div className="w-3 h-3 rounded-full bg-blue-400 border border-white" />
                    )}
                    {selectedColors.has('yellow') && (
                      <div className="w-3 h-3 rounded-full bg-yellow-400 border border-white" />
                    )}
                    {selectedColors.has('orange') && (
                      <div className="w-3 h-3 rounded-full bg-orange-400 border border-white" />
                    )}
                    {selectedColors.has('green') && (
                      <div className="w-3 h-3 rounded-full bg-green-400 border border-white" />
                    )}
                    {selectedColors.has('none') && (
                      <div className="w-3 h-3 rounded-full bg-gray-400 border border-white" />
                    )}
                  </div>
                )}
              </div>
            </button>

            {isColorDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedColors.has('all') ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                    onClick={() => handleColorToggle('all')}
                  >
                    <span className="flex-1">Todos</span>
                    <span className={`h-4 w-4 rounded-full border ${selectedColors.has('all') ? 'bg-gray-500' : 'bg-white'}`}></span>
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedColors.has('blue') ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                    onClick={() => handleColorToggle('blue')}
                  >
                    <span className="flex-1">Con resp. y doc. contable</span>
                    <span className="h-4 w-4 rounded-full bg-blue-500"></span>
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedColors.has('yellow') ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                    onClick={() => handleColorToggle('yellow')}
                  >
                    <span className="flex-1">Con resp. sin doc. contable</span>
                    <span className="h-4 w-4 rounded-full bg-yellow-500"></span>
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedColors.has('orange') ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                    onClick={() => handleColorToggle('orange')}
                  >
                    <span className="flex-1">Sin resp. con doc. contable</span>
                    <span className="h-4 w-4 rounded-full bg-orange-500"></span>
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedColors.has('green') ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                    onClick={() => handleColorToggle('green')}
                  >
                    <span className="flex-1">Sin resp. con observaciones</span>
                    <span className="h-4 w-4 rounded-full bg-green-500"></span>
                  </button>
                  <button
                    className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      selectedColors.has('none') ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    }`}
                    onClick={() => handleColorToggle('none')}
                  >
                    <span className="flex-1">Sin ninguna información</span>
                    <span className="h-4 w-4 rounded-full bg-white border border-gray-300"></span>
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
