import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formatea una fecha de manera segura, manejando diferentes formatos y casos de error
 * @param date Fecha a formatear (string o Date)
 * @param formatString Formato deseado (por defecto dd/MM/yyyy)
 * @returns String formateado o mensaje de error
 */
export const formatDateSafely = (date: string | Date | undefined, formatString?: string): string => {
  if (!date) return 'N/A';
  
  if (date instanceof Date) {
    try {
      if (isValid(date)) {
        return format(date, formatString || 'dd/MM/yyyy', { locale: es });
      }
      return 'Fecha invu00e1lida';
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Fecha invu00e1lida';
    }
  } else if (typeof date === 'string') {
    try {
      // Si la fecha estu00e1 en formato DD/MM/YYYY
      if (date.includes('/')) {
        const [day, month, year] = date.split('/').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        if (isValid(parsedDate)) {
          return format(parsedDate, formatString || 'dd/MM/yyyy', { locale: es });
        }
      }
      
      // Intentar con el formato estu00e1ndar
      const parsedDate = new Date(date);
      if (isValid(parsedDate)) {
        return format(parsedDate, formatString || 'dd/MM/yyyy', { locale: es });
      } else {
        return 'Fecha invu00e1lida';
      }
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return 'Fecha invu00e1lida';
    }
  } else {
    return 'N/A';
  }
};

/**
 * Analiza una fecha en formato string y la convierte a objeto Date
 * @param dateString Fecha en formato string o Date
 * @returns Objeto Date
 */
export const parseDate = (dateString: string | Date): Date => {
  if (!dateString) return new Date();
  
  // Si ya es un objeto Date, devolverlo directamente
  if (dateString instanceof Date) return dateString;
  
  // Si la fecha estu00e1 en formato DD/MM/YYYY
  if (dateString.includes('/')) {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Intentar convertir directamente
  return new Date(dateString);
};
