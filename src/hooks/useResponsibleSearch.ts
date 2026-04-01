import { useMemo } from 'react';
import { Responsible } from '../types/responsible';

type SearchPrefix = 'a/' | 'p/' | 'ad/' | 'o/';

const TYPE_MAPPINGS: Record<string, string> = {
  'a/': 'tenant',
  'p/': 'owner',
  'ad/': 'admin',
  'o/': 'other'
};

export const useResponsibleSearch = (
  responsibles: Responsible[] | undefined,
  searchTerm: string
) => {
  return useMemo(() => {
    if (!responsibles || !searchTerm) {
      return responsibles || [];
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    let typeFilter: string | null = null;
    let searchValue = normalizedSearch;

    // Detectar prefijos de tipo
    Object.entries(TYPE_MAPPINGS).forEach(([prefix, type]) => {
      if (normalizedSearch.startsWith(prefix)) {
        typeFilter = type;
        searchValue = normalizedSearch.slice(prefix.length).trim();
      }
    });

    return responsibles.filter(responsible => {
      // Si hay un filtro de tipo y no coincide, excluir
      if (typeFilter && responsible.type !== typeFilter) {
        return false;
      }

      // Si no hay término de búsqueda después del prefijo, mostrar todos del tipo
      if (!searchValue) {
        return true;
      }

      // Búsqueda en todos los campos relevantes
      const searchFields = [
        responsible.name,
        responsible.identificacion,
        ...(responsible.phones || []),
        responsible.email,
        responsible.valor?.toString()
      ].filter(Boolean).map(field => field?.toLowerCase());

      // Verificar si algún campo contiene el término de búsqueda
      return searchFields.some(field => field?.includes(searchValue));
    });
  }, [responsibles, searchTerm]);
};
