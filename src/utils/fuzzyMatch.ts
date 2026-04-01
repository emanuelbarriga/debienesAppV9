/**
 * Utilidades de matching fuzzy para sugerir propietarios similares
 */

import { normalizeDocumento, normalizeOwnerName } from './ownerAccountUtils';

export interface OwnerSuggestion {
  id: string;
  name: string;
  documento: string;
  score: number; // 0..1
  source: 'responsible' | 'account';
}

/**
 * Calcula similitud de Jaccard basada en tokens de palabras
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(normalizeOwnerName(str1).split(' ').filter(Boolean));
  const tokens2 = new Set(normalizeOwnerName(str2).split(' ').filter(Boolean));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  let intersection = 0;
  tokens1.forEach(token => {
    if (tokens2.has(token)) intersection++;
  });
  
  const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]).size;
  return intersection / union;
}

/**
 * Busca coincidencias exactas por documento
 */
export function findExactMatchByDoc(
  doc: string | undefined,
  candidates: Array<{ id: string; documento?: string; name: string }>
): OwnerSuggestion[] {
  if (!doc) return [];
  
  const normalizedDoc = normalizeDocumento(doc);
  return candidates
    .filter(c => normalizeDocumento(c.documento || '') === normalizedDoc)
    .map(c => ({
      id: c.id,
      name: c.name,
      documento: normalizedDoc,
      score: 1.0,
      source: 'responsible' as const
    }));
}

/**
 * Busca sugerencias por similitud de nombre
 */
export function findSimilarByName(
  targetName: string,
  candidates: Array<{ id: string; name: string; documento?: string }>,
  minScore: number = 0.4
): OwnerSuggestion[] {
  const results = candidates.map(candidate => {
    const score = jaccardSimilarity(targetName, candidate.name);
    return {
      id: candidate.id,
      name: candidate.name,
      documento: normalizeDocumento(candidate.documento || ''),
      score,
      source: 'responsible' as const
    };
  });
  
  return results
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/**
 * Obtiene las mejores sugerencias combinando documento y nombre
 */
export function getTopSuggestions(
  name: string,
  doc: string | undefined,
  responsibles: Array<{ id: string; name: string; identificacion?: string }>,
  accounts: Array<{ id: string; propietario: string; documentoPropietario?: string }>,
  limit: number = 5
): OwnerSuggestion[] {
  // Primero buscar coincidencias exactas por documento en responsibles
  const exactMatches = findExactMatchByDoc(
    doc,
    responsibles.map(r => ({ id: r.id, documento: r.identificacion, name: r.name }))
  );
  
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, limit);
  }
  
  // Luego buscar por similitud de nombre
  const similarByName = findSimilarByName(
    name,
    responsibles.map(r => ({ id: r.id, name: r.name, documento: r.identificacion }))
  ).map(s => ({ ...s, source: 'responsible' as const }));
  
  // También buscar en cuentas existentes
  const accountMatches = findSimilarByName(
    name,
    accounts.map(a => ({ id: a.id!, name: a.propietario, documento: a.documentoPropietario }))
  ).map(s => ({ ...s, source: 'account' as const }));
  
  // Combinar y ordenar por score
  const combined = [...similarByName, ...accountMatches]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return combined;
}
