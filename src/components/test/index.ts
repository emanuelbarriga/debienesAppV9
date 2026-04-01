import { importResponsablesTest } from './ImportResponsablesTest';
import { importCuentasPropietariosTest } from './ImportCuentasPropietariosTest';
import { duplicadosResponsablesTest } from './DuplicadosResponsablesTest';
import { resumenImportTest } from './ResumenImportTest';
import { crearOmitirCuentasTest } from './CrearOmitirCuentasTest';
import { distribucionSaldosTest } from './DistribucionSaldosTest';
import { formatoMontosTest } from './FormatoMontosTest';
import { identificarPropietariosTest } from './IdentificarPropietariosTest';
import { asignacionTransaccionesTest } from './AsignacionTransaccionesTest';
import { gestionCuentasBancariasTest } from './GestionCuentasBancariasTest';
import { estadosLotesPagoTest } from './EstadosLotesPagoTest';
import { validacionFormulariosTest } from './ValidacionFormulariosTest';
import { filtrosBusquedaTest } from './FiltrosBusquedaTest';
import { paginacionTest } from './PaginacionTest';
import { migracionBancosTest } from './MigracionBancosTest';
import { manejoErroresImportTest } from './ManejoErroresImportTest';
import { flujoCompletoBalancesTest } from './FlujoCompletoBalancesTest';
import { signosBalancesTest } from './SignosBalancesTest';

export const testsList = [
  // Tests de Responsables
  importResponsablesTest,
  importCuentasPropietariosTest,
  duplicadosResponsablesTest,
  resumenImportTest,
  
  // Tests de Cuentas y Balances
  signosBalancesTest,
  identificarPropietariosTest,
  crearOmitirCuentasTest,
  gestionCuentasBancariasTest,
  distribucionSaldosTest,
  
  // Tests de Lotes y Pagos
  estadosLotesPagoTest,
  flujoCompletoBalancesTest,
  
  // Tests de Transacciones
  asignacionTransaccionesTest,
  
  // Tests de Validación y UX
  validacionFormulariosTest,
  filtrosBusquedaTest,
  paginacionTest,
  formatoMontosTest,
  
  // Tests de Migraciones
  migracionBancosTest,
  manejoErroresImportTest,
];
