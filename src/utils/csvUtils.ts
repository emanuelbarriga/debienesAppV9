/**
 * Utilidades para procesamiento de archivos CSV
 */

/**
 * Detecta automáticamente el delimitador usado en un CSV
 * Analiza las primeras líneas y determina si usa ',' o ';'
 */
export function detectCSVDelimiter(content: string): ',' | ';' {
  // Tomar las primeras 5 líneas para análisis
  const lines = content.split('\n').slice(0, 5);
  
  let semicolonCount = 0;
  let commaCount = 0;
  
  lines.forEach(line => {
    // Contar ocurrencias de cada delimitador
    semicolonCount += (line.match(/;/g) || []).length;
    commaCount += (line.match(/,/g) || []).length;
  });
  
  // El delimitador más frecuente es el correcto
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Normaliza texto CSV corrigiendo problemas de encoding
 * Útil para CSVs con caracteres mal codificados (Ð → Ñ, etc.)
 */
export function normalizeCSVText(content: string): string {
  return content
    .replace(/Ð/g, 'Ñ') // Corregir Ñ mal codificada
    .replace(/ð/g, 'ñ')
    .trim();
}

/**
 * Genera hash SHA-256 de un archivo para auditoría
 */
export async function hashFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Error generating file hash:', error);
    return '';
  }
}

/**
 * Genera hash SHA-256 de un string
 */
export async function hashString(content: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Error generating string hash:', error);
    return '';
  }
}

/**
 * Tests unitarios
 */
export function testDetectCSVDelimiter(): void {
  const tests = [
    {
      input: 'PROPIETARIO;NIT;SALDO\nACHINTE;94539661;$ 0,00',
      expected: ';',
      desc: 'CSV con punto y coma'
    },
    {
      input: 'PROPIETARIO,NIT,SALDO\nACHINTE,94539661,$ 0.00',
      expected: ',',
      desc: 'CSV con coma'
    },
    {
      input: 'A;B;C;D\nE;F;G;H\nI;J;K;L',
      expected: ';',
      desc: 'Múltiples líneas con punto y coma'
    }
  ];
  
  console.group('🧪 Tests detectCSVDelimiter()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = detectCSVDelimiter(input);
    const success = result === expected;
    
    if (success) {
      console.log(`✅ ${desc}: detectado "${result}"`);
      passed++;
    } else {
      console.error(`❌ ${desc}: detectado "${result}" (esperado: "${expected}")`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultado: ${passed} pasaron, ${failed} fallaron`);
  console.groupEnd();
}

export function testNormalizeCSVText(): void {
  const tests = [
    {
      input: 'CASTAÐO SALAZAR',
      expected: 'CASTANO SALAZAR',
      desc: 'Ñ mal codificada (Ð)'
    },
    {
      input: 'MUÐOZ LOPEZ',
      expected: 'MUÑOZ LOPEZ',
      desc: 'ñ mal codificada (ð)'
    }
  ];
  
  console.group('🧪 Tests normalizeCSVText()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = normalizeCSVText(input);
    const success = result === expected;
    
    if (success) {
      console.log(`✅ ${desc}: "${input}" → "${result}"`);
      passed++;
    } else {
      console.error(`❌ ${desc}: "${input}" → "${result}" (esperado: "${expected}")`);
      failed++;
    }
  });
  
  console.log(`\n📊 Resultado: ${passed} pasaron, ${failed} fallaron`);
  console.groupEnd();
}

export function runAllCSVTests(): void {
  testDetectCSVDelimiter();
  testNormalizeCSVText();
}
