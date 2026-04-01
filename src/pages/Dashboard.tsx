import { useState, useMemo, useEffect, useRef } from "react";
import { useCollection } from '../hooks/useCollection';
import { Transaction, Responsible, Assignment } from '../types'; // Assuming these are well-defined
import { Users, Activity, BarChart3, FileSpreadsheet, Building2, Home, CircleDot, CheckCircle2 } from 'lucide-react';

// --- Definiciones de Tipos y Constantes ---

// Extensión del tipo Transaction para incluir propiedades pre-procesadas
interface ProcessedTransaction extends Transaction {
  month: string;
  year: string;
  isZeroValue: boolean;
  isGravamen: boolean;
  isValid: boolean;
}

// Tipo para las métricas por cuenta
interface AccountMetrics {
  total: number;
  ingresos: number;
  egresos: number;
  count: number;
  validCount: number;
  zeroCount: number;
  gravCount: number;
  assignedCount: number;
  assignmentPercentage: number;
}

// Tipo para las métricas de rendimiento
interface PerformanceMetrics {
  loadTime: string;
  processingTime: string;
  metricsCalcTime: string;
  transactionCount: number;
  responsiblesCount: number;
  assignmentsCount: number;
}

// Mapa para los tipos de responsables (mejora la legibilidad y mantenimiento)
const RESPONSIBLE_TYPE_MAP: Record<string, { label: string; icon: React.ElementType }> = {
  tenant: { label: 'Arrendatarios', icon: Home },
  owner: { label: 'Propietarios', icon: Building2 },
  admin: { label: 'Administración', icon: CircleDot },
  other: { label: 'Otros', icon: Users },
};

// Utilidad para log de rendimiento
const PerformanceLogger = {
  start: (label: string) => {
    console.time(`⏱️ ${label}`);
  },
  end: (label: string) => {
    console.timeEnd(`⏱️ ${label}`);
  },
  log: (message: string, data?: any) => {
    console.log(`📊 ${message}`, data || '');
  }
};

// Panel principal de control
function Dashboard() {
  // Referencias para métricas de rendimiento
  const renderCountRef = useRef(0);
  // Incrementamos el contador de renderizado al inicio de cada render.
  renderCountRef.current += 1;

  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    loadTime: '0ms',
    processingTime: '0ms',
    metricsCalcTime: '0ms',
    transactionCount: 0,
    responsiblesCount: 0,
    assignmentsCount: 0
  });

  const { data: rawTransactions, loading: transactionsLoading } = useCollection<Transaction>('transactions');
  const { data: responsibles, loading: responsiblesLoading } = useCollection<Responsible>('responsibles');
  const { data: assignments, loading: assignmentsLoading } = useCollection<Assignment>('assignments');

  // Estado combinado de carga para una mejor UX
  const isLoading = transactionsLoading || responsiblesLoading || assignmentsLoading;

  // Log de inicio de renderizado (este useEffect solo loguea, no actualiza estado)
  useEffect(() => {
    PerformanceLogger.log(`Renderizado #${renderCountRef.current}`);
  }); // Sin array de dependencias para que se ejecute en cada render y loguee.

  // Estado para el mes y año seleccionados
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth.toString().padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return new Date().getFullYear().toString();
  });

  // Pre-procesamiento de Transacciones (una única vez, eficiente)
  const { processedTransactions, processingTimeValue } = useMemo(() => {
    PerformanceLogger.start('Procesamiento Transacciones');
    if (!rawTransactions) {
      PerformanceLogger.end('Procesamiento Transacciones');
      return { processedTransactions: [], processingTimeValue: '0ms' };
    }

    const startTime = performance.now();
    const result = rawTransactions.map(t => {
      const fechaParts = t.fechaStr?.split('/') || ['', '', ''];
      const [, month = '', year = ''] = fechaParts;
      const descripcionUpper = t.descripcion?.toUpperCase() || '';
      const isGravamen =
        descripcionUpper.includes('GRAV') ||
        descripcionUpper.includes('IVA SOBRE COMISIONES') ||
        descripcionUpper.includes('COMISION TRANSFERENCIAS');
      const isZeroValue = t.valor === 0;
      const isValid = !isZeroValue && !isGravamen;
      return { ...t, month, year, isZeroValue, isGravamen, isValid };
    });

    const endTime = performance.now();
    const timeTaken = `${(endTime - startTime).toFixed(2)}ms`;
    PerformanceLogger.log(`Transacciones procesadas: ${rawTransactions.length}`);
    PerformanceLogger.log(`Tiempo de procesamiento: ${timeTaken}`);
    PerformanceLogger.end('Procesamiento Transacciones');

    return { processedTransactions: result, processingTimeValue: timeTaken };
  }, [rawTransactions]);

  const transactions: ProcessedTransaction[] = processedTransactions;

  // Obtener años únicos de las transacciones
  const uniqueYears = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return [...new Set(transactions.map(t => t.year))].sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Obtener meses disponibles para el año seleccionado
  const availableMonths = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const monthsInYear = transactions
      .filter(t => t.year === selectedYear)
      .map(t => t.month);
    const uniqueSortedMonths = Array.from(new Set(monthsInYear)).sort();
    return uniqueSortedMonths.map(month => ({
      value: month,
      label: new Date(2000, parseInt(month) - 1).toLocaleString('es', { month: 'long' })
    }));
  }, [transactions, selectedYear]);

  // Ajustar 'selectedMonth' si es necesario
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.some(m => m.value === selectedMonth)) {
      setSelectedMonth(availableMonths[0].value);
    }
  }, [availableMonths, selectedMonth]);

  // Calcular métricas y medir tiempo
  const { calculatedMetrics, metricsCalcTimeValue } = useMemo(() => {
    PerformanceLogger.start('Cálculo de Métricas');
    if (isLoading || !transactions || !responsibles || !assignments) {
      PerformanceLogger.end('Cálculo de Métricas');
      return { calculatedMetrics: null, metricsCalcTimeValue: '0ms' };
    }

    const startTime = performance.now();
    const filteredTransactions = transactions.filter(t =>
      t.month === selectedMonth && t.year === selectedYear
    );

    if (filteredTransactions.length === 0) {
      PerformanceLogger.end('Cálculo de Métricas');
      return { calculatedMetrics: null, metricsCalcTimeValue: '0ms' };
    }

    // OPTIMIZACIÓN CLAVE: Crear un mapa para búsqueda O(1) de transacciones por ID
    const transactionsById = transactions.reduce((map: Record<string, ProcessedTransaction>, t) => {
      map[t.id] = t;
      return map;
    }, {});

    const assignedTransactionIdsForMonth = new Set(
      assignments
        .filter(assignment => {
          // Usar el mapa para evitar el find() costoso en cada iteración
          const transaction = transactionsById[assignment.transactionId];
          return transaction && transaction.month === selectedMonth && transaction.year === selectedYear;
        })
        .map(a => a.transactionId)
    );

    const accountTotals = filteredTransactions.reduce((acc, t) => {
      const accountName = t.accountName || 'Sin cuenta';
      if (!acc[accountName]) {
        acc[accountName] = {
          total: 0, ingresos: 0, egresos: 0,
          count: 0, validCount: 0, zeroCount: 0, gravCount: 0,
          assignedCount: 0, assignmentPercentage: 0
        };
      }
      acc[accountName].total += t.valor;
      if (t.valor > 0) { acc[accountName].ingresos += t.valor; } else { acc[accountName].egresos += Math.abs(t.valor); }
      acc[accountName].count++;
      if (t.isValid) {
        acc[accountName].validCount++;
        if (assignedTransactionIdsForMonth.has(t.id)) { acc[accountName].assignedCount++; }
      } else if (t.isZeroValue) { acc[accountName].zeroCount++; } else if (t.isGravamen) { acc[accountName].gravCount++; }
      return acc;
    }, {} as Record<string, AccountMetrics>);

    Object.values(accountTotals).forEach(account => {
      account.assignmentPercentage = account.validCount > 0 ? (account.assignedCount / account.validCount) * 100 : 0;
    });

    const totalAmount = Object.values(accountTotals).reduce((sum, account) => sum + account.total, 0);
    const totalIngresos = Object.values(accountTotals).reduce((sum, account) => sum + account.ingresos, 0);
    const totalEgresos = Object.values(accountTotals).reduce((sum, account) => sum + account.egresos, 0);
    const totalTransactions = Object.values(accountTotals).reduce((sum, account) => sum + account.validCount, 0);
    const totalAssignedTransactions = Object.values(accountTotals).reduce((sum, account) => sum + account.assignedCount, 0);
    const assignmentPercentage = totalTransactions > 0 ? (totalAssignedTransactions / totalTransactions) * 100 : 0;
    const responsiblesByType = responsibles.reduce((acc, r) => {
      const type = r.type && RESPONSIBLE_TYPE_MAP[r.type] ? r.type : 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const result = {
      totalAmount, totalIngresos, totalEgresos, accountTotals,
      totalTransactions, totalAssignedTransactions, assignmentPercentage,
      responsiblesByType, totalResponsibles: responsibles.length
    };

    const endTime = performance.now();
    const timeTaken = `${(endTime - startTime).toFixed(2)}ms`;
    PerformanceLogger.log(`Métricas calculadas para ${filteredTransactions.length} transacciones`);
    PerformanceLogger.log(`Tiempo de cálculo: ${timeTaken}`);
    PerformanceLogger.end('Cálculo de Métricas');

    return { calculatedMetrics: result, metricsCalcTimeValue: timeTaken };
  }, [transactions, responsibles, assignments, selectedMonth, selectedYear, isLoading]);

  const metrics = calculatedMetrics;

  // Variable para almacenar el tiempo de inicio de carga (inicializa una sola vez)
  const loadStartTimeRef = useRef(performance.now());

  // Único useEffect para actualizar TODAS las métricas de rendimiento en el estado
  // Esto minimiza las re-renderizaciones causadas por setPerformanceMetrics
  useEffect(() => {
    const newPerformanceState: Partial<PerformanceMetrics> = {
      processingTime: processingTimeValue,
      transactionCount: rawTransactions?.length || 0,
      responsiblesCount: responsibles?.length || 0,
      assignmentsCount: assignments?.length || 0,
    };

    if (metrics) {
      newPerformanceState.metricsCalcTime = metricsCalcTimeValue;
    } else {
      newPerformanceState.metricsCalcTime = '0ms'; // Reiniciar si no hay métricas para el período actual
    }

    // Calcular el tiempo de carga total solo una vez al final de la carga
    if (!isLoading && rawTransactions && responsibles && assignments && performanceMetrics.loadTime === '0ms') {
      newPerformanceState.loadTime = `${(performance.now() - loadStartTimeRef.current).toFixed(0)}ms`;
      PerformanceLogger.log(`Tiempo total de carga: ${newPerformanceState.loadTime}`);
    }

    setPerformanceMetrics(prev => ({
      ...prev,
      ...newPerformanceState
    }));
  }, [
    processingTimeValue,
    rawTransactions,
    metrics,
    metricsCalcTimeValue,
    responsibles,
    assignments,
    isLoading,
    performanceMetrics.loadTime // Se incluye para asegurar que se re-evalúe cuando se establece el loadTime
  ]);

  // Componente del botón flotante para mostrar/ocultar el panel de rendimiento
  const PerformanceButton = () => (
    <button
      onClick={() => setShowPerformancePanel(prev => !prev)}
      className="fixed bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg z-50 flex items-center justify-center"
      title="Mostrar métricas de rendimiento"
    >
      <Activity className="w-5 h-5" />
    </button>
  );

  // Componente del panel de métricas de rendimiento
  const PerformancePanel = () => (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-300 z-50 max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-800 flex items-center">
          <Activity className="w-4 h-4 mr-1" /> Métricas de Rendimiento
        </h3>
        <button
          onClick={() => setShowPerformancePanel(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="font-medium">Renderizados:</span>
          <span className="text-blue-600">{renderCountRef.current}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Tiempo de carga:</span>
          <span className="text-green-600">{performanceMetrics.loadTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Procesamiento de datos:</span>
          <span className="text-amber-600">{performanceMetrics.processingTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Cálculo de métricas:</span>
          <span className="text-purple-600">{performanceMetrics.metricsCalcTime}</span>
        </div>
        <hr className="my-1" />
        <div className="flex justify-between">
          <span className="font-medium">Transacciones:</span>
          <span>{performanceMetrics.transactionCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Responsables:</span>
          <span>{performanceMetrics.responsiblesCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Asignaciones:</span>
          <span>{performanceMetrics.assignmentsCount}</span>
        </div>
      </div>
    </div>
  );

  // --- Renderizado Condicional según el estado de carga y datos ---

  if (isLoading) {
    return (
      <div className="text-center py-10">
        {showPerformancePanel && <PerformancePanel />}
        <PerformanceButton />
        <p className="text-lg text-gray-600">Cargando datos del panel de control...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mt-4"></div>
      </div>
    );
  }

  // Verificar si las colecciones iniciales están vacías/nulas
  if (!transactions || transactions.length === 0 || !responsibles || responsibles.length === 0 || !assignments) {
    return (
      <div className="text-center py-10">
        {showPerformancePanel && <PerformancePanel />}
        <PerformanceButton />
        <p className="text-lg text-gray-600">No hay datos disponibles para mostrar el panel de control.</p>
        <p className="text-md text-gray-500 mt-2">Asegúrate de que las colecciones de 'transactions', 'responsibles' y 'assignments' contengan datos en la base de datos.</p>
      </div>
    );
  }

  // Verificar si no hay métricas para el mes y año seleccionados
  if (!metrics) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        {showPerformancePanel && <PerformancePanel />}
        <PerformanceButton />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
          <div className="flex gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {uniqueYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-center py-10">
          <p className="text-lg text-gray-600">No hay transacciones válidas para el mes y año seleccionados ({availableMonths.find(m => m.value === selectedMonth)?.label || 'N/A'} de {selectedYear}).</p>
          <p className="text-md text-gray-500 mt-2">Intenta seleccionar otro período o verifica que haya transacciones para este mes.</p>
        </div>
      </div>
    );
  }

  // --- Renderizado del Dashboard (solo si hay métricas disponibles) ---
  return (
    <div className="space-y-6">
      {showPerformancePanel && <PerformancePanel />}
      <PerformanceButton />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>

        <div className="flex gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {uniqueYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableMonths.map(month => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjeta de Transacciones Válidas */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Transacciones Válidas</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.totalTransactions}</p>
            </div>
            <FileSpreadsheet className="h-8 w-8 text-blue-500" />
          </div>

          <div className="space-y-4">
            {Object.entries(metrics.accountTotals).map(([account, data]) => (
              <div key={account} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">{account}</h3>
                  <span className="text-sm font-medium text-gray-900">Registros: {data.count}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center justify-center p-2 bg-blue-50 rounded-lg">
                    <span className="text-lg font-semibold text-blue-600">{data.validCount}</span>
                    <span className="text-xs text-blue-600 font-medium">Válidas</span>
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 bg-amber-50 rounded-lg">
                    <span className="text-lg font-semibold text-amber-600">{data.zeroCount}</span>
                    <span className="text-xs text-amber-600 font-medium">Saldos</span>
                  </div>

                  <div className="flex flex-col items-center justify-center p-2 bg-purple-50 rounded-lg">
                    <span className="text-lg font-semibold text-purple-600">{data.gravCount}</span>
                    <span className="text-xs text-purple-600 font-medium">Gravamenes</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                    <div className="flex h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500" style={{ width: `${(data.validCount / data.count) * 100 || 0}%` }} />
                      <div className="bg-amber-500" style={{ width: `${(data.zeroCount / data.count) * 100 || 0}%` }} />
                      <div className="bg-purple-500" style={{ width: `${(data.gravCount / data.count) * 100 || 0}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{((data.validCount / data.count) * 100 || 0).toFixed(1)}%</span>
                    <span>{((data.zeroCount / data.count) * 100 || 0).toFixed(1)}%</span>
                    <span>{((data.gravCount / data.count) * 100 || 0).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta de Montos */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monto Total</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${metrics.totalAmount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-medium text-green-600">
              Ingresos: ${metrics.totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm font-medium text-red-600">
              Egresos: ${metrics.totalEgresos.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {Object.entries(metrics.accountTotals).map(([account, data]) => (
              <div key={account} className="border-t pt-2">
                <div className="text-sm font-medium text-gray-900">{account}</div>
                <div className="text-sm text-gray-600 flex justify-between">
                  <span>Total:</span>
                  <span>${data.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-sm text-green-600 flex justify-between">
                  <span>Ingresos:</span>
                  <span>${data.ingresos.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-sm text-red-600 flex justify-between">
                  <span>Egresos:</span>
                  <span>${data.egresos.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta de Responsables */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Responsables</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.totalResponsibles}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-4 space-y-1">
            {Object.entries(RESPONSIBLE_TYPE_MAP).map(([key, { label, icon: Icon }]) => (
              <div key={key} className="text-sm text-gray-600 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Icon className="w-4 h-4" /> {label}:
                </span>
                <span>{metrics.responsiblesByType[key] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta de Asignaciones (REESTRUCTURADA) */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Asignaciones</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metrics.totalAssignedTransactions} / {metrics.totalTransactions}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-500 h-2.5 rounded-full"
                style={{ width: `${metrics.assignmentPercentage}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {metrics.assignmentPercentage.toFixed(1)}% asignadas
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {Object.entries(metrics.accountTotals).map(([account, data]) => (
              <div key={account} className="border-t pt-2">
                <div className="text-sm text-gray-600 flex flex-col">
                  <div className="flex justify-between font-medium">
                    <span>{account}:</span>
                    <span>{data.assignedCount} / {data.validCount}</span>
                  </div>
                </div>
              </div>
            ))}
            {/* General assignment summary, moved outside the account map */}
            <div className="mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 bg-indigo-500 rounded-full"></span>
                <span>Transacciones asignadas: {metrics.totalAssignedTransactions}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-3 w-3 bg-gray-300 rounded-full"></span>
                <span>Transacciones sin asignar: {metrics.totalTransactions - metrics.totalAssignedTransactions}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;