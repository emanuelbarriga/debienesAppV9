import React, { useState, useEffect } from 'react';
import { Transaction } from '../../../types';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { X, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface TransactionDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

interface DiagnosticResult {
  key: string;
  count: number;
  transactions: Transaction[];
  isExpanded: boolean;
  isHighRisk: boolean;
  hasClassified: boolean; // Indica si alguna transacción del grupo ya está asignada a un responsable
}

const TransactionDiagnosticModal: React.FC<TransactionDiagnosticModalProps> = ({
  isOpen,
  onClose,
  accountId
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState({
    totalAnalyzed: 0,
    potentialDuplicates: 0,
    highRiskGroups: 0,
    affectedTransactions: 0,
    assignedTransactions: 0
  });
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<{value: string, label: string}[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && accountId) {
      runDiagnostic(accountId);
    } else {
      setDiagnosticResults([]);
      setSummary({
        totalAnalyzed: 0,
        potentialDuplicates: 0,
        highRiskGroups: 0,
        affectedTransactions: 0,
        assignedTransactions: 0
      });
    }
  }, [isOpen, accountId]);

  const runDiagnostic = async (accountId: string) => {
    setIsLoading(true);
    try {
      // Obtener todas las transacciones de la cuenta
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('accountId', '==', accountId));
      const snapshot = await getDocs(q);
      
      const allTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];

      // Extraer los años y meses disponibles
      const months = new Set<string>();
      const years = new Set<string>();
      
      allTransactions.forEach(transaction => {
        if (transaction.fechaStr) {
          const [, month, year] = transaction.fechaStr.split('/');
          if (month) months.add(month);
          if (year) years.add(year);
        }
      });
      
      // Convertir meses a formato para el select
      const monthOptions = Array.from(months).sort().map(month => ({
        value: month,
        label: new Date(2000, parseInt(month) - 1).toLocaleString('es', { month: 'long' })
      }));
      
      // Años disponibles (ordenados de más reciente a más antiguo)
      const yearsList = Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
      
      setAvailableMonths(monthOptions);
      setAvailableYears(yearsList);
      
      // Filtrar por año y mes si están seleccionados
      let transactions = allTransactions;
      
      if (filterYear || filterMonth) {
        transactions = allTransactions.filter(transaction => {
          if (!transaction.fechaStr) return false;
          
          const [, month, year] = transaction.fechaStr.split('/');
          
          // Aplicar filtro por año si está seleccionado
          if (filterYear && year !== filterYear) return false;
          
          // Aplicar filtro por mes si está seleccionado
          if (filterMonth && month !== filterMonth) return false;
          
          return true;
        });
      }

      // Agrupar transacciones por características similares
      const groups: Record<string, Transaction[]> = {};
      
      transactions.forEach(transaction => {
        // Usar múltiples claves para detectar diferentes tipos de duplicados
        const keysByFecha = `fecha:${transaction.fechaStr}|valor:${transaction.valor}|desc:${transaction.descripcion}`;
        const keysByValor = `valor:${transaction.valor}|desc:${transaction.descripcion}`;
        
        // Agrupar por fecha + valor + descripción
        if (!groups[keysByFecha]) {
          groups[keysByFecha] = [];
        }
        groups[keysByFecha].push(transaction);
        
        // También agrupar solo por valor + descripción para detectar posibles duplicados con fechas distintas
        if (!groups[keysByValor]) {
          groups[keysByValor] = [];
        }
        groups[keysByValor].push(transaction);
      });

      // Filtrar solo grupos con más de una transacción y convertir a formato para el modal
      const results: DiagnosticResult[] = [];
      let highRiskGroups = 0;
      let totalDuplicates = 0;

      for (const [key, txns] of Object.entries(groups)) {
        if (txns.length > 1) {
          // Detectar si alguna transacción ya ha sido asignada a un responsable
          const hasClassified = txns.some(t => t.responsibleId && t.responsibleId !== '');
          
          // Detectar si es un grupo de alto riesgo (transacciones con mismo valor y descripción en fechas cercanas)
          const isHighRisk = txns.length > 2 || 
            (key.startsWith('valor:') && txns.some(t => {
              // Convertir fecha de t a Date
              let tDate: Date;
              if (t.fecha instanceof Date) {
                tDate = t.fecha;
              } else if (t.fecha instanceof Timestamp) {
                tDate = t.fecha.toDate();
              } else if (t.fecha && typeof t.fecha === 'object' && 'seconds' in t.fecha) {
                // Para objetos tipo Firestore Timestamp convertidos a objeto plano
                tDate = new Date((t.fecha as {seconds: number}).seconds * 1000);
              } else {
                // Fallback para otros formatos
                tDate = new Date(t.fecha as string | number);
              }
              
              // Verificar si hay transacciones del mismo día
          return txns.filter(other => {
                // Convertir fecha de other a Date
                let otherDate: Date;
                if (other.fecha instanceof Date) {
                  otherDate = other.fecha;
                } else if (other.fecha instanceof Timestamp) {
                  otherDate = other.fecha.toDate();
                } else if (other.fecha && typeof other.fecha === 'object' && 'seconds' in other.fecha) {
                  // Para objetos tipo Firestore Timestamp convertidos a objeto plano
                  otherDate = new Date((other.fecha as {seconds: number}).seconds * 1000);
                } else {
                  // Fallback para otros formatos
                  otherDate = new Date(other.fecha as string | number);
                }
                
                return Math.abs(tDate.getTime() - otherDate.getTime()) < 86400000; // 1 día en ms
              }).length > 1;
            }));
          
          if (isHighRisk) highRiskGroups++;
          totalDuplicates += txns.length;
          
          results.push({
            key,
            count: txns.length,
            hasClassified,
            transactions: txns.sort((a, b) => {
              // Ordenar por fecha, más reciente primero
              // Convertir fecha A a Date
              let dateA: Date;
              if (a.fecha instanceof Date) {
                dateA = a.fecha;
              } else if (a.fecha instanceof Timestamp) {
                dateA = a.fecha.toDate();
              } else if (a.fecha && typeof a.fecha === 'object' && 'seconds' in a.fecha) {
                dateA = new Date((a.fecha as {seconds: number}).seconds * 1000);
              } else {
                dateA = new Date(a.fecha as string | number);
              }
              
              // Convertir fecha B a Date
              let dateB: Date;
              if (b.fecha instanceof Date) {
                dateB = b.fecha;
              } else if (b.fecha instanceof Timestamp) {
                dateB = b.fecha.toDate();
              } else if (b.fecha && typeof b.fecha === 'object' && 'seconds' in b.fecha) {
                dateB = new Date((b.fecha as {seconds: number}).seconds * 1000);
              } else {
                dateB = new Date(b.fecha as string | number);
              }
                         
              return dateB.getTime() - dateA.getTime();
            }),
            isExpanded: false,
            isHighRisk
          });
        }
      }

      // Ordenar resultados por riesgo y cantidad
      results.sort((a, b) => {
        if (a.isHighRisk !== b.isHighRisk) return a.isHighRisk ? -1 : 1;
        return b.count - a.count;
      });

      // Contar cuántas transacciones asignadas están en grupos de duplicados
      const assignedInDuplicates = results.reduce((count, group) => {
        if (group.hasClassified) {
          const assignedCount = group.transactions.filter(t => t.responsibleId && t.responsibleId !== '').length;
          return count + assignedCount;
        }
        return count;
      }, 0);

      setDiagnosticResults(results);
      setSummary({
        totalAnalyzed: transactions.length,
        potentialDuplicates: results.length,
        highRiskGroups: highRiskGroups,
        affectedTransactions: totalDuplicates,
        assignedTransactions: assignedInDuplicates
      });
    } catch (error) {
      console.error('Error en el diagnóstico:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (index: number) => {
    setDiagnosticResults(prev => {
      const updated = [...prev];
      updated[index].isExpanded = !updated[index].isExpanded;
      return updated;
    });
  };

  // Formatear fecha para mostrar
  const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    
    try {
      let d: Date;
      if (date instanceof Date) {
        d = date;
      } else if (date instanceof Timestamp) {
        d = date.toDate();
      } else if (date && typeof date === 'object' && 'seconds' in date) {
        // Para manejar objetos tipo { seconds: number, nanoseconds: number }
        d = new Date((date as {seconds: number}).seconds * 1000);
      } else {
        // Intenta convertir cualquier otro formato
        d = new Date(date);
      }

      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  // Analizar la clave para obtener información más legible
  const analyzeKey = (key: string) => {
    const parts = key.split('|');
    const result: Record<string, string> = {};
    
    parts.forEach(part => {
      const [field, value] = part.split(':');
      if (field && value) {
        result[field] = value;
      }
    });
    
    return result;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl shadow-xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Diagnóstico de Transacciones Duplicadas
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filtros de año y mes */}
            <div className="mb-4 px-4 flex flex-wrap gap-4">
              {/* Filtro por año */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por año:</label>
                <select
                  className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-36"
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(e.target.value);
                    if (accountId) runDiagnostic(accountId);
                  }}
                >
                  <option value="">Todos los años</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Filtro por mes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por mes:</label>
                <select
                  className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-36"
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    if (accountId) runDiagnostic(accountId);
                  }}
                >
                  <option value="">Todos los meses</option>
                  {availableMonths.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Botón para limpiar filtros */}
              {(filterYear || filterMonth) && (
                <button
                  onClick={() => {
                    setFilterYear('');
                    setFilterMonth('');
                    if (accountId) runDiagnostic(accountId);
                  }}
                  className="flex items-center justify-center h-9 px-4 mt-6 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 px-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-500 text-sm">Total analizado</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalAnalyzed}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-yellow-700 text-sm">Grupos potenciales</p>
                <p className="text-2xl font-bold text-yellow-700">{summary.potentialDuplicates}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-red-700 text-sm">Grupos de alto riesgo</p>
                <p className="text-2xl font-bold text-red-700">{summary.highRiskGroups}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-orange-700 text-sm">Transacciones afectadas</p>
                <p className="text-2xl font-bold text-orange-700">{summary.affectedTransactions}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-700 text-sm">Ya asignadas</p>
                <p className="text-2xl font-bold text-green-700">{summary.assignedTransactions}</p>
              </div>
            </div>
            
            {diagnosticResults.length > 0 ? (
              <div className="overflow-y-auto flex-1 pr-2">
                <div className="space-y-3">
                  {diagnosticResults.map((result, index) => {
                    const keyInfo = analyzeKey(result.key);
                    
                    return (
                      <div 
                        key={index}
                        className={`border rounded-lg overflow-hidden ${
                          result.isHighRisk ? 'border-red-300 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                        }`}
                      >
                        <div 
                          className="flex justify-between items-center p-4 cursor-pointer"
                          onClick={() => toggleExpand(index)}
                        >
                          <div className="flex items-center mb-2 flex-wrap">
                            <div className="flex items-center mb-2 mr-2">
                              {result.isHighRisk && (
                                <span className="mr-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                  Alto riesgo
                                </span>
                              )}
                              {result.hasClassified && (
                                <span className="mr-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  Contiene asignadas
                                </span>
                              )}
                              <h3 className="text-base font-medium text-gray-900">
                                Grupo #{index + 1}: {result.count} transacciones
                              </h3>
                            </div>
                            
                            <div className="w-full mb-1">
                              {keyInfo.fecha && <span className="inline-block mr-3 px-2 py-0.5 bg-blue-50 text-blue-800 rounded text-xs">
                                Fecha: {keyInfo.fecha}
                              </span>}
                              
                              {keyInfo.valor && <span className="inline-block mr-3 px-2 py-0.5 bg-purple-50 text-purple-800 rounded text-xs">
                                Valor: {Number(keyInfo.valor).toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}
                              </span>}
                            </div>
                            
                            {keyInfo.desc && <p className="w-full text-sm text-gray-600 truncate">
                              <span className="font-medium">Descripción:</span> {keyInfo.desc}
                            </p>}
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium ${
                              result.count > 2 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {result.count} transacciones
                            </span>
                            {result.isExpanded ? (
                              <ChevronDown size={20} className="text-gray-500" />
                            ) : (
                              <ChevronRight size={20} className="text-gray-500" />
                            )}
                          </div>
                        </div>
                        
                        {result.isExpanded && (
                          <div className="border-t border-gray-200 divide-y divide-gray-200">
                            <div className="p-3 bg-white">
                              <div className="grid grid-cols-6 gap-2 font-medium text-xs text-gray-500 pb-1">
                                <div>FECHA</div>
                                <div>DESCRIPCIÓN</div>
                                <div className="text-right">VALOR</div>
                                <div>ID IMPORTACIÓN</div>
                                <div>CREADO</div>
                                <div>ID</div>
                              </div>
                              {result.transactions.map((transaction, i) => (
                                <div 
                                  key={transaction.id}
                                  className={`grid grid-cols-6 gap-2 text-sm py-2 ${
                                    i % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                  }`}
                                >
                                  <div>{formatDate(transaction.fecha).split(',')[0]}</div>
                                  <div className="truncate" title={transaction.descripcion}>
                                    {transaction.descripcion}
                                  </div>
                                  <div className="text-right font-medium">
                                    {transaction.valor.toLocaleString('es-ES')}
                                  </div>
                                  <div className="truncate" title={transaction.importId || 'N/A'}>
                                    {transaction.importId ? transaction.importId.substring(0, 8) + '...' : 'N/A'}
                                  </div>
                                  <div>{formatDate(transaction.createdAt || transaction.fecha)}</div>
                                  <div className="text-xs text-gray-500 truncate" title={transaction.id}>
                                    {transaction.id.substring(0, 8)}...
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Check size={48} className="text-green-500 mb-4" />
                <p className="text-gray-600 text-lg">No se encontraron posibles duplicados</p>
                <p className="text-gray-500 text-sm mt-1">Las transacciones de esta cuenta parecen estar en buen estado</p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDiagnosticModal;
