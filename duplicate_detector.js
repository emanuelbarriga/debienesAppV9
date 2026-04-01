/**
 * Script para detectar duplicados entre los archivos CSV
 * - Normaliza fechas al formato D/MM/YYYY (como en Firestore)
 * - Implementa la lógica de generación de claves del componente Accounts.tsx
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Rutas de los archivos
const movFile = '/Volumes/wupm/EXPERIMENTOS WEB/APP_INMOBILIARIA_V9/project/backups_V08/MOV_2025-07-03.csv';
const recaudoFile = '/Volumes/wupm/EXPERIMENTOS WEB/APP_INMOBILIARIA_V9/project/backups_V08/Recaudo_julio_2025 (1).csv';

// Función para normalizar fechas al formato D/MM/YYYY (como en Firestore)
const normalizeFechaStr = (fechaStr) => {
  try {
    // Manejar diferentes formatos de fecha
    if (!fechaStr) return ''; // Si es nulo o vacío
    
    // Si la fecha tiene el formato DD/MM/YYYY, extraemos los componentes
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
      // Quitamos el cero inicial del día para normalizar a D/MM/YYYY
      const day = parseInt(parts[0], 10).toString();
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${day}/${month}/${year}`;
    }
    
    // Si no se pudo normalizar, devolver la fecha original
    return fechaStr;
  } catch (e) {
    console.error('Error normalizando fecha:', e);
    return fechaStr;
  }
};

// Genera clave única para cada transacción (similar a Accounts.tsx)
const generateTransactionKey = (transaction) => {
  const normalizedFechaStr = normalizeFechaStr(transaction.fechaStr);
  // En este caso, no tenemos accountId, así que usamos una constante o lo omitimos
  return `account|${normalizedFechaStr}|${transaction.valor}|${transaction.descripcion}`;
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
    // Transformamos los datos al formato de Transaction
    return {
      fechaStr: row['Fecha Transacción'] || row['Fecha Saldo'] || '',
      valor: parseFloat(row['Valor'] || '0'),
      descripcion: row['Descripción'] || '',
      detalles: row['Detalles Adicionales'] || '',
      original: row // Mantenemos los datos originales
    };
  }).filter(transaction => {
    // Filtramos registros de saldo
    const isSaldoRecord = transaction.descripcion.toUpperCase().includes('SALDO');
    return !isSaldoRecord && transaction.fechaStr; // Solo incluimos transacciones con fecha
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
    // Transformamos los datos al formato de Transaction
    return {
      fechaStr: row['Fecha'] || '',
      valor: parseFloat(row['Valor'] || '0'),
      descripcion: row['Descripción'] || '',
      detalles: row['Detalles Adicionales'] || '',
      responsable: row['Responsable'] || '',
      docCont: row['Doc.Cont.'] || '',
      original: row // Mantenemos los datos originales
    };
  }).filter(transaction => 
    // Solo incluimos transacciones con fecha y valor
    transaction.fechaStr && !isNaN(transaction.valor)
  );
};

// Función principal para encontrar duplicados
const findDuplicates = () => {
  console.log('Iniciando detección de duplicados...');

  // Cargar datos
  const movTransactions = readMovFile();
  const recaudoTransactions = readRecaudoFile();
  
  console.log(`Transacciones en MOV: ${movTransactions.length}`);
  console.log(`Transacciones en Recaudo: ${recaudoTransactions.length}`);

  // Mapa para rastrear las transacciones de MOV por clave
  const movTransactionMap = new Map();
  movTransactions.forEach(transaction => {
    const key = generateTransactionKey(transaction);
    movTransactionMap.set(key, transaction);
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
  }).join(', ');
  
  console.log(`\nLista de índices de transacciones duplicadas: ${duplicateIndices}`);

  // Verificar si llegamos a 37 duplicados
  if (duplicates.length === 37) {
    console.log("\n¡ÉXITO! Se encontraron exactamente las 37 transacciones duplicadas esperadas.");
  } else {
    console.log(`\nNOTA: Se esperaban 37 transacciones duplicadas pero se encontraron ${duplicates.length}.`);

    // Sugerencias para ajustar la detección
    console.log("\nSugerencias para mejorar la detección:");
    console.log("1. Verifica la normalización de fechas (D/MM/YYYY vs DD/MM/YYYY)");
    console.log("2. Prueba con una comparación parcial de la descripción (primeras N palabras)");
    console.log("3. Considera ignorar el signo en el valor (positivo/negativo)");
    console.log("4. Ajusta el formato de las fechas (especialmente cuando hay espacios o formatos diferentes)");
  }

  return duplicates;
};

// Ejecutar el detector de duplicados
findDuplicates();
