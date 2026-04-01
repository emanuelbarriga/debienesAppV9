/**
 * Lista estandarizada de bancos en Colombia
 * Mantener nombres oficiales según la Superintendencia Financiera
 */

export const BANCOS_COLOMBIA = [
  'BANCOLOMBIA',
  'BANCO DE BOGOTÁ',
  'DAVIVIENDA',
  'BBVA COLOMBIA',
  'BANCO DE OCCIDENTE',
  'ITAÚ',
  'SCOTIABANK COLPATRIA',
  'BANCO CAJA SOCIAL',
  'BANCO POPULAR',
  'CITIBANK',
  'BANCO AV VILLAS',
  'BANCO PICHINCHA',
  'BANCO AGRARIO',
  'BANCO FALABELLA',
  'BANCO FINANDINA',
  'BANCO SANTANDER',
  'BANCO COOPCENTRAL',
  'BANCO COOPERATIVO COOPCENTRAL',
  'BANCO GNB SUDAMERIS',
  'BANCO MUNDO MUJER',
  'BANCO SERFINANZA',
  'BANCO W',
  'BANCOOMEVA',
  'CONFIAR',
  'COOPERATIVA FINANCIERA DE ANTIOQUIA',
  'DAVIPLATA',
  'NEQUI',
  'RAPPIPAY',
  'MOVII',
  'DING',
  'LULO BANK',
  'NU BANK',
  'BANCO CREDIFINANCIERA',
  'MIBANCO',
  'OTRO'
] as const;

export type BancoName = typeof BANCOS_COLOMBIA[number];

/**
 * Mapeo de variaciones comunes a nombres estandarizados
 * Útil para normalizar entradas manuales antiguas
 */
export const BANCO_ALIASES: Record<string, BancoName> = {
  // Bancolombia variaciones
  'BANCOLOMBIA': 'BANCOLOMBIA',
  'BANCO COLOMBIA': 'BANCOLOMBIA',
  'BCOLOMBIA': 'BANCOLOMBIA',
  'BANCOL': 'BANCOLOMBIA',
  
  // Banco de Bogotá variaciones
  'BANCO DE BOGOTA': 'BANCO DE BOGOTÁ',
  'BOGOTA': 'BANCO DE BOGOTÁ',
  'BANCO BOGOTA': 'BANCO DE BOGOTÁ',
  'BDB': 'BANCO DE BOGOTÁ',
  
  // Davivienda variaciones
  'DAVIVIENDA': 'DAVIVIENDA',
  'BANCO DAVIVIENDA': 'DAVIVIENDA',
  'DAVI': 'DAVIVIENDA',
  
  // BBVA variaciones
  'BBVA': 'BBVA COLOMBIA',
  'BBVA COLOMBIA': 'BBVA COLOMBIA',
  'BANCO BBVA': 'BBVA COLOMBIA',
  
  // Occidente variaciones
  'BANCO DE OCCIDENTE': 'BANCO DE OCCIDENTE',
  'OCCIDENTE': 'BANCO DE OCCIDENTE',
  'BCO OCCIDENTE': 'BANCO DE OCCIDENTE',
  
  // Itaú variaciones
  'ITAU': 'ITAÚ',
  'ITAÚ': 'ITAÚ',
  'BANCO ITAU': 'ITAÚ',
  
  // Colpatria variaciones
  'COLPATRIA': 'SCOTIABANK COLPATRIA',
  'SCOTIABANK': 'SCOTIABANK COLPATRIA',
  'SCOTIABANK COLPATRIA': 'SCOTIABANK COLPATRIA',
  'BANCO COLPATRIA': 'SCOTIABANK COLPATRIA',
  
  // Caja Social variaciones
  'CAJA SOCIAL': 'BANCO CAJA SOCIAL',
  'BANCO CAJA SOCIAL': 'BANCO CAJA SOCIAL',
  'BCSC': 'BANCO CAJA SOCIAL',
  
  // Popular variaciones
  'POPULAR': 'BANCO POPULAR',
  'BANCO POPULAR': 'BANCO POPULAR',
  'BCO POPULAR': 'BANCO POPULAR',
  
  // AV Villas variaciones
  'AV VILLAS': 'BANCO AV VILLAS',
  'BANCO AV VILLAS': 'BANCO AV VILLAS',
  'AVVILLAS': 'BANCO AV VILLAS',
  
  // Agrario variaciones
  'AGRARIO': 'BANCO AGRARIO',
  'BANCO AGRARIO': 'BANCO AGRARIO',
  'BANAGRARIO': 'BANCO AGRARIO',
  
  // Nequi variaciones
  'NEQUI': 'NEQUI',
  'CUENTA NEQUI': 'NEQUI',
  
  // Daviplata variaciones
  'DAVIPLATA': 'DAVIPLATA',
  'DAVI PLATA': 'DAVIPLATA',
  
  // GNB Sudameris variaciones
  'GNB': 'BANCO GNB SUDAMERIS',
  'SUDAMERIS': 'BANCO GNB SUDAMERIS',
  'GNB SUDAMERIS': 'BANCO GNB SUDAMERIS',
  
  // Nu Bank variaciones
  'NU BANK': 'NU BANK',
  'NU': 'NU BANK',
  'NUBANK': 'NU BANK',
  'BANCO NU': 'NU BANK',
  
  // Otros
  'BANCOOMEVA': 'BANCOOMEVA',
  'BANCO COOPERATIVO': 'BANCO COOPCENTRAL',
  'COOPCENTRAL': 'BANCO COOPCENTRAL',
};

/**
 * Normaliza el nombre de un banco a su versión estandarizada
 * @param banco - Nombre del banco a normalizar
 * @returns Nombre estandarizado del banco
 */
export function normalizeBancoName(banco: string): BancoName {
  if (!banco) return 'OTRO';
  
  const normalized = banco.toUpperCase().trim();
  
  // Verificar si existe en aliases
  if (normalized in BANCO_ALIASES) {
    return BANCO_ALIASES[normalized];
  }
  
  // Verificar si es un nombre estándar
  if (BANCOS_COLOMBIA.includes(normalized as BancoName)) {
    return normalized as BancoName;
  }
  
  // Búsqueda parcial (por si tiene texto adicional)
  for (const [alias, standardName] of Object.entries(BANCO_ALIASES)) {
    if (normalized.includes(alias)) {
      return standardName;
    }
  }
  
  // Si no se encuentra, retornar OTRO
  console.warn(`Banco no reconocido: "${banco}". Clasificado como OTRO.`);
  return 'OTRO';
}

/**
 * Obtiene un color distintivo para cada banco (útil para UI)
 */
export function getBancoColor(banco: BancoName): string {
  const colors: Partial<Record<BancoName, string>> = {
    'BANCOLOMBIA': 'bg-yellow-100 text-yellow-800',
    'BANCO DE BOGOTÁ': 'bg-blue-100 text-blue-800',
    'DAVIVIENDA': 'bg-red-100 text-red-800',
    'BBVA COLOMBIA': 'bg-blue-100 text-blue-800',
    'BANCO DE OCCIDENTE': 'bg-gray-100 text-gray-800',
    'NEQUI': 'bg-purple-100 text-purple-800',
    'DAVIPLATA': 'bg-orange-100 text-orange-800',
    'BANCO AGRARIO': 'bg-green-100 text-green-800',
    'NU BANK': 'bg-purple-100 text-purple-800',
    'LULO BANK': 'bg-pink-100 text-pink-800',
  };
  
  return colors[banco] || 'bg-gray-100 text-gray-800';
}
