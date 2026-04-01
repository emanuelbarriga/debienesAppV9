import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { describe, it, expect } from 'vitest';
import { detectCSVDelimiter } from '../utils/csvUtils';
import { normalizeDocumento, normalizeBanco, normalizeTipoCuenta } from '../utils/ownerAccountUtils';

// Este test lee el CSV real y valida sin escribir en Firestore (solo consola/expect)
describe('Dry-run CSV de cuentas de propietarios (sin escribir en DB)', () => {
  it('debe poder parsear y validar filas requeridas del archivo', async () => {
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

    // Salta cabecera
    const dataRows = rows.slice(1);

    let validRows = 0;
    const errors: Array<{ row: number; message: string }> = [];

    dataRows.forEach((row, idx) => {
      const rowNum = idx + 2; // +2 por cabecera y base 1
      const propietario = row[0]?.trim();
      const nitPropietario = normalizeDocumento(row[1]);
      const numeroCuenta = row[4]?.toString().trim();
      const banco = normalizeBanco(row[5]);
      const tipoCuenta = normalizeTipoCuenta(row[7]);

      if (!propietario || !nitPropietario || !numeroCuenta) {
        errors.push({ row: rowNum, message: 'Faltan campos obligatorios' });
        return;
      }

      // Normalización extra solo para confirmar que no rompe
      if (!banco || !tipoCuenta) {
        errors.push({ row: rowNum, message: 'Normalización falló' });
        return;
      }

      validRows++;
    });

    console.info(`[CSV Dry-run] Filas totales: ${dataRows.length}, válidas: ${validRows}, errores: ${errors.length}`);
    if (errors.length) {
      console.info('[CSV Dry-run] Errores de validación:', errors.slice(0, 10));
    }

    expect(dataRows.length).toBeGreaterThan(0);
    // No fallamos si todas las filas están incompletas; el objetivo es diagnosticar.
    // Si se quiere forzar al menos una válida, cambie a: expect(validRows).toBeGreaterThan(0);
  });
});
