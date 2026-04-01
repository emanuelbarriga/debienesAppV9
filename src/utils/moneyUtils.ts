/**
 * Utilidades para manejo de montos en formato COP (Peso Colombiano)
 * El COP no usa centavos en operaciones reales, pero los CSVs pueden traer decimales
 */

/**
 * Parsea un monto en formato COP colombiano a número entero
 * Formatos soportados:
 * - "$ 4.027.033,00" → 4027033
 * - "-$ 4.027.033,00" → -4027033
 * - "$ 0,00" → 0
 * - "48.106.189,99" → 48106190 (redondea)
 */
export function parseCOPAmount(value: string | undefined): number {
  if (!value) return 0;

  // Normalizar: quitar espacios
  let normalized = value.toString().trim();
  
  // Manejar signo negativo (puede estar al inicio o después del $)
  const isNegative = normalized.includes('-');
  
  // Quitar todos los símbolos: $, -, espacios
  normalized = normalized
    .replace(/\$/g, '')
    .replace(/-/g, '')
    .replace(/\s/g, '');
  
  // Quitar puntos de miles
  normalized = normalized.replace(/\./g, '');
  
  // Convertir coma decimal a punto
  normalized = normalized.replace(/,/g, '.');
  
  // Parsear a número
  const amount = parseFloat(normalized);
  
  if (isNaN(amount)) {
    console.warn('Invalid COP amount format:', value);
    return 0;
  }
  
  // Redondear a entero (COP no usa centavos en operaciones reales)
  const rounded = Math.round(amount);
  
  return isNegative ? -rounded : rounded;
}

/**
 * Formatea un número a formato COP para display
 */
export function formatCOPAmount(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Formatear con separadores de miles
  const formatted = absAmount.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return `${isNegative ? '-' : ''}$ ${formatted}`;
}

/**
 * Tests unitarios - Ejecutar en consola con testParseCOPAmount()
 */
export function testParseCOPAmount(): void {
  const tests = [
    { input: '-$ 4.027.033,00', expected: -4027033, desc: 'Negativo con decimales' },
    { input: '$ 0,00', expected: 0, desc: 'Cero' },
    { input: '$ 1.234.567,89', expected: 1234568, desc: 'Positivo con redondeo' },
    { input: '-$ 25.000,00', expected: -25000, desc: 'Negativo simple' },
    { input: '', expected: 0, desc: 'Vacío' },
    { input: '$ 123', expected: 123, desc: 'Sin decimales' },
    { input: '$ 48.106.189,99', expected: 48106190, desc: 'Número grande con redondeo' },
    { input: '825,00', expected: 825, desc: 'Sin símbolo $' },
    { input: '-$ 79.719,00', expected: -79719, desc: 'Negativo mediano' },
    { input: '$ 20.072.163,10', expected: 20072163, desc: 'Millones con decimales' }
  ];
  
  console.group('🧪 Tests parseCOPAmount()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = parseCOPAmount(input);
    const success = result === expected;
    
    if (success) {
      console.log(`✅ ${desc}: "${input}" → ${result}`);
      passed++;
    } else {
      console.error(`❌ ${desc}: "${input}" → ${result} (esperado: ${expected})`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultado: ${passed} pasaron, ${failed} fallaron`);
  console.groupEnd();
}

/**
 * Tests para formatCOPAmount
 */
export function testFormatCOPAmount(): void {
  const tests = [
    { input: 4027033, expected: '$ 4.027.033', desc: 'Millones' },
    { input: -4027033, expected: '-$ 4.027.033', desc: 'Millones negativos' },
    { input: 0, expected: '$ 0', desc: 'Cero' },
    { input: 123, expected: '$ 123', desc: 'Centenas' }
  ];
  
  console.group('🧪 Tests formatCOPAmount()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = formatCOPAmount(input);
    const success = result === expected;
    
    if (success) {
      console.log(`✅ ${desc}: ${input} → "${result}"`);
      passed++;
    } else {
      console.error(`❌ ${desc}: ${input} → "${result}" (esperado: "${expected}")`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultado: ${passed} pasaron, ${failed} fallaron`);
  console.groupEnd();
}

/**
 * Ejecuta todos los tests
 */
export function runAllMoneyTests(): void {
  testParseCOPAmount();
  testFormatCOPAmount();
}
