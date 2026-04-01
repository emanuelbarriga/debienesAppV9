/**
 * Script para ejecutar todos los tests de las utilidades
 * Ejecuta esto en la consola del navegador para probar las funciones críticas
 */

import { runAllMoneyTests } from './moneyUtils';
import { runAllCSVTests } from './csvUtils';
import { runAllOwnerAccountTests } from './ownerAccountUtils';

export function runAllTests() {
  console.clear();
  console.log('🚀 Ejecutando todos los tests de utilidades...\n');
  
  // Tests de moneyUtils
  runAllMoneyTests();
  console.log('\n');
  
  // Tests de csvUtils
  runAllCSVTests();
  console.log('\n');
  
  // Tests de ownerAccountUtils
  runAllOwnerAccountTests();
  
  console.log('\n✨ Tests completados');
}

// Para uso desde consola del navegador:
// import { runAllTests } from './utils/runTests'
// runAllTests()
