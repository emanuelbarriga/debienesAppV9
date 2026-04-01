/**
 * Utilidades para gestión de cuentas de propietarios
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { OwnerAccount, Responsible } from '../types';

import { normalizeBancoName } from '../constants/banks';

/**
 * @deprecated Usar normalizeBancoName de constants/banks.ts
 * Mantenido por compatibilidad temporal
 */
export const BANCO_CATALOG: Record<string, string> = {
  '1 BANCO OCCIDENTE': 'BANCO DE OCCIDENTE',
  '1 POPULAR': 'BANCO POPULAR',
  'BANCOLOMBIA': 'BANCOLOMBIA',
  'AV VILLAS': 'BANCO AV VILLAS',
  'AVVILLAS': 'BANCO AV VILLAS',
  'NU BANK': 'LULO BANK',
  'NEQUI': 'NEQUI',
  'BANCO DE BOGOTA': 'BANCO DE BOGOTÁ',
  'BANCO DE BOGOTÁ': 'BANCO DE BOGOTÁ',
  'BANCOOMEVA': 'BANCOOMEVA',
  'BANCO AGRARIO DE COLOMBIA': 'BANCO AGRARIO',
  'BANCO GNB SUDAMERIS': 'BANCO GNB SUDAMERIS',
  'SCOTIABANK': 'SCOTIABANK COLPATRIA',
  'CAJA SOCIAL': 'BANCO CAJA SOCIAL',
  'DAVIVIENDA': 'DAVIVIENDA',
  'ITAU': 'ITAÚ',
  'BBVA': 'BBVA COLOMBIA',
  'BANCO UNION': 'BANCO POPULAR',
  'COPERATIVA FINANCIERA DE ANTIOQUIA': 'COOPERATIVA FINANCIERA DE ANTIOQUIA',
  'UALA': 'OTRO',
  'LULOBANK': 'LULO BANK'
};

/**
 * Normaliza un número de documento (quita puntos, guiones, espacios)
 */
export function normalizeDocumento(doc: string | undefined): string {
  if (!doc) return '';
  
  return doc
    .toString()
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '') // Por si viene con comas
    .trim();
}

/**
 * Normaliza nombre de propietario para matching
 * Quita acentos, convierte a minúsculas, normaliza espacios
 */
export function normalizeOwnerName(name: string | undefined): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ') // Múltiples espacios a uno
    .trim();
}

/**
 * Normaliza nombre de banco según catálogo estandarizado
 * Usa la lista oficial de bancos de Colombia
 */
export function normalizeBanco(banco: string | undefined): string {
  if (!banco) return 'OTRO';
  
  // Usar la función centralizada de normalización
  return normalizeBancoName(banco);
}

/**
 * Normaliza tipo de cuenta
 */
export function normalizeTipoCuenta(tipo: string | undefined): 'AHORROS' | 'CORRIENTE' {
  if (!tipo) return 'AHORROS';
  
  const upper = tipo.toUpperCase().trim();
  return upper.includes('AHORR') ? 'AHORROS' : 'CORRIENTE';
}

/**
 * Enmascara número de cuenta para display (muestra solo últimos 4 dígitos)
 */
export function maskAccountNumber(numero: string): string {
  if (!numero || numero.length <= 4) return numero;
  return '*'.repeat(numero.length - 4) + numero.slice(-4);
}

/**
 * Verifica si una cuenta ya existe (por documento + número de cuenta)
 */
export async function checkDuplicateAccount(
  documentoPropietario: string,
  numeroCuenta: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'ownerAccounts'),
      where('documentoPropietario', '==', documentoPropietario),
      where('numeroCuenta', '==', numeroCuenta)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking duplicate account:', error);
    return false;
  }
}

/**
 * Asociación automática de cuenta a responsable tipo 'owner'
 * Retorna: { success: boolean, reason?: string, responsibleId?: string, responsibleName?: string }
 */
export async function autoAssociateResponsible(
  account: Partial<OwnerAccount>
): Promise<{
  success: boolean;
  reason?: string;
  responsibleId?: string;
  responsibleName?: string;
}> {
  try {
    if (!account.documentoPropietario) {
      return { success: false, reason: 'Documento de propietario no proporcionado' };
    }
    
    const normalizedDoc = normalizeDocumento(account.documentoPropietario);
    
    console.log('🔍 Buscando asociación automática:', {
      documento: account.documentoPropietario,
      normalizado: normalizedDoc,
      propietario: account.propietario
    });
    
    // Buscar responsables tipo 'owner' con ese documento
    const q = query(
      collection(db, 'responsibles'),
      where('type', '==', 'owner'),
      where('identificacion', '==', normalizedDoc)
    );
    
    const snapshot = await getDocs(q);
    
    console.log('📊 Resultados búsqueda:', {
      encontrados: snapshot.size,
      documentos: snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    });
    
    // Sin coincidencias
    if (snapshot.empty) {
      console.warn('❌ No se encontró propietario con documento:', normalizedDoc);
      return {
        success: false,
        reason: 'No existe propietario con ese documento'
      };
    }
    
    // Múltiples coincidencias (ambiguo)
    if (snapshot.size > 1) {
      console.warn('⚠️ Múltiples propietarios encontrados:', snapshot.size);
      return {
        success: false,
        reason: `Múltiples propietarios con documento ${normalizedDoc}`
      };
    }
    
    // Una coincidencia: verificar nombre
    const responsible = snapshot.docs[0];
    const responsibleData = responsible.data() as Responsible;
    const responsibleName = normalizeOwnerName(responsibleData.name);
    const accountName = normalizeOwnerName(account.propietario);
    
    console.log('🔤 Comparación de nombres:', {
      responsibleOriginal: responsibleData.name,
      responsibleNormalizado: responsibleName,
      accountOriginal: account.propietario,
      accountNormalizado: accountName,
      coincide: responsibleName === accountName
    });
    
    // Match exacto de nombre
    if (responsibleName === accountName) {
      console.log('✅ Asociación exitosa:', responsible.id);
      return {
        success: true,
        responsibleId: responsible.id,
        responsibleName: responsibleData.name
      };
    }
    
    // Documento coincide pero nombre difiere
    console.warn('⚠️ Nombres no coinciden');
    return {
      success: false,
      reason: `Documento coincide pero nombre difiere: "${responsibleData.name}" vs "${account.propietario}"`
    };
    
  } catch (error) {
    console.error('Error in autoAssociateResponsible:', error);
    return {
      success: false,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

/**
 * Tests unitarios
 */
export function testNormalizeDocumento(): void {
  const tests = [
    { input: '31.290.539', expected: '31290539', desc: 'Con puntos' },
    { input: '805.031.544-8', expected: '8050315448', desc: 'Con puntos y guión' },
    { input: '  94539661  ', expected: '94539661', desc: 'Con espacios' },
    { input: '1.144.142.771', expected: '1144142771', desc: 'Documento largo' }
  ];
  
  console.group('🧪 Tests normalizeDocumento()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = normalizeDocumento(input);
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

export function testNormalizeOwnerName(): void {
  const tests = [
    {
      input: 'HENAO ECHEVERRI MARIA PATRICIA',
      expected: 'henao echeverri maria patricia',
      desc: 'Nombre con doble apellido'
    },
    {
      input: 'GARCÍA ZUÑIGA MYRIAM',
      expected: 'garcia zuniga myriam',
      desc: 'Nombre con acentos y ñ'
    },
    {
      input: 'LEÓN  MUÑOZ  NORELA',
      expected: 'leon munoz norela',
      desc: 'Nombre con espacios múltiples'
    }
  ];
  
  console.group('🧪 Tests normalizeOwnerName()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = normalizeOwnerName(input);
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

export function testNormalizeBanco(): void {
  const tests = [
    { input: '1 BANCO OCCIDENTE', expected: 'BANCO DE OCCIDENTE', desc: 'Banco con código' },
    { input: 'BANCOLOMBIA', expected: 'BANCOLOMBIA', desc: 'Banco directo' },
    { input: 'AV VILLAS', expected: 'BANCO AV VILLAS', desc: 'Abreviatura' },
    { input: 'NU BANK', expected: 'NEQUI BANK', desc: 'Banco digital' }
  ];
  
  console.group('🧪 Tests normalizeBanco()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = normalizeBanco(input);
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

export function testMaskAccountNumber(): void {
  const tests = [
    { input: '21812219', expected: '****2219', desc: 'Cuenta estándar' },
    { input: '123', expected: '123', desc: 'Cuenta corta' },
    { input: '564-16178-4', expected: '****178-4', desc: 'Cuenta con guiones' }
  ];
  
  console.group('🧪 Tests maskAccountNumber()');
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ input, expected, desc }) => {
    const result = maskAccountNumber(input);
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

export function runAllOwnerAccountTests(): void {
  testNormalizeDocumento();
  testNormalizeOwnerName();
  testNormalizeBanco();
  testMaskAccountNumber();
}
