/**
 * Script con estrategias flexibles de comparación para detectar duplicados
 * - Prueba diferentes configuraciones para encontrar los 37 duplicados esperados
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Rutas de los archivos
const movFile = '/Volumes/wupm/EXPERIMENTOS WEB/APP_INMOBILIARIA_V9/project/backups_V08/MOV_2025-07-03.csv';
const recaudoFile = '/Volumes/wupm/EXPERIMENTOS WEB/APP_INMOBILIARIA_V9/project/backups_V08/Recaudo_julio_2025 (1).csv';

// Función mejorada para normalizar fechas
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

// Función para normalizar descripción
const normalizeDescripcion = (descripcion, parcial = false) => {
  if (!descripcion) return '';
  const normalizado = descripcion.trim().replace(/\s+/g, ' ');
  
  if (parcial) {
    // Solo tomar las primeras palabras si es parcial
    return normalizado.split(' ').slice(0, 3).join(' ');
  }
  
  return normalizado;
};

// Leer y parsear el archivo MOV_2025-07-03.csv
const readMovFile = () => {
  const content = fs.readFileSync(movFile, 'utf8');
  const result = Papa.parse(content, {
    delimiter: ';',
    header: true,
    skipEmptyLines: true
  });
  
  return result.data.map((row, index) => {
    return {
      index: index + 1,
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
  
  return result.data.map((row, index) => {
    return {
      index: index + 1,
      indice: row['Índ.'] || '',
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

// Función para ejecutar la detección con diferentes configuraciones
const detectarDuplicados = () => {
  // Leer datos
  const movTransactions = readMovFile();
  const recaudoTransactions = readRecaudoFile();
  
  console.log('======================================================');
  console.log('DETECTOR DE DUPLICADOS CON MÚLTIPLES ESTRATEGIAS');
  console.log('======================================================');
  console.log(`Total transacciones MOV: ${movTransactions.length}`);
  console.log(`Total transacciones Recaudo: ${recaudoTransactions.length}`);
  
  // Definimos diferentes estrategias de detección
  const estrategias = [
    {
      nombre: "Estrategia 1: Coincidencia exacta (fecha D/MM/YYYY, valor exacto, descripción exacta)",
      descripcionParcial: false,
      valorAbsoluto: false,
      fechaNormalizada: true
    },
    {
      nombre: "Estrategia 2: Coincidencia con descripción parcial (primeras 3 palabras)",
      descripcionParcial: true,
      valorAbsoluto: false,
      fechaNormalizada: true
    },
    {
      nombre: "Estrategia 3: Coincidencia con valor absoluto (ignorar signos)",
      descripcionParcial: false,
      valorAbsoluto: true,
      fechaNormalizada: true
    },
    {
      nombre: "Estrategia 4: Combinación de descripción parcial y valor absoluto",
      descripcionParcial: true,
      valorAbsoluto: true,
      fechaNormalizada: true
    }
  ];
  
  // Probar cada estrategia
  estrategias.forEach(estrategia => {
    console.log('\n------------------------------------------------------');
    console.log(estrategia.nombre);
    console.log('------------------------------------------------------');
    
    const duplicados = encontrarDuplicados(
      movTransactions, 
      recaudoTransactions, 
      estrategia.descripcionParcial, 
      estrategia.valorAbsoluto, 
      estrategia.fechaNormalizada
    );
    
    console.log(`RESULTADO: Se encontraron ${duplicados.length} duplicados.`);
    
    // Si encontramos exactamente 37 duplicados, mostramos detalles completos
    if (duplicados.length === 37) {
      console.log('\n¡ÉXITO! Encontramos exactamente los 37 duplicados esperados con esta estrategia.');
      
      // Mostrar el duplicado "extra" encontrado por esta estrategia
      const duplicadosOtraEstrategia = encontrarDuplicados(movTransactions, recaudoTransactions, false, false, true);
      if (duplicadosOtraEstrategia.length === 36) {
        const nuevosIndices = duplicados.filter(d => !duplicadosOtraEstrategia.some(
          od => od.recaudo.indice === d.recaudo.indice
        ));
        
        if (nuevosIndices.length > 0) {
          console.log('\nDUPLICADO ADICIONAL ENCONTRADO:');
          nuevosIndices.forEach((dup) => {
            console.log(`Duplicado #${dup.recaudo.indice} - Fecha: ${dup.recaudo.fechaStr} - Valor: ${dup.recaudo.valor} - Descripción: ${dup.recaudo.descripcion}`);
            console.log(`MOV: ${dup.mov.fechaStr} - ${dup.mov.valor} - ${dup.mov.descripcion}`);
          });
        }
      }
      
      // Lista completa de índices
      const indicesDuplicados = duplicados.map(d => `#${d.recaudo.indice}`).sort();
      console.log('\nLista de índices encontrados:', indicesDuplicados.join(', '));
    } 
    else if (duplicados.length > 36) {
      console.log('\nEncontramos más duplicados de los esperados originalmente.');
      
      // Mostrar resumen de los duplicados "extra" encontrados
      const duplicadosOtraEstrategia = encontrarDuplicados(movTransactions, recaudoTransactions, false, false, true);
      const nuevosIndices = duplicados.filter(d => !duplicadosOtraEstrategia.some(
        od => od.recaudo.indice === d.recaudo.indice
      ));
      
      if (nuevosIndices.length > 0) {
        console.log('\nDUPLICADOS ADICIONALES ENCONTRADOS:');
        nuevosIndices.forEach((dup) => {
          console.log(`Duplicado #${dup.recaudo.indice} - Fecha: ${dup.recaudo.fechaStr} - Valor: ${dup.recaudo.valor} - Descripción: ${dup.recaudo.descripcion}`);
          console.log(`MOV: ${dup.mov.fechaStr} - ${dup.mov.valor} - ${dup.mov.descripcion}`);
        });
      }
    }
  });
  
  // Analizar registros con índices duplicados
  const indices = {};
  recaudoTransactions.forEach(t => {
    if (t.indice) {
      if (!indices[t.indice]) {
        indices[t.indice] = [];
      }
      indices[t.indice].push(t);
    }
  });
  
  console.log('\n\nANÁLISIS DE POSIBLES PROBLEMAS CON ÍNDICES:');
  console.log('------------------------------------------------------');
  
  // Buscar índices duplicados
  let indicesDuplicados = 0;
  Object.entries(indices).forEach(([indice, registros]) => {
    if (registros.length > 1) {
      indicesDuplicados++;
      console.log(`\nEl índice #${indice} aparece ${registros.length} veces:`);
      registros.forEach((reg, i) => {
        console.log(`${i+1}. ${reg.fechaStr} - ${reg.valor} - ${reg.descripcion} - Doc: ${reg.docCont || 'N/A'}`);
      });
    }
  });
  
  if (indicesDuplicados === 0) {
    console.log('No se encontraron índices duplicados en el archivo Recaudo.');
  }
  
  // Verificar si hay "huecos" en la numeración
  const expectedIndices = Array.from({length: recaudoTransactions.length}, (_, i) => (i + 1).toString());
  const missingIndices = expectedIndices.filter(i => !indices[i]);
  
  if (missingIndices.length > 0) {
    console.log('\nÍndices faltantes en el archivo Recaudo:', missingIndices.join(', '));
  } else {
    console.log('\nNo hay huecos en la numeración de índices.');
  }
};

// Función auxiliar para encontrar duplicados con la configuración especificada
function encontrarDuplicados(movTransactions, recaudoTransactions, descripcionParcial, valorAbsoluto, fechaNormalizada) {
  // Generar claves para MOV transactions
  const movMap = new Map();
  movTransactions.forEach(mov => {
    const fechaStr = fechaNormalizada ? normalizeFechaStr(mov.fechaStr) : mov.fechaStr;
    const descripcion = normalizeDescripcion(mov.descripcion, descripcionParcial);
    const valor = valorAbsoluto ? Math.abs(mov.valor) : mov.valor;
    
    const key = `account|${fechaStr}|${valor}|${descripcion}`;
    movMap.set(key, mov);
  });
  
  // Buscar coincidencias en Recaudo
  const duplicados = [];
  recaudoTransactions.forEach(recaudo => {
    const fechaStr = fechaNormalizada ? normalizeFechaStr(recaudo.fechaStr) : recaudo.fechaStr;
    const descripcion = normalizeDescripcion(recaudo.descripcion, descripcionParcial);
    const valor = valorAbsoluto ? Math.abs(recaudo.valor) : recaudo.valor;
    
    const key = `account|${fechaStr}|${valor}|${descripcion}`;
    
    if (movMap.has(key)) {
      duplicados.push({
        mov: movMap.get(key),
        recaudo,
        key
      });
    }
  });
  
  return duplicados;
}

// Ejecutar el detector con todas las estrategias
detectarDuplicados();
