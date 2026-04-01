import { useState } from 'react';
import { Wallet, Building2, BarChart3, Clock, CheckCircle2 } from 'lucide-react';
import OwnerAccountsTab from '../modules/owners/components/OwnerAccountsTab';
import MonthlyBalancesTab from '../modules/finance/components/MonthlyBalancesTab';
import PaymentBatchesTab from '../modules/finance/components/PaymentBatchesTab';
import AnnualReportsTab from '../modules/finance/components/AnnualReportsTab';

type Tab = 'cuentas' | 'saldos' | 'porpagar' | 'pagados' | 'reportes';

export default function OwnerAccounts() {
  const [activeTab, setActiveTab] = useState<Tab>('cuentas');

  const tabs = [
    { id: 'cuentas' as Tab, label: 'Cuentas Bancarias', icon: Wallet },
    { id: 'saldos' as Tab, label: 'Saldos Mensuales', icon: Building2 },
    { id: 'porpagar' as Tab, label: 'Por Pagar', icon: Clock },
    { id: 'pagados' as Tab, label: 'Pagados', icon: CheckCircle2 },
    { id: 'reportes' as Tab, label: 'Reportes Anuales', icon: BarChart3 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cuentas de Propietarios</h1>
        <p className="mt-2 text-gray-600">
          Gestión de cuentas bancarias, saldos mensuales y pagos a propietarios
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                  transition-colors duration-200
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {activeTab === 'cuentas' && <OwnerAccountsTab />}
        {activeTab === 'saldos' && <MonthlyBalancesTab />}
        {activeTab === 'porpagar' && <PaymentBatchesTab defaultStatusFilter="pendiente" />}
        {activeTab === 'pagados' && <PaymentBatchesTab defaultStatusFilter="pagado" />}
        {activeTab === 'reportes' && <AnnualReportsTab />}
      </div>

      {/* Botón de Migración (flotante) - OCULTO, migración completada */}
      {/* <BatchMigrationButton /> */}
    </div>
  );
}
