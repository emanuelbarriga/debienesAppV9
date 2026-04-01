import { Timestamp } from 'firebase/firestore'; // Importa Timestamp si usas Firebase para las fechas

export type ResponsibleType = 'tenant' | 'owner' | 'admin' | 'third-party' | 'other' | 'n/a';

export interface Responsible {
  id?: string; // Firestore ID es opcional en la interfaz si lo generas o no siempre está presente al crear
  name: string;
  identificacion?: string; // Preferimos 'identificacion' sobre 'identifier' por el uso en el código
  email?: string;
  phones?: string[]; // Preferimos 'phones' (array) sobre 'phone' por el uso en el código
  type: ResponsibleType;
  valor?: number; // Habilitado como opcional por el uso en auto-asignación de administradores
  empresa?: string;
  direccion?: string;
  f_inicial_contrato?: string | Date | Timestamp; // Ajuste para flexibilidad
  f_final_contrato?: string | Date | Timestamp; // Ajuste para flexibilidad
  createdAt?: Date | Timestamp; // Ajuste para flexibilidad con Firebase Timestamps
  updatedAt?: Date | Timestamp; // Ajuste para flexibilidad con Firebase Timestamps
}

export interface Transaction {
  id: string;
  firestoreId?: string; // Añadido para el ID del documento de Firestore (si es diferente del 'id' interno)
  accountId: string;
  accountName: string;
  accountNumber: string;
  bank: string;
  codigoReferencia?: number; // Habilitado como opcional si no siempre está presente
  descripcion: string;
  detallesAdicionales?: string; // Habilitado como opcional
  observaciones?: string; // Habilitado como opcional
  docContable?: string; // Habilitado como opcional
  fecha: Date | Timestamp; // Ajuste para flexibilidad con Firebase Timestamps
  fechaStr: string;
  importId: string;
  isSaldoRecord: boolean;
  oficina: string;
  rowIndex: number;
  saldo: number;
  tipo: 'INGRESO' | 'EGRESO' | 'SALDO';
  tipoTransaccion: string;
  valor: number;
  responsibleId?: string;
  responsibleType?: ResponsibleType;
  responsible?: { // Objeto denormalizado para el responsable
    id: string;
    name: string;
    type: ResponsibleType;
  };
  assignedAt?: Date | Timestamp;
  assignedBy?: string;
  banco?: string; // Confirmado como opcional
  createdAt?: Date | Timestamp;
  numeroCuenta?: string;
  lastModifiedBy?: string; // Añadido para consistencia con la actualización de docContable
  lastModifiedAt?: Date | Timestamp; // Añadido para consistencia con la actualización de docContable
  lastAssignment?: { // Información de la última asignación, útil para el historial
    assignedAt: Date | Timestamp;
    assignedBy: string;
    assignmentMethod: 'automatic' | 'manual';
    matchedCode?: string; // Si se usó un código para auto-asignación
    matchedAmount?: number; // Si se usó un monto para auto-asignación (para 'admin')
  };
}

export interface ResponsibleFormData {
  name: string;
  type: ResponsibleType;
  identificacion?: string; // Usa identificacion aquí también
  email?: string;
  phones?: string[];
  direccion?: string;
  valor?: number;
  empresa?: string;
  f_inicial_contrato?: string | Date;
  f_final_contrato?: string | Date;
}

export interface Assignment {
  id?: string;
  transactionId: string;
  responsibleId: string;
  responsibleType: ResponsibleType;
  assignedAt: Date | Timestamp; // Asegúrate de que coincida con el tipo de Firestore
  assignedBy: string;
  assignmentMethod?: 'automatic' | 'manual'; // Añadido para diferenciar
  matchedCode?: string; // Añadido para auto-asignación
  matchedAmount?: number; // Añadido para auto-asignación (para 'admin')
}

export interface Account {
  id: string;
  nombre: string;
  numeroCuenta: string;
  banco: string;
  tipo: 'ahorros' | 'corriente';
  createdAt: Date | Timestamp;
}

export interface ActivityLog {
  id?: string;
  usuarioEmail: string;
  accion: 'creación' | 'modificación' | 'eliminación' | 'importación';
  entidad: 'cuenta' | 'transacción' | 'responsable' | 'asignación';
  detalles: string;
  timestamp: Date | Timestamp;
  documentoId?: string; // Asegúrate de incluirlo si lo usas
}

export interface ImportHistory {
  id?: string;
  cuentaId: string;
  nombreArchivo: string;
  fechaImportacion: Date | Timestamp;
  usuarioEmail: string;
  registrosImportados: number;
}

// Tipos específicos para la importación
export interface RawTransaction {
  'Fecha Saldo'?: string;
  'Fecha Transacción'?: string;
  'Descripción'?: string;
  'Valor'?: string;
  'Saldo'?: string;
  'Regional / Oficina'?: string;
  'Tipo Transacción'?: string;
  'Oficina'?: string;
  'Ref. Titular Cuenta'?: string;
  'Detalles Adicionales'?: string;
}

export interface DuplicateTransaction {
  existing: Transaction;
  new: Transaction;
  approved?: boolean;
  duplicateType?: 'internal' | 'external'; // Tipo de duplicado: interno (dentro del lote) o externo (en Firestore)
}

export interface ImportLog {
  id?: string;
  accountId: string;
  accountName: string;
  timestamp: Date | Timestamp;
  fileName: string;
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  duplicatesFound: number;
  duplicatesImported: number;
  errors: ImportError[];
  status: 'completed' | 'failed';
  userId: string;
}

export interface ImportError {
  rowIndex: number;
  rowData: string;
  errorMessage: string;
  errorType: 'validation' | 'duplicate' | 'processing' | 'unknown';
}

// ============================================================================
// OWNER ACCOUNTS & PAYMENTS MODULE
// ============================================================================

/**
 * Cuenta bancaria de un propietario
 * Puede haber múltiples cuentas por propietario
 */
export interface OwnerAccount {
  id?: string;
  propietario: string; // Nombre del propietario
  documentoPropietario: string; // NIT/Cédula normalizado (sin puntos ni guiones)
  pagarA: string; // Beneficiario del pago (puede ser diferente al propietario)
  documentoBeneficiario: string; // Documento del beneficiario normalizado
  numeroCuenta: string;
  banco: string; // Normalizado según catálogo
  tipoCuenta: 'AHORROS' | 'CORRIENTE';
  observaciones?: string;
  
  // Asociación a responsables
  responsibleId?: string; // ID del responsible type='owner'
  responsibleName?: string; // Denormalizado para performance
  
  // Control
  status: 'activa' | 'inactiva';
  isDefault?: boolean; // Si es cuenta preferida (para propietarios con múltiples cuentas)
  
  // Auditoría
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  createdBy: string; // Email del usuario
}

/**
 * Distribución de un saldo en múltiples cuentas
 * ACTUALIZADO: Ahora incluye tracking de lote de pago individual por distribución
 */
export interface BalanceDistribution {
  ownerAccountId: string; // ID de la cuenta
  banco: string; // Denormalizado para display
  numeroCuenta: string; // Denormalizado
  monto: number; // Monto asignado a esta cuenta
  porcentaje: number; // % del saldo total
  
  // ===== TRACKING DE LOTE DE PAGO =====
  
  /**
   * ID del lote de pago que incluye esta distribución específica
   * null/undefined = distribución disponible para crear lote
   */
  batchId?: string | null;
  
  /**
   * Estado del pago de esta distribución individual
   * 'pendiente' = lote creado pero no pagado aún
   * 'pagado' = pago ejecutado y confirmado
   */
  batchStatus?: 'pendiente' | 'pagado' | null;
  
  /**
   * Fecha en que se ejecutó el pago (solo si batchStatus = 'pagado')
   */
  paidAt?: Date | Timestamp | null;
  
  /**
   * Referencia legible del lote (ej: "LOTE-BANCOLOMBIA-OCT2025")
   * Útil para UI y reportes sin necesidad de buscar el lote
   */
  batchRef?: string | null;
  
  /**
   * Email del usuario que marcó como pagado esta distribución
   */
  paidBy?: string | null;
}

/**
 * Saldo mensual de un propietario
 * DocId determinístico: {documentoPropietario}_{yyyymm}
 */
export interface OwnerMonthlyBalance {
  id?: string; // ID del documento en Firestore
  documentoPropietario: string; // NIT del propietario (normalizado)
  propietario: string; // Nombre (para display)
  saldo: number; // Entero en pesos (COP no usa centavos)
  mes: number; // 1-12
  anio: number;
  
  // Distribución en cuentas (si tiene múltiples)
  distribucion?: BalanceDistribution[]; // Array de distribuciones
  distribuidoManualmente: boolean; // true si usuario distribuyó, false si automático
  
  // Auditoría
  fechaImportacion: Date | Timestamp;
  importadoPor: string;
  sourceFileHash?: string; // SHA-256 del CSV
  
  /**
   * @deprecated Usar distribucion[].batchId en su lugar
   * Mantenido solo para compatibilidad durante migración
   * Este campo ya no se actualiza en nuevos flujos
   */
  batchId?: string | null;
}

/**
 * Lote de pago mensual
 * Agrupa pagos a realizar en un mes específico
 */
export interface PaymentBatch {
  id?: string;
  mes: number;
  anio: number;
  
  // Estados del flujo
  estado: 'borrador' | 'revisión' | 'generado' | 'pagado' | 'anulado';
  
  // Métricas
  totalPropietarios: number;
  totalMonto: number; // Suma de todos los montos
  totalCuentas: number; // Cantidad de cuentas/ítems
  propietariosPendientes: number; // Propietarios sin cuenta o distribución
  
  // Auditoría
  creadoPor: string;
  creadoEn: Date | Timestamp;
  revisadoEn?: Date | Timestamp;
  generadoEn?: Date | Timestamp; // Cuando se exportó CSV
  pagadoEn?: Date | Timestamp;
  archivoCSVHash?: string; // Hash del CSV exportado
  
  notas?: string;
}

/**
 * Item individual dentro de un lote de pago
 * Representa un pago a una cuenta específica
 */
export interface PaymentBatchItem {
  id?: string;
  batchId: string;
  
  // Referencia al propietario y cuenta
  documentoPropietario: string;
  ownerAccountId: string; // Cuenta seleccionada por el usuario
  balanceId: string; // Ref a ownerMonthlyBalances/{id}
  
  // Datos denormalizados para export
  propietario: string;
  pagarA: string;
  documentoBeneficiario: string;
  numeroCuenta: string;
  banco: string;
  tipoCuenta: string;
  
  // Monto
  monto: number; // Monto específico para esta cuenta
  
  // Estado individual
  estadoItem: 'pendiente' | 'pagado' | 'omitido' | 'error';
  observaciones?: string;
}

/**
 * Resultado de importación de cuentas
 */
export interface OwnerAccountImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  accountsWithMultiple: string[]; // NITs con múltiples cuentas
}

/**
 * Resultado de importación de saldos
 */
export interface BalanceImportResult {
  imported: number;
  updated: number;
  requiresDistribution: BalancePendingDistribution[]; // Saldos que necesitan distribución manual
  errors: Array<{ row: number; message: string }>;
}

/**
 * Saldo pendiente de distribución (para modal)
 */
export interface BalancePendingDistribution {
  documentoPropietario: string;
  propietario: string;
  saldo: number;
  cuentasDisponibles: OwnerAccount[]; // Cuentas del propietario
  mes: number;
  anio: number;
  distribucionExistente?: BalanceDistribution[]; // Distribución previa al editar
}

/**
 * Distribución completada por el usuario
 */
export interface CompletedDistribution {
  documentoPropietario: string;
  propietario: string;
  saldo: number;
  mes: number;
  anio: number;
  distribucion: BalanceDistribution[];
}

/**
 * Item de cuenta en un lote de pago bancario
 */
export interface BankPaymentBatchItem {
  balanceId: string; // ID del OwnerMonthlyBalance
  propietario: string;
  documentoPropietario: string;
  pagarA: string; // Beneficiario del pago
  documentoBeneficiario: string; // Documento del beneficiario
  banco: string;
  numeroCuenta: string;
  monto: number;
  porcentaje: number;
  ownerAccountId?: string; // ID de la cuenta (agregado para migración)
}

/**
 * Lote de pago específico por banco
 * Agrupa pagos para un banco específico en un período
 */
export interface BankPaymentBatch {
  id?: string;
  referencia: string;
  banco: string;
  mes: number;
  anio: number;
  items: BankPaymentBatchItem[];
  totalMonto: number;
  status: 'pendiente' | 'pagado' | 'cancelado';
  fechaProgramada?: Date | Timestamp;
  fechaPago?: Date | Timestamp;
  comprobante?: string;
  observaciones?: string;
  createdBy: string;
  createdAt: Date | Timestamp;
  paidBy?: string;
  paidAt?: Date | Timestamp;
  revertedAt?: Date | Timestamp;
  revertedBy?: string;
}