import { parseCOPAmount } from './moneyUtils';
import { normalizeDocumento } from './ownerAccountUtils';

export interface ProcessedBalanceRow {
  propietario: string;
  nit: string;
  saldo: number; // El valor final a guardar en DB (signo ya invertido)
  isValid: boolean;
  error?: string;
}

/**
 * Procesa una fila del CSV de balances y aplica la regla de negocio de signos:
 * - CSV positivo = Deuda de inmobiliaria al propietario (Se guarda negativo)
 * - CSV negativo = Deuda del propietario a inmobiliaria (Se guarda positivo)
 */
export function processBalanceRowFromCSV(row: string[]): ProcessedBalanceRow {
  try {
    const propietario = row[0]?.trim();
    const rawNit = row[1];
    const saldoStr = row[2];

    if (!propietario || !rawNit) {
      return {
        propietario: propietario || '',
        nit: '',
        saldo: 0,
        isValid: false,
        error: 'Datos incompletos'
      };
    }

    const nit = normalizeDocumento(rawNit);
    const saldoParsed = parseCOPAmount(saldoStr);
    
    // REGLA DE NEGOCIO CRÍTICA: Inversión de signo
    const saldoFinal = -saldoParsed;

    return {
      propietario,
      nit,
      saldo: saldoFinal,
      isValid: true
    };
  } catch (error) {
    return {
      propietario: row[0] || '',
      nit: '',
      saldo: 0,
      isValid: false,
      error: String(error)
    };
  }
}
