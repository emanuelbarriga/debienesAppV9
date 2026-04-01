import { RawTransaction, ProcessedTransaction } from '../types/transaction';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Función para generar un ID único para cada transacción
export function generateTransactionId(raw: RawTransaction, accountId: string): string {
  // Crear una cadena única combinando campos relevantes
  const uniqueString = [
    accountId,
    raw['Fecha Transacción'] || raw['Fecha Saldo'],
    raw['Descripción'],
    raw['Valor'],
    raw['Regional / Oficina'],
    raw['Tipo Transacción'],
    raw['Oficina'],
    raw['Ref. Titular Cuenta']
  ].join('|');

  // Función simple de hash
  let hash = 0;
  for (let i = 0; i < uniqueString.length; i++) {
    const char = uniqueString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32 bits
  }

  // Convertir a string positivo de 12 caracteres
  const positiveHash = Math.abs(hash).toString(36).padStart(12, '0');
  return positiveHash.substring(0, 12);
}

// Función para parsear fechas en formato DD/MM/YYYY
function parseCustomDate(dateStr: string): Date {
  if (!dateStr) {
    console.warn('Empty date string provided');
    return new Date();
  }

  try {
    // Intentar parsear la fecha en formato DD/MM/YYYY
    const parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
    
    if (isValid(parsedDate)) {
      return parsedDate;
    }

    // Si falla, intentar con formato DD/MM/YY
    const parsedDateShort = parse(dateStr, 'dd/MM/yy', new Date());
    
    if (isValid(parsedDateShort)) {
      return parsedDateShort;
    }

    console.warn('Invalid date format:', dateStr);
    return new Date();
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return new Date();
  }
}

// Función para extraer el código de referencia
function extractReferenceCode(refStr: string): number {
  if (!refStr) return 0;
  
  // Limpiar y normalizar el string
  const cleanStr = refStr.trim().toUpperCase();
  
  // Caso 1: Número después de la última coma
  const commaMatch = cleanStr.split(',');
  if (commaMatch.length > 1) {
    const lastPart = commaMatch[commaMatch.length - 1].trim();
    const number = parseInt(lastPart.replace(/\D/g, ''));
    if (!isNaN(number)) return number;
  }

  // Caso 2: Números largos al inicio de la cadena
  const leadingNumberMatch = cleanStr.match(/^0*(\d{7,10})/);
  if (leadingNumberMatch && leadingNumberMatch[1]) {
    return parseInt(leadingNumberMatch[1]);
  }

  // Caso 3: Números después de LOTE: o PA
  const patterns = [
    /LOTE:0*(\d+)/,           // Números después de LOTE: eliminando ceros iniciales
    /PA0*(\d+)/,              // Números después de PA eliminando ceros iniciales
    /[^\d]0*(\d{7,10})[^\d]/, // 7-10 dígitos rodeados de no dígitos, eliminando ceros iniciales
  ];

  for (const pattern of patterns) {
    const match = cleanStr.match(pattern);
    if (match && match[1]) {
      const number = parseInt(match[1]);
      if (!isNaN(number)) return number;
    }
  }

  // Caso 4: Cualquier secuencia de números significativa
  const numberMatches = cleanStr.match(/\d{7,10}/g);
  if (numberMatches && numberMatches.length > 0) {
    // Tomar el número más largo o el primero si tienen la misma longitud
    const longestNumber = numberMatches.reduce((a, b) => 
      b.length > a.length ? b : a
    );
    return parseInt(longestNumber);
  }

  // Si no se encuentra ningún patrón válido
  return 0;
}

// Función para validar un código de referencia
function validateReferenceCode(code: number): boolean {
  // El código debe ser un número positivo
  if (code <= 0) return false;
  
  // El código debe tener entre 7 y 10 dígitos
  const codeStr = code.toString();
  return codeStr.length >= 7 && codeStr.length <= 10;
}

// Función para parsear valores numéricos
function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  // Eliminar espacios y convertir comas en puntos
  const cleanValue = value.trim().replace(/,/g, '.');
  // Eliminar cualquier carácter que no sea número, punto o signo negativo
  const numericValue = cleanValue.replace(/[^\d.-]/g, '');
  const number = parseFloat(numericValue);
  return isNaN(number) ? 0 : number;
}

// Función para extraer el código de detalles adicionales
export function extractDetailsCode(details: any): string {
  // Si details es undefined o no es string, retornar '-'
  if (!details || typeof details !== 'string') {
    return '-';
  }

  // Patrones para extraer códigos de diferentes formatos
  const patterns = [
    // Caso: Números de identificación o teléfono (8-12 dígitos)
    /\b\d{8,12}\b/,
    
    // Caso: Números con prefijo de ceros
    /\b0*(\d{8,12})\b/,
    
    // Caso: TRANSFERENCIA/TRASLADO seguido de número
    /(?:TRANSFER(?:ENCIA)?|TRASLADOS?)\s+(?:DE\s+)?(\d+)/i,
    
    // Caso: Número seguido de TRANSFER/TRASLADO
    /(\d+)\s+(?:TRANSFER(?:ENCIA)?|TRASLADOS?)/i,
    
    // Caso: PAGO/ABONO seguido de número
    /(?:PAGO|ABONO)\s+(?:DE\s+)?(\d+)/i,
    
    // Caso: DEVOLUCION DE: seguido de número
    /DEVOLUCION\s+DE:?\s*(\d+)/i,
    
    // Caso: Número seguido de nombre común
    /(\d+)(?:\s+(?:LOPEZ|GARCIA|RODRIGUEZ|MARTINEZ|HERNANDEZ|GONZALEZ))/i,
    
    // Caso: Cualquier secuencia de 8-12 dígitos en el texto
    /.*?(\d{8,12}).*?/
  ];

  for (const pattern of patterns) {
    const match = details.match(pattern);
    if (match) {
      // Si el patrón tiene grupo de captura, usar el primer grupo
      // Si no, usar el match completo
      const extracted = match[1] || match[0];
      // Limpiar el código (solo dígitos) y eliminar ceros al inicio
      const cleaned = extracted.replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (cleaned.length >= 8 && cleaned.length <= 12) {
        return cleaned;
      }
    }
  }

  return '-';
}

// Función para procesar una transacción
export function processTransaction(
  raw: RawTransaction,
  accountId: string,
  accountName: string,
  accountNumber: string,
  bank: string,
  importId: string,
  rowIndex: number
): ProcessedTransaction {
  // Validar la transacción primero
  const validation = validateTransaction(raw);
  if (!validation.isValid) {
    throw new Error(`Transacción inválida: ${validation.errors.join(', ')}`);
  }

  // Procesar la fecha de transacción
  const fechaStr = raw['Fecha Transacción'] || raw['Fecha Saldo'];
  if (!fechaStr) {
    throw new Error('Fecha de transacción no encontrada');
  }

  const fecha = parseCustomDate(fechaStr);
  
  // Generar ID único
  const transactionId = generateTransactionId(raw, accountId);

  // Procesar el valor
  const valorStr = raw['Valor'] || '0';
  const valor = parseAmount(valorStr);

  return {
    id: transactionId,
    accountId,
    accountName,
    accountNumber,
    bank,
    fecha,
    fechaStr,
    descripcion: raw['Descripción'] || '',
    valor,
    saldo: parseAmount(raw['Saldo'] || '0'),
    oficina: raw['Oficina'] || '',
    regional: raw['Regional / Oficina'] || '',
    tipoTransaccion: raw['Tipo Transacción'] || '',
    refTitularCuenta: raw['Ref. Titular Cuenta'] || '',
    detallesAdicionales: raw['Detalles Adicionales'] || '',
    importId,
    rowIndex,
    createdAt: new Date(),
    month: fecha.getMonth() + 1,
    year: fecha.getFullYear()
  };
}

// Función para limpiar transacciones duplicadas
export async function cleanDuplicateTransactions(
  db: any,
  accountId: string,
  month: number,
  year: number
): Promise<{ removed: number, errors: string[] }> {
  const errors: string[] = [];
  let removed = 0;

  try {
    // Obtener todas las transacciones del mes y año especificados
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('accountId', '==', accountId),
      where('month', '==', month),
      where('year', '==', year)
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as ProcessedTransaction
    }));

    // Agrupar transacciones por características similares
    const groups = new Map<string, ProcessedTransaction[]>();
    
    transactions.forEach(transaction => {
      const key = `${transaction.fechaStr}|${transaction.valor}|${transaction.descripcion}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(transaction);
    });

    // Procesar cada grupo de duplicados
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const [key, duplicates] of groups) {
      if (duplicates.length > 1) {
        // Ordenar por fecha de creación, mantener el más antiguo
        duplicates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        // Mantener el primer registro y eliminar los demás
        for (let i = 1; i < duplicates.length; i++) {
          batch.delete(doc(db, 'transactions', duplicates[i].id));
          removed++;
          batchCount++;

          // Commit batch si alcanza el límite
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }
    }

    // Commit final si hay cambios pendientes
    if (batchCount > 0) {
      await batch.commit();
    }

    return { removed, errors };
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
    errors.push(error instanceof Error ? error.message : 'Error desconocido');
    return { removed, errors };
  }
}

// Función para validar una transacción
export function validateTransaction(transaction: RawTransaction): { isValid: boolean; errors: string[] } {
  console.log('Validating transaction:', transaction);
  const errors: string[] = [];

  // Verificar si es un registro de saldo (SALDO INICIAL/FINAL)
  const tipoTransaccion = transaction['Tipo Transacción'] || '';
  const descripcion = transaction['Descripción'] || '';
  const isSaldoRecord = descripcion.toUpperCase().includes('SALDO') || 
                       tipoTransaccion.toUpperCase().includes('SALDO');
  
  console.log('Validation check:', {
    tipoTransaccion,
    descripcion,
    isSaldoRecord,
    hasSaldo: !!transaction['Saldo'],
    saldoValue: transaction['Saldo']
  });

  if (isSaldoRecord) {
    console.log('Processing as saldo record');
    // Para registros de saldo, solo necesitamos fecha y saldo
    if (!transaction['Fecha Saldo'] && !transaction['Fecha Transacción']) {
      errors.push('Fecha faltante para registro de saldo');
    }
    const saldoValue = transaction['Saldo']?.trim();
    if (!saldoValue) {
      errors.push('Valor de saldo faltante para registro de saldo');
    }
  } else {
    // Validaciones para transacciones normales
    if (!transaction['Fecha Transacción'] && !transaction['Fecha Saldo']) {
      errors.push('Fecha de transacción faltante');
    }
    if (!transaction['Descripción']) {
      errors.push('Descripción faltante');
    }
    if (!transaction['Valor']) {
      errors.push('Valor faltante');
    }
  }

  console.log('Validation result:', { errors });
  return {
    isValid: errors.length === 0,
    errors
  };
}
