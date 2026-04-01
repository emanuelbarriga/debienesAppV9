import { useState, useEffect } from 'react';
import { X, DollarSign, Percent, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { BalancePendingDistribution, BalanceDistribution, CompletedDistribution } from '../../../types';
import { formatCOPAmount, parseCOPAmount } from '../../../utils/moneyUtils';
import { maskAccountNumber } from '../../../utils/ownerAccountUtils';
import { getNextIndexOnSkip } from '../../../utils/importBalanceHelpers';

interface DistributeBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingDistributions: BalancePendingDistribution[];
  onComplete: (distributions: CompletedDistribution[]) => void;
}

export default function DistributeBalanceModal({
  isOpen,
  onClose,
  pendingDistributions,
  onComplete
}: DistributeBalanceModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedDist, setCompletedDist] = useState<CompletedDistribution[]>([]);
  const [currentDistribution, setCurrentDistribution] = useState<BalanceDistribution[]>([]);
  const [editableSaldo, setEditableSaldo] = useState(0);

  const current = pendingDistributions[currentIndex];
  
  // Trabajar siempre con valores absolutos en la UI
  const saldoAbsoluto = editableSaldo;
  const esNegativo = current ? current.saldo < 0 : false;

  // Inicializar distribución y saldo cuando cambia el propietario
  useEffect(() => {
    if (!current) return;

    const saldoInicial = Math.abs(current.saldo);
    console.log('[DistributeBalance] Inicializando modal:', {
      propietario: current.propietario,
      saldoOriginal: current.saldo,
      saldoAbsoluto: saldoInicial,
      tieneDistribucionExistente: !!current.distribucionExistente,
      cuentasDisponibles: current.cuentasDisponibles.length
    });

    // Inicializar saldo editable
    setEditableSaldo(saldoInicial);

    // Si hay distribución existente (edición), cargarla
    if (current.distribucionExistente && current.distribucionExistente.length > 0) {
      console.log('[DistributeBalance] Cargando distribución existente:', current.distribucionExistente);
      
      // Convertir a valores absolutos para la UI
      const distribucionAbsoluta = current.distribucionExistente.map(dist => ({
        ...dist,
        monto: Math.abs(dist.monto)
      }));
      
      const totalCargado = distribucionAbsoluta.reduce((sum, d) => sum + d.monto, 0);
      console.log('[DistributeBalance] Distribución cargada:', {
        distribuciones: distribucionAbsoluta,
        totalCargado,
        saldoInicial,
        coincide: totalCargado === saldoInicial
      });
      
      setCurrentDistribution(distribucionAbsoluta);
    } else {
      // Nueva distribución: inicializar con cuenta por defecto o primera cuenta
      const defaultAccount = current.cuentasDisponibles.find(a => a.isDefault) || current.cuentasDisponibles[0];
      
      if (defaultAccount) {
        const distribucionInicial = [{
          ownerAccountId: defaultAccount.id!,
          banco: defaultAccount.banco,
          numeroCuenta: defaultAccount.numeroCuenta,
          monto: saldoInicial,
          porcentaje: 100
        }];
        
        console.log('[DistributeBalance] Nueva distribución inicializada:', distribucionInicial);
        setCurrentDistribution(distribucionInicial);
      }
    }
  }, [currentIndex, current]);

  if (!isOpen || !current) return null;

  const totalDistribuido = currentDistribution.reduce((sum, d) => sum + d.monto, 0);
  const restante = saldoAbsoluto - totalDistribuido;
  const isValid = totalDistribuido === saldoAbsoluto && currentDistribution.length > 0;

  const handleMontoChange = (accountId: string, valor: string) => {
    const monto = parseCOPAmount(valor);
    
    setCurrentDistribution(prev => {
      const newDist = [...prev];
      const index = newDist.findIndex(d => d.ownerAccountId === accountId);
      
      if (index >= 0) {
        newDist[index].monto = monto;
        newDist[index].porcentaje = saldoAbsoluto > 0 ? Math.round((monto / saldoAbsoluto) * 100) : 0;
      }
      
      return newDist;
    });
  };

  const handlePorcentajeChange = (accountId: string, valor: string) => {
    const pct = Math.max(0, Math.min(100, parseFloat(valor) || 0));
    
    setCurrentDistribution(prev => {
      const newDist = [...prev];
      const index = newDist.findIndex(d => d.ownerAccountId === accountId);
      
      if (index >= 0) {
        newDist[index].porcentaje = pct;
        newDist[index].monto = Math.round((pct / 100) * saldoAbsoluto);
      }
      
      return newDist;
    });
  };

  const handleSaldoTotalChange = (valor: string) => {
    const nuevoSaldo = parseCOPAmount(valor);
    if (nuevoSaldo <= 0) return;

    const saldoAnterior = editableSaldo;
    setEditableSaldo(nuevoSaldo);

    // Redistribuir proporcionalmente
    if (saldoAnterior > 0) {
      setCurrentDistribution(prev => 
        prev.map(d => {
          const nuevoMonto = Math.round((d.monto / saldoAnterior) * nuevoSaldo);
          return {
            ...d,
            monto: nuevoMonto,
            porcentaje: nuevoSaldo > 0 ? Math.round((nuevoMonto / nuevoSaldo) * 100) : 0
          };
        })
      );
    }
  };


  const handleToggleCuenta = (accountId: string) => {
    const exists = currentDistribution.find(d => d.ownerAccountId === accountId);
    
    if (exists) {
      // Remover cuenta
      setCurrentDistribution(prev => prev.filter(d => d.ownerAccountId !== accountId));
    } else {
      // Agregar cuenta
      const account = current.cuentasDisponibles.find(a => a.id === accountId);
      if (account) {
        setCurrentDistribution(prev => [...prev, {
          ownerAccountId: account.id!,
          banco: account.banco,
          numeroCuenta: account.numeroCuenta,
          monto: 0,
          porcentaje: 0
        }]);
      }
    }
  };

  const handleDividirEquitativamente = () => {
    if (currentDistribution.length === 0 || saldoAbsoluto <= 0) return;
    
    const montoPorCuenta = Math.floor(saldoAbsoluto / currentDistribution.length);
    
    // Calcular distribución base
    const newDist = currentDistribution.map(d => ({
      ...d,
      monto: montoPorCuenta,
      porcentaje: Math.round((montoPorCuenta / saldoAbsoluto) * 100)
    }));
    
    // Ajustar el residuo de redondeo en la primera cuenta
    const totalParcial = montoPorCuenta * newDist.length;
    const residuo = saldoAbsoluto - totalParcial;
    
    if (newDist.length > 0) {
      newDist[0].monto += residuo;
      newDist[0].porcentaje = Math.round((newDist[0].monto / saldoAbsoluto) * 100);
    }

    setCurrentDistribution(newDist);
  };

  const handleCopiarRestanteA = (accountId: string) => {
    console.log('[CopiarRestante] Click detectado:', { 
      accountId, 
      restanteActual: restante,
      saldoAbsoluto, 
      totalDistribuido
    });
    
    if (restante <= 0) {
      console.warn('[CopiarRestante] No hay restante para copiar');
      return;
    }
    
    setCurrentDistribution(prev => {
      // Calcular restante DENTRO del setState con los valores actualizados
      const totalActual = prev.reduce((sum, d) => sum + d.monto, 0);
      const restanteActual = saldoAbsoluto - totalActual;
      
      console.log('[CopiarRestante] Calculando con valores actualizados:', {
        totalActual,
        restanteActual,
        saldoAbsoluto
      });
      
      // Si no hay restante, no hacer nada
      if (restanteActual <= 0) {
        console.warn('[CopiarRestante] Ya no hay restante (recalculado)');
        return prev;
      }
      
      const newDist = [...prev];
      const index = newDist.findIndex(d => d.ownerAccountId === accountId);
      
      if (index >= 0) {
        const montoActual = newDist[index].monto;
        const nuevoMonto = montoActual + restanteActual;
        
        console.log('[CopiarRestante] Aplicando cambio:', {
          montoActual,
          restanteActual,
          nuevoMonto
        });
        
        // Validar que no exceda el saldo total
        if (nuevoMonto > saldoAbsoluto) {
          console.error('[CopiarRestante] ERROR: excedería el saldo');
          // Calcular el máximo permitido sin exceder
          const otrosMontos = newDist.reduce((sum, d, i) => i === index ? sum : sum + d.monto, 0);
          newDist[index].monto = saldoAbsoluto - otrosMontos;
        } else {
          newDist[index].monto = nuevoMonto;
        }
        
        newDist[index].porcentaje = saldoAbsoluto > 0 
          ? Math.round((newDist[index].monto / saldoAbsoluto) * 100) 
          : 0;
          
        console.log('[CopiarRestante] Resultado final:', {
          cuenta: newDist[index].banco,
          monto: newDist[index].monto,
          porcentaje: newDist[index].porcentaje
        });
      }
      
      return newDist;
    });
  };

  const handleNext = () => {
    if (!isValid) {
      alert('La suma de montos debe ser igual al saldo total');
      return;
    }

    // Aplicar el signo original a las distribuciones antes de guardar
    const distribucionConSigno = currentDistribution.map(d => ({
      ...d,
      monto: esNegativo ? -d.monto : d.monto
    }));

    // Guardar distribución actual con el saldo editado
    const completed: CompletedDistribution = {
      documentoPropietario: current.documentoPropietario,
      propietario: current.propietario,
      saldo: esNegativo ? -editableSaldo : editableSaldo, // Usar saldo editado
      mes: current.mes,
      anio: current.anio,
      distribucion: distribucionConSigno
    };

    setCompletedDist(prev => [...prev, completed]);

    // Ir al siguiente o finalizar
    if (currentIndex < pendingDistributions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Finalizar
      onComplete([...completedDist, completed]);
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      // Restaurar distribución guardada (convertir a valores absolutos para la UI)
      const saved = completedDist[currentIndex - 1];
      if (saved) {
        const distribucionAbsoluta = saved.distribucion.map(d => ({
          ...d,
          monto: Math.abs(d.monto)
        }));
        setCurrentDistribution(distribucionAbsoluta);
      }
    }
  };

  const handleSkip = () => {
    const { next, done } = getNextIndexOnSkip(currentIndex, pendingDistributions.length);
    setCurrentIndex(next);
    if (done) {
      onComplete(completedDist);
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentIndex(0);
    setCompletedDist([]);
    setCurrentDistribution([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Distribuir Saldos en Múltiples Cuentas</h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentIndex + 1} de {pendingDistributions.length} propietarios
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info del propietario */}
          <div className={`border rounded-lg p-4 ${
            esNegativo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{current.propietario}</h3>
                <p className="text-sm text-gray-600">NIT: {current.documentoPropietario}</p>
                {esNegativo && (
                  <p className="text-xs text-red-600 mt-1 font-medium">⚠ Saldo en contra (deuda)</p>
                )}
              </div>
              <div className="text-right">
                <label className="text-sm text-gray-600 block mb-1">Monto Total a Distribuir</label>
                <input
                  type="text"
                  value={formatCOPAmount(saldoAbsoluto)}
                  onChange={(e) => handleSaldoTotalChange(e.target.value)}
                  className={`text-2xl font-bold text-right border rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    esNegativo ? 'text-red-600 border-red-300' : 'text-green-600 border-green-300'
                  }`}
                  style={{ width: '200px' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Original: {formatCOPAmount(current.saldo)}
                </p>
              </div>
            </div>
          </div>

          {/* Cuentas disponibles */}
          <div className="space-y-3">
            {current.cuentasDisponibles.map((account) => {
              const dist = currentDistribution.find(d => d.ownerAccountId === account.id);
              const isSelected = !!dist;

              return (
                <div
                  key={account.id}
                  className={`border rounded-lg p-4 transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleCuenta(account.id!)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.banco}</span>
                        <span className="text-sm text-gray-600">- {maskAccountNumber(account.numeroCuenta)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          account.tipoCuenta === 'AHORROS' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {account.tipoCuenta}
                        </span>
                        {account.isDefault && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            ⭐ Preferida
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <DollarSign size={14} className="inline" /> Monto
                            </label>
                            <input
                              type="text"
                              value={dist.monto > 0 ? formatCOPAmount(dist.monto).replace('$ ', '') : ''}
                              onChange={(e) => handleMontoChange(account.id!, e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <Percent size={14} className="inline" /> Porcentaje
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={dist.porcentaje}
                                onChange={(e) => handlePorcentajeChange(account.id!, e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                              <span className="text-sm text-gray-600">%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón de distribución rápida */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDividirEquitativamente}
              disabled={currentDistribution.length === 0}
              className="px-4 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50 font-medium"
            >
              ⚡ Dividir Equitativamente
            </button>
          </div>

          {/* Resumen */}
          <div className={`p-4 rounded-lg border-2 ${
            isValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
          }`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Distribuido:</span>
              <span className="text-xl font-bold">{formatCOPAmount(totalDistribuido)}</span>
            </div>
            {isValid ? (
              <p className="text-sm text-green-700 mt-1">✓ Distribución válida (100%)</p>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700 font-medium">
                    ⚠ Restante por distribuir:
                  </span>
                  <span className="text-lg font-bold text-red-700">
                    {formatCOPAmount(restante)}
                  </span>
                </div>
                
                {restante > 0 && currentDistribution.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-red-200">
                    <Copy size={16} className="text-gray-500" />
                    <span className="text-xs text-gray-700 font-medium">Copiar restante a:</span>
                    <div className="flex gap-1 flex-wrap">
                      {currentDistribution.map(dist => {
                        const account = current.cuentasDisponibles.find(a => a.id === dist.ownerAccountId);
                        const bancoNombre = account?.banco || 'Cuenta';
                        return (
                          <button
                            key={dist.ownerAccountId}
                            onClick={() => handleCopiarRestanteA(dist.ownerAccountId)}
                            className="px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium transition-colors"
                            title={`Agregar ${formatCOPAmount(restante)} a ${bancoNombre}`}
                          >
                            {bancoNombre.substring(0, 15)}{bancoNombre.length > 15 ? '...' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {restante < 0 && (
                  <p className="text-xs text-red-600 mt-0.5">
                    ⚠ Se ha excedido el monto total
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Omitir este Propietario
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
            >
              <ChevronLeft size={20} />
              Anterior
            </button>
            
            <button
              onClick={handleNext}
              disabled={!isValid}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {currentIndex < pendingDistributions.length - 1 ? 'Siguiente' : 'Guardar Todo'}
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
