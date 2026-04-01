import React, { useRef } from 'react';
import { useCollection } from '../../../hooks/useCollection';
import { Responsible } from '../../../types';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs, query } from 'firebase/firestore';
import { Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { parse, isValid } from 'date-fns';

const ResponsibleDataManager = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: responsibles } = useCollection<Responsible>('responsibles');

  const handleExport = () => {
    if (!responsibles || responsibles.length === 0) {
      toast.error('No hay responsables para exportar');
      return;
    }

    const csvContent = [
      // Encabezados
      ['Nombre', 'Identificación', 'Email', 'Teléfonos', 'Tipo', 'Valor', 'Dirección', 'Empresa', 'F. Inicio Contrato', 'F. Final Contrato'].join(','),
      // Datos
      ...responsibles.map(responsible => [
        `"${responsible.name || ''}"`,
        `"${responsible.identificacion || ''}"`,
        `"${responsible.email || ''}"`,
        `"${responsible.phones?.join(';') || ''}"`,  
        `"${responsible.type || ''}"`,
        responsible.valor || '0',
        `"${responsible.direccion || ''}"`,
        `"${responsible.empresa || ''}"`,
        `"${responsible.f_inicial_contrato || ''}"`,
        `"${responsible.f_final_contrato || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `responsables_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isValidDate = (dateStr: string): boolean => {
    if (!dateStr) return true; // Fechas vacías son válidas
    try {
      const parsedDate = parse(dateStr.trim(), 'd/M/yyyy', new Date());
      return isValid(parsedDate);
    } catch (error) {
      return false;
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validar encabezados
        const requiredHeaders = ['nombre', 'identificación', 'email', 'teléfonos', 'tipo', 'valor'];
        //const optionalHeaders = ['dirección', 'empresa', 'f. inicio contrato', 'f. final contrato'];
        //const allHeaders = [...requiredHeaders, ...optionalHeaders];
        
        const missingHeaders = requiredHeaders.filter(header => 
          !headers.some(h => h === header)
        );

        if (missingHeaders.length > 0) {
          toast.error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`);
          return;
        }

        const responsiblesRef = collection(db, 'responsibles');
        const existingResponsibles = await getDocs(query(responsiblesRef));
        const existingIds = new Set(
          existingResponsibles.docs.map(doc => doc.data().identificacion?.toLowerCase())
        );

        let imported = 0;
        let skipped = 0;
        let errors = 0;
        let batch = [];

        // Procesar cada línea
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].split(',').map(value => 
            value.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
          );

          const responsible = {
            name: values[headers.indexOf('nombre')],
            identificacion: values[headers.indexOf('identificación')],
            email: values[headers.indexOf('email')],
            phones: values[headers.indexOf('teléfonos')]?.split(';').filter(Boolean) || [],  
            type: values[headers.indexOf('tipo')],
            valor: parseFloat(values[headers.indexOf('valor')]) || 0,
            direccion: values[headers.indexOf('dirección')] || '',
            empresa: values[headers.indexOf('empresa')] || '',
            f_inicial_contrato: values[headers.indexOf('f. inicio contrato')]?.trim() || '',
            f_final_contrato: values[headers.indexOf('f. final contrato')]?.trim() || '',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          // Validaciones básicas
          if (!responsible.name || !responsible.identificacion) {
            errors++;
            continue;
          }

          // Validar fechas
          if (!isValidDate(responsible.f_inicial_contrato) || !isValidDate(responsible.f_final_contrato)) {
            console.error('Error en formato de fecha para el responsable:', responsible.name);
            errors++;
            continue;
          }

          // Validar tipo
          const validTypes = ['tenant', 'owner', 'admin', 'third-party', 'other', 'n/a'];
          if (!validTypes.includes(responsible.type)) {
            responsible.type = 'other';
          }

          // Verificar duplicados por identificación
          if (existingIds.has(responsible.identificacion.toLowerCase())) {
            skipped++;
            continue;
          }

          try {
            batch.push(responsible);
            existingIds.add(responsible.identificacion.toLowerCase());
            
            // Procesar en lotes de 20 para evitar sobrecarga
            if (batch.length >= 20) {
              await Promise.all(batch.map(resp => addDoc(responsiblesRef, resp)));
              imported += batch.length;
              batch = [];
              // Pequeña pausa para evitar sobrecarga
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error('Error al importar responsable:', error);
            errors++;
          }
        }

        // Procesar el último lote
        if (batch.length > 0) {
          try {
            await Promise.all(batch.map(resp => addDoc(responsiblesRef, resp)));
            imported += batch.length;
          } catch (error) {
            console.error('Error al procesar último lote:', error);
            errors += batch.length;
          }
        }

        toast.success(
          `Importación completada:\n` +
          `✅ ${imported} importados\n` +
          `⏭️ ${skipped} omitidos (duplicados)\n` +
          `❌ ${errors} errores`
        );
      } catch (error) {
        console.error('Error al procesar archivo:', error);
        toast.error('Error al procesar el archivo');
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
        title="El archivo CSV debe contener las columnas: Nombre, Identificación, Email, Teléfonos (separados por ;), Tipo, Valor, Dirección, Empresa, F. Inicio Contrato, F. Final Contrato"
      >
        <Upload className="w-4 h-4" />
      </button>
      <button
        onClick={handleExport}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleImport}
      />
    </div>
  );
};

export default ResponsibleDataManager;
