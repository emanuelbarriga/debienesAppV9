import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { describe, it, expect } from 'vitest';
import { detectCSVDelimiter } from '../utils/csvUtils';
import { processBalanceRowFromCSV } from '../utils/balanceImportUtils';

// Pruebas del importador de saldos (no toca Firestore)
describe('Importación de saldos desde CSV', () => {
  it('procesa una fila válida invirtiendo el signo', () => {
    const row = ['Juan Perez', '123.456.789-0', '$ 1.000,00'];
    const result = processBalanceRowFromCSV(row);

    expect(result.isValid).toBe(true);
    expect(result.nit).toBe('1234567890');
    // Regla: monto positivo en CSV se guarda negativo
    expect(result.saldo).toBe(-1000);
  });

  it('marca inválida una fila sin propietario o NIT', () => {
    const noOwner = processBalanceRowFromCSV(['', '123', '$ 500,00']);
    const noNit = processBalanceRowFromCSV(['Juan', '', '$ 500,00']);

    expect(noOwner.isValid).toBe(false);
    expect(noNit.isValid).toBe(false);
  });

  it('lee y valida el CSV real SALDO_PROP_NOV.csv (dry-run sin DB)', () => {
    const filePath = path.join(process.cwd(), 'csv', 'SALDO_PROP_NOV.csv');
    const text = fs.readFileSync(filePath, 'utf8');
    const delimiter = detectCSVDelimiter(text);

    const rows: string[][] = [];
    Papa.parse<string[]>(text, {
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        rows.push(...(results.data as string[][]));
      },
      error: (err: unknown) => {
        throw err;
      }
    });

    const dataRows = rows; // no header en este archivo
    let validRows = 0;
    let invalidRows = 0;
    let positives = 0;
    let negatives = 0;

    dataRows.forEach((row, idx) => {
      const result = processBalanceRowFromCSV(row);
      if (result.isValid) {
        validRows++;
        if (result.saldo >= 0) positives++;
        else negatives++;
      } else {
        invalidRows++;
        // Log suave para diagnóstico
        console.info(`[Saldos Dry-run] Fila ${idx + 1} inválida: ${result.error}`);
      }
    });

    console.info(`[Saldos Dry-run] Filas totales: ${dataRows.length}, válidas: ${validRows}, inválidas: ${invalidRows}, saldo>=0: ${positives}, saldo<0: ${negatives}`);

    expect(dataRows.length).toBeGreaterThan(0);
    expect(validRows).toBeGreaterThan(0);
  });

  it('lee y valida el CSV real PAGO PROPIETARIOS DIC.csv (dry-run sin DB)', () => {
    const filePath = path.join(process.cwd(), 'csv', 'PAGO PROPIETARIOS DIC.csv');
    const text = fs.readFileSync(filePath, 'utf8');
    const delimiter = detectCSVDelimiter(text);

    const rows: string[][] = [];
    Papa.parse<string[]>(text, {
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        rows.push(...(results.data as string[][]));
      },
      error: (err: unknown) => {
        throw err;
      }
    });

    const dataRows = rows; // no header en este archivo
    let validRows = 0;
    let invalidRows = 0;
    let positives = 0;
    let negatives = 0;

    dataRows.forEach((row, idx) => {
      const result = processBalanceRowFromCSV(row);
      if (result.isValid) {
        validRows++;
        if (result.saldo >= 0) positives++;
        else negatives++;
      } else {
        invalidRows++;
        console.info(`[Pagos Dry-run] Fila ${idx + 1} inválida: ${result.error}`);
      }
    });

    console.info(`[Pagos Dry-run] Filas totales: ${dataRows.length}, válidas: ${validRows}, inválidas: ${invalidRows}, saldo>=0: ${positives}, saldo<0: ${negatives}`);

    expect(dataRows.length).toBeGreaterThan(0);
    expect(validRows).toBeGreaterThan(0);
  });

  it('lee y valida el CSV real PROP_FEB26.csv (dry-run sin DB, con/sin encabezado)', () => {
    const filePath = path.join(process.cwd(), 'csv', 'PROP_FEB26.csv');
    const text = fs.readFileSync(filePath, 'utf8');
    const delimiter = detectCSVDelimiter(text);

    const rows: string[][] = [];
    Papa.parse<string[]>(text, {
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        rows.push(...(results.data as string[][]));
      },
      error: (err: unknown) => {
        throw err;
      }
    });

    // Omitir encabezado si viene
    const isHeader = (row: string[]) =>
      row[0]?.toUpperCase().includes('PROPIETARIO') && row[1]?.toUpperCase().includes('NIT');
    const dataRows = rows.length > 0 && isHeader(rows[0]) ? rows.slice(1) : rows;

    let validRows = 0;
    let invalidRows = 0;
    let positives = 0;
    let negatives = 0;

    dataRows.forEach((row, idx) => {
      const result = processBalanceRowFromCSV(row);
      if (result.isValid) {
        validRows++;
        if (result.saldo >= 0) positives++;
        else negatives++;
      } else {
        invalidRows++;
        console.info(`[PROP_FEB26 Dry-run] Fila ${idx + 1} inválida: ${result.error}`);
      }
    });

    console.info(`[PROP_FEB26 Dry-run] Filas totales: ${dataRows.length}, válidas: ${validRows}, inválidas: ${invalidRows}, saldo>=0: ${positives}, saldo<0: ${negatives}`);

    expect(dataRows.length).toBeGreaterThan(0);
    expect(validRows).toBeGreaterThan(0);
  });
});
