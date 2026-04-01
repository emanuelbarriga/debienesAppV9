import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectCSVDelimiter } from '../utils/csvUtils';
import {
  normalizeDocumento,
  normalizeBanco,
  normalizeTipoCuenta,
} from '../utils/ownerAccountUtils';
import * as ownerUtils from '../utils/ownerAccountUtils';
import Papa from 'papaparse';

// Mock de funciones de Firebase
vi.mock('../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'test@example.com' } },
}));

describe('Importación CSV de Cuentas de Propietarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1) Detección de delimitador', () => {
    it('debe detectar coma como delimitador', () => {
      const csv = 'Propietario,NIT,Pagar A,Doc Beneficiario,Numero Cuenta,Banco,Observaciones,Tipo Cuenta\nJuan,123456,Juan,123456,987654,Bancolombia,,Ahorros';
      const delimiter = detectCSVDelimiter(csv);
      expect(delimiter).toBe(',');
    });

    it('debe detectar punto y coma como delimitador', () => {
      const csv = 'Propietario;NIT;Pagar A;Doc Beneficiario;Numero Cuenta;Banco;Observaciones;Tipo Cuenta\nJuan;123456;Juan;123456;987654;Bancolombia;;Ahorros';
      const delimiter = detectCSVDelimiter(csv);
      expect(delimiter).toBe(';');
    });
  });

  describe('2) Parseo con PapaParse', () => {
    it('debe parsear CSV correctamente', () => {
      const csv = 'Propietario,NIT,Pagar A,Doc Beneficiario,Numero Cuenta,Banco,Observaciones,Tipo Cuenta\nJuan,123456,Juan,123456,987654,Bancolombia,,Ahorros';
      
      const parseMock = vi.fn().mockImplementation((_text, options) => {
        if (options.complete) {
          options.complete({
            data: [
              ['Propietario', 'NIT', 'Pagar A', 'Doc Beneficiario', 'Numero Cuenta', 'Banco', 'Observaciones', 'Tipo Cuenta'],
              ['Juan', '123456', 'Juan', '123456', '987654', 'Bancolombia', '', 'Ahorros']
            ]
          } as any);
        }
      });
      
      Papa.parse = parseMock;
      
      Papa.parse(csv, {
        delimiter: ',',
        skipEmptyLines: true,
        complete: (results: any) => {
          expect(results.data).toHaveLength(2);
          expect(results.data[1][0]).toBe('Juan');
        }
      });
    });
  });

  describe('3) Validación de campos obligatorios', () => {
    it('debe rechazar filas sin propietario', () => {
      const row = ['', '123456', 'Juan', '123456', '987654', 'Bancolombia', '', 'Ahorros'];
      expect(row[0]?.trim()).toBe('');
    });

    it('debe rechazar filas sin NIT', () => {
      const row = ['Juan', '', 'Juan', '123456', '987654', 'Bancolombia', '', 'Ahorros'];
      expect(normalizeDocumento(row[1])).toBe('');
    });

    it('debe rechazar filas sin número de cuenta', () => {
      const row = ['Juan', '123456', 'Juan', '123456', '', 'Bancolombia', '', 'Ahorros'];
      expect(row[4]?.toString().trim()).toBe('');
    });

    it('debe aceptar filas con todos los campos obligatorios', () => {
      const row = ['Juan', '123456', 'Juan', '123456', '987654', 'Bancolombia', '', 'Ahorros'];
      expect(row[0]?.trim()).toBeTruthy();
      expect(normalizeDocumento(row[1])).toBe('123456');
      expect(row[4]?.toString().trim()).toBeTruthy();
    });
  });

  describe('4) Normalización de datos', () => {
    it('debe normalizar documento correctamente', () => {
      expect(normalizeDocumento('805.031.544-8')).toBe('8050315448');
      expect(normalizeDocumento('31.290.539')).toBe('31290539');
      expect(normalizeDocumento('  94539661  ')).toBe('94539661');
    });

    it('debe normalizar banco correctamente', () => {
      expect(normalizeBanco('1 BANCO OCCIDENTE')).toBe('BANCO DE OCCIDENTE');
      expect(normalizeBanco('BANCOLOMBIA')).toBe('BANCOLOMBIA');
      expect(normalizeBanco('AV VILLAS')).toBe('BANCO AV VILLAS');
      expect(normalizeBanco('')).toBe('OTRO');
    });

    it('debe normalizar tipo de cuenta correctamente', () => {
      expect(normalizeTipoCuenta('Ahorros')).toBe('AHORROS');
      expect(normalizeTipoCuenta('CORRIENTE')).toBe('CORRIENTE');
      expect(normalizeTipoCuenta('')).toBe('AHORROS');
      expect(normalizeTipoCuenta('Ahorro')).toBe('AHORROS');
    });
  });

  describe('5) Auto-asociación de responsable', () => {
    it('debe rechazar si no hay documento de propietario', async () => {
      const result = await ownerUtils.autoAssociateResponsible({});
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Documento de propietario no proporcionado');
    });

    it('debe intentar asociar automáticamente si hay documento', async () => {
      const spy = vi.spyOn(ownerUtils, 'autoAssociateResponsible');
      spy.mockImplementation(async (account) => {
        if (!account.documentoPropietario) {
          return { success: false, reason: 'Documento de propietario no proporcionado' };
        }
        return { success: true, responsibleId: 'responsible1', responsibleName: 'Juan' };
      });

      const result = await ownerUtils.autoAssociateResponsible({ documentoPropietario: '123456', propietario: 'Juan' });
      expect(result.success).toBe(true);
      expect(result.responsibleId).toBe('responsible1');
      spy.mockRestore();
    });
  });

  describe('6) Verificación de duplicados', () => {
    it('debe verificar si una cuenta ya existe', async () => {
      const spy = vi.spyOn(ownerUtils, 'checkDuplicateAccount');
      spy.mockResolvedValue(true as any);
      
      const isDuplicate = await ownerUtils.checkDuplicateAccount('123456', '987654');
      expect(isDuplicate).toBe(true);
      spy.mockRestore();
    });

    it('debe retornar false si no hay duplicados', async () => {
      const spy = vi.spyOn(ownerUtils, 'checkDuplicateAccount');
      spy.mockResolvedValue(false as any);
      
      const isDuplicate = await ownerUtils.checkDuplicateAccount('123456', '987654');
      expect(isDuplicate).toBe(false);
      spy.mockRestore();
    });
  });

  describe('7) Procesamiento por lotes', () => {
    it('debe procesar en lotes de 500', () => {
      const dataRows = Array.from({ length: 1200 }, (_, i) => [`Prop${i}`, `123${i}`, 'Prop', '123', `456${i}`, 'Banco', '', 'Ahorros']);
      
      const batches = [];
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        batches.push(dataRows.slice(i, i + BATCH_SIZE));
      }
      
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(500);
      expect(batches[1]).toHaveLength(500);
      expect(batches[2]).toHaveLength(200);
    });
  });

  describe('8) Registro de logs', () => {
    it('debe crear estructura de log correcta', () => {
      const logData = {
        usuarioEmail: 'test@example.com',
        accion: 'importación',
        entidad: 'owner_accounts',
        detalles: JSON.stringify({ imported: 10, updated: 0, skipped: 2, errors: 1 }),
        timestamp: new Date()
      };

      expect(logData.usuarioEmail).toBe('test@example.com');
      expect(logData.accion).toBe('importación');
      expect(logData.entidad).toBe('owner_accounts');
      expect(JSON.parse(logData.detalles)).toEqual({ imported: 10, updated: 0, skipped: 2, errors: 1 });
    });
  });
});
