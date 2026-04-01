/**
 * Script mejorado para detectar duplicados entre los archivos CSV
 * - Implementa múltiples estrategias de normalización
 * - Ofrece opciones de comparación flexible
 * - Muestra información detallada para el diagnóstico
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Rutas de los archivos
const movFile = '/Volumes/wupm/EXPERIMENTOS WEB/APP_INMOBILIARIA_V9/project/backups_V08/MOV_2025-07-03.csv';
const recaudoFile = '/Volumes/wupm/EXPERIMENTOS WEB/APP_INMOBILIARIA_V9/project/backups_V08/Recaudo_julio_2025 (1).csv';

// Opciones de comparación
const CONFIG = {
  // Normalización de fechas
  normalizeFechas: true,
  // Comparación estricta de descripción o parcial
  descripcionEstricta: true,
  // Ignorar signos en los valores (usar valor absoluto)
  ignorarSignos: false,
  // Mostrar todas las transacciones para diagnóstico
  debugMode: false
};

// Función mejorada para normalizar fechas al formato D/MM/YYYY
const normalizeFechaStr = (fechaStr) => {
  try {
    if (!fechaStr) return '';
    
    // Eliminar espacios en blanco
    fechaStr = fechaStr.trim();
    
    // Si la fecha tiene el formato DD/MM/YYYY o D/MM/YYYY, extraemos los componentes
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
      // Quitamos el cero inicial del día para normalizar a D/MM/YYYY
      const day = parseInt(parts[0], 10).toString();
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${day}/${month}/${year}`;
    }
    
    return fechaStr;
  } catch (e) {
    console.error('Error normalizando fecha:', e);
    return fechaStr;
  }
};

// Función para normalizar descripción (eliminar espacios extra, etc)
const normalizeDescripcion = (descripcion) => {
  if (!descripcion) return '';
  return descripcion.trim().replace(/\s+/g, ' ');
};

// Genera clave única para cada transacción con opciones de flexibilidad
const generateTransactionKey = (transaction) => {
  const normalizedFechaStr = CONFIG.normalizeFechas ? 
                             normalizeFechaStr(transaction.fechaStr) : 
                             transaction.fechaStr;
  
  const descripcion = CONFIG.descripcionEstricta ? 
                      normalizeDescripcion(transaction.descripcion) :
                      normalizeDescripcion(transaction.descripcion).split(' ').slice(0, 3).join(' ');
  
  const valor = CONFIG.ignorarSignos ? 
                Math.abs(transaction.valor).toString() : 
                transaction.valor.toString();
  
  return `account|${normalizedFechaStr}|${valor}|${descripcion}`;
};

// Leer y parsear el archivo MOV_2025-07-03.csv
const readMovFile = () => {
  const content = fs.readFileSync(movFile, 'utf8');
  const result = Papa.parse(content, {
    delimiter: ';',
    header: true,
    skipEmptyLines: true
  });
  
  return result.data.map(row => {
    return {
      fechaStr: row['Fecha Transacción'] || row['Fecha Saldo'] || '',
      valor: parseFloat(row['Valor'] || '0'),
      descripcion: row['Descripción'] || '',
      detalles: row['Detalles Adicionales'] || '',
      original: row
    };
  }).filter(transaction => {
    const isSaldoRecord = transaction.descripcion.toUpperCase().includes('SALDO');
    return !isSaldoRecord && transaction.fechaStr;
  });
};

// Leer y parsear el archivo Recaudo_julio_2025 (1).csv
const readRecaudoFile = () => {
  const content = fs.readFileSync(recaudoFile, 'utf8');
  const result = Papa.parse(content, {
    delimiter: ',',
    header: true,
    skipEmptyLines: true
  });
  
  return result.data.map(row => {
    return {
      fechaStr: row['Fecha'] || '',
      valor: parseFloat(row['Valor'] || '0'),
      descripcion: row['Descripción'] || '',
      detalles: row['Detalles Adicionales'] || '',
      responsable: row['Responsable'] || '',
      docCont: row['Doc.Cont.'] || '',
      original: row
    };
  }).filter(transaction => 
    transaction.fechaStr && !isNaN(transaction.valor)
  );
};

// Función principal para encontrar duplicados
const findDuplicates = () => {
  console.log('======================================================');
  console.log('DETECTOR DE TRANSACCIONES DUPLICADAS - VERSIÓN MEJORADA');
  console.log('======================================================');
  console.log('Configuración:');
  console.log(`- Normalización de fechas: ${CONFIG.normalizeFechas ? 'Activada (D/MM/YYYY)' : 'Desactivada'}`);
  console.log(`- Comparación de descripción: ${CONFIG.descripcionEstricta ? 'Estricta' : 'Parcial (primeras 3 palabras)'}`);
  console.log(`- Ignorar signos en valores: ${CONFIG.ignorarSignos ? 'Sí' : 'No'}`);
  console.log('------------------------------------------------------');

  // Cargar datos
  const movTransactions = readMovFile();
  const recaudoTransactions = readRecaudoFile();
  
  console.log(`Transacciones en MOV: ${movTransactions.length}`);
  console.log(`Transacciones en Recaudo: ${recaudoTransactions.length}`);
  console.log('------------------------------------------------------');

  if (CONFIG.debugMode) {
    console.log('\nDETALLES DE TRANSACCIONES MOV:');
    movTransactions.forEach((t, i) => {
      console.log(`[${i+1}] ${t.fechaStr} - ${t.valor} - ${t.descripcion} - Clave: ${generateTransactionKey(t)}`);
    });
    
    console.log('\nDETALLES DE TRANSACCIONES RECAUDO:');
    recaudoTransactions.forEach((t, i) => {
      console.log(`[${i+1}] ${t.fechaStr} - ${t.valor} - ${t.descripcion} - Clave: ${generateTransactionKey(t)}`);
    });
  }

  // Mapas para rastrear transacciones
  const movTransactionMap = new Map();
  const recaudoTransactionMap = new Map();
  
  movTransactions.forEach(transaction => {
    const key = generateTransactionKey(transaction);
    movTransactionMap.set(key, transaction);
  });
  
  recaudoTransactions.forEach(transaction => {
    const key = generateTransactionKey(transaction);
    recaudoTransactionMap.set(key, transaction);
  });

  // Buscar duplicados
  const duplicates = [];
  recaudoTransactions.forEach(transaction => {
    const key = generateTransactionKey(transaction);
    
    if (movTransactionMap.has(key)) {
      const matchingMov = movTransactionMap.get(key);
      duplicates.push({
        recaudo: transaction,
        mov: matchingMov,
        key
      });
    }
  });

  // Transacciones no emparejadas para diagnóstico
  const unpairedRecaudo = recaudoTransactions.filter(t => 
    !duplicates.some(d => d.recaudo === t)
  );

  console.log(`\nSe encontraron ${duplicates.length} transacciones duplicadas:`);
  
  // Mostrar los duplicados encontrados
  duplicates.forEach((dup, index) => {
    console.log(`\n${index + 1}. DUPLICADO - Clave: ${dup.key}`);
    console.log(`   MOV: ${dup.mov.fechaStr} - ${dup.mov.valor} - ${dup.mov.descripcion}`);
    console.log(`   Recaudo: ${dup.recaudo.fechaStr} - ${dup.recaudo.valor} - ${dup.recaudo.descripcion} - Doc: ${dup.recaudo.docCont || 'N/A'} - Responsable: ${dup.recaudo.responsable || 'N/A'}`);
  });

  // Generar lista de índices de duplicados en el archivo de recaudo
  const duplicateIndices = duplicates.map(dup => {
    const indice = dup.recaudo.original['Índ.'];
    return indice ? `#${indice}` : 'Sin índice';
  });
  
  console.log(`\nLista de índices de transacciones duplicadas: ${duplicateIndices.join(', ')}`);
  console.log(`\nCantidad total de duplicados encontrados: ${duplicates.length}`);

  // Mostrar transacciones no emparejadas para diagnóstico
  if (unpairedRecaudo.length > 0 && CONFIG.debugMode) {
    console.log('\n\nTRANSACCIONES DE RECAUDO SIN EMPAREJAR:');
    console.log('------------------------------------------------------');
    unpairedRecaudo.forEach((t, i) => {
      console.log(`${i+1}. Recaudo sin emparejar - ${t.fechaStr} - ${t.valor} - ${t.descripcion} - Índice: ${t.original['Índ.']} - Clave: ${generateTransactionKey(t)}`);
      
      // Buscar posibles coincidencias parciales
      const possibleMatches = movTransactions.filter(m => 
        normalizeFechaStr(m.fechaStr) === normalizeFechaStr(t.fechaStr) &&
        Math.abs(m.valor) === Math.abs(t.valor)
      );
      
      if (possibleMatches.length > 0) {
        console.log('   POSIBLES COINCIDENCIAS:');
        possibleMatches.forEach((pm, j) => {
          console.log(`   ${j+1}. MOV - ${pm.fechaStr} - ${pm.valor} - ${pm.descripcion} - Clave: ${generateTransactionKey(pm)}`);
        });
      }
    });
  }

  // Analizar específicamente el problema del índice #15 duplicado
  const indice15 = recaudoTransactions.filter(t => t.original['Índ.'] === '15');
  if (indice15.length > 1) {
    console.log('\n\nANÁLISIS DE ÍNDICES DUPLICADOS:');
    console.log('------------------------------------------------------');
    console.log(`Se encontraron ${indice15.length} registros con índice #15:`);
    
    indice15.forEach((t, i) => {
      const isDuplicate = duplicates.some(d => d.recaudo === t);
      console.log(`${i+1}. Índice #15 - ${t.fechaStr} - ${t.valor} - ${t.descripcion} - ${isDuplicate ? 'DUPLICADO' : 'NO DUPLICADO'}`);
    });
  }

  // Verificar si llegamos a 37 duplicados
  if (duplicates.length === 37) {
    console.log("\n¡ÉXITO! Se encontraron exactamente las 37 transacciones duplicadas esperadas.");
  } else {
    console.log(`\nNOTA: Se esperaban 37 transacciones duplicadas pero se encontraron ${duplicates.length}.`);
  }

  return duplicates;
};

// Ejecutar el detector de duplicados con la configuración actual
findDuplicates();

// Si quieres probar con otras configuraciones, descomenta estas líneas
/*
console.log('\n\nEJECUTANDO CON CONFIGURACIÓN ALTERNATIVA...');
CONFIG.descripcionEstricta = false;
CONFIG.ignorarSignos = true;
findDuplicates();
*/
