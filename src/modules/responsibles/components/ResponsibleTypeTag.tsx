import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Responsible, ResponsibleType } from '../../../types';
import { X, Phone, Mail, Building2, MapPin, User, Tag } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

interface ResponsibleTypeTagProps {
  type: ResponsibleType;
  responsible: Responsible;
  showName?: boolean;
  transactionId?: string;
  onRemove?: (transactionId: string) => void;
  showTooltip?: boolean;
  className?: string;
}

const TYPE_STYLES = {
  tenant: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70',
  owner: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70',
  admin: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70',
  'third-party': 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70',
  other: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100/70',
  'n/a': 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/70'
};

const TYPE_LABELS = {
  tenant: 'Arrendatario',
  owner: 'Propietario',
  admin: 'Administración',
  'third-party': 'Tercero',
  other: 'Otro',
  'n/a': 'Sin Asignar'
};

export function ResponsibleTypeTag({ 
  type, 
  className = '', 
  responsible,
  transactionId,
  onRemove
}: ResponsibleTypeTagProps) {
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [showTooltipState, setShowTooltipState] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Función para calcular la posición del tooltip de manera precisa
  const calculateTooltipPosition = useCallback(() => {
    if (!tagRef.current) return;
    
    // Obtenemos la posición actual del tag
    const rect = tagRef.current.getBoundingClientRect();
    
    // Calculamos la posición del tooltip relativa a la ventana
    // para que se mantenga correctamente al hacer scroll
    const newPosition = {
      top: rect.bottom + 8,
      left: rect.left
    };
    
    // Verificamos si tenemos espacio suficiente a la derecha
    const viewportWidth = window.innerWidth;
    if (newPosition.left + 280 > viewportWidth) { // 280px es el maxWidth del tooltip
      // Si no hay espacio, ajustamos para que quede alineado a la derecha del viewport con margen
      newPosition.left = Math.max(10, viewportWidth - 290);
    }
    
    // Actualizamos la posición siempre para garantizar precisión
    setTooltipPosition(newPosition);
  }, []);
  
  // Efecto para calcular la posición inicialmente cuando se muestra el tooltip
  useEffect(() => {
    if (showTooltipState) {
      // Usamos requestAnimationFrame para asegurarnos que el cálculo se realice después del render
      requestAnimationFrame(() => {
        calculateTooltipPosition();
      });
    }
  }, [showTooltipState, calculateTooltipPosition]);
  
  // Efecto para mantener actualizada la posición cuando hay cambios en la ventana
  useEffect(() => {
    if (showTooltipState) {
      // Event listeners para actualizar la posición
      window.addEventListener('scroll', calculateTooltipPosition, true);
      window.addEventListener('resize', calculateTooltipPosition);
      window.addEventListener('click', calculateTooltipPosition);
      
      // Creamos un MutationObserver para detectar cambios en el DOM
      const observer = new MutationObserver(() => {
        requestAnimationFrame(() => {
          calculateTooltipPosition();
        });
      });
      
      // Configuramos el observer para detectar cambios en el árbol DOM
      const config = { 
        attributes: true, 
        childList: true, 
        subtree: true,
        characterData: true
      };
      
      // Si el elemento padre existe, observamos sus cambios
      if (tagRef.current?.parentElement) {
        observer.observe(tagRef.current.parentElement, config);
      }
      
      // También podemos observar cambios en el cuerpo del documento
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      // Adicionalmente, configuramos un intervalo de respaldo por si acaso
      const interval = setInterval(() => {
        if (tagRef.current) {
          calculateTooltipPosition();
        }
      }, 300);
      
      return () => {
        // Limpiamos todos los event listeners y observers
        window.removeEventListener('scroll', calculateTooltipPosition, true);
        window.removeEventListener('resize', calculateTooltipPosition);
        window.removeEventListener('click', calculateTooltipPosition);
        observer.disconnect();
        clearInterval(interval);
      };
    }
  }, [showTooltipState, calculateTooltipPosition]);

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsible || !newPhone || !responsible.id) {
      toast.error('No se puede agregar el teléfono en este momento');
      return;
    }

    try {
      const responsibleRef = doc(db, 'responsibles', responsible.id);
      const updatedPhones = [...(responsible.phones || [])];
      
      if (updatedPhones.includes(newPhone)) {
        toast.error('Este número ya existe');
        return;
      }

      updatedPhones.push(newPhone);
      
      await updateDoc(responsibleRef, {
        phones: updatedPhones
      });

      toast.success('Teléfono agregado correctamente');
      setNewPhone('');
      setIsAddingPhone(false);
    } catch (error) {
      console.error('Error al agregar teléfono:', error);
      toast.error('Error al agregar el teléfono');
    }
  };

  const tooltipContent = responsible && showTooltipState && createPortal(
    <div
      ref={modalRef}
      className={`bg-white shadow-lg rounded-lg p-3 max-w-[280px] absolute z-50 overflow-hidden text-xs`}
      style={{ 
        top: `${tooltipPosition.top + window.scrollY}px`, 
        left: `${tooltipPosition.left + window.scrollX}px`,
        opacity: showTooltipState ? 1 : 0,
        transition: 'opacity 200ms ease-in-out, transform 200ms ease-in-out',
        pointerEvents: 'auto',
        transform: 'translateZ(0)', // Fuerza aceleración por hardware para rendimiento
        willChange: 'top, left' // Ayuda al navegador a optimizar el renderizado
      }}
    >
      {/* Tipo de responsable */}
      <div className="flex items-start gap-2 pb-2 mb-2 border-b border-gray-100">
        <Tag size={12} className="shrink-0 mt-1" />
        <span className="font-medium break-words">{TYPE_LABELS[type]}</span>
      </div>
      
      <div className="space-y-2.5">
        {responsible?.identificacion && (
          <div className="flex items-start gap-2">
            <User size={12} className="shrink-0 mt-1" />
            <span className="break-words overflow-hidden">{responsible.identificacion}</span>
          </div>
        )}
        {responsible?.email && (
          <div className="flex items-start gap-2">
            <Mail size={12} className="shrink-0 mt-1" />
            <span className="break-words overflow-hidden">{responsible.email}</span>
          </div>
        )}
        {responsible?.phones && responsible.phones.length > 0 && (
          <div className="flex items-start gap-2">
            <Phone size={12} className="shrink-0 mt-1" />
            <span className="break-words overflow-hidden">{responsible.phones.join(', ')}</span>
          </div>
        )}
        {responsible?.empresa && (
          <div className="flex items-start gap-2">
            <Building2 size={12} className="shrink-0 mt-1" />
            <span className="break-words overflow-hidden">{responsible.empresa}</span>
          </div>
        )}
        {responsible?.direccion && (
          <div className="flex items-start gap-2">
            <MapPin size={12} className="shrink-0 mt-1" />
            <span className="break-words overflow-hidden">{responsible.direccion}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative w-10/10">
      {/* Tag principal con nombre y botones */}
      <div 
        ref={tagRef}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium z-20 ${TYPE_STYLES[type]} ${className}`}
        onMouseEnter={() => {
          const tagElement = tagRef.current;
          if (tagElement) {
            const zIndex = getComputedStyle(tagElement).zIndex;
            console.log(`Z-Index del tag ${type} (posición: ${zIndex}): ${type}`);
            setShowTooltipState(true);
          }
        }}
        onMouseLeave={() => setShowTooltipState(false)}
      >
        <div className="flex items-start justify-between gap-x-2">
          {/* Nombre del responsable */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium break-words whitespace-normal leading-snug">
              {responsible?.name}
            </div>
          </div>

          {/* Botones de acción siempre visibles */}
          <div className="flex items-center gap-1.5 shrink-0">
            {responsible && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingPhone(true);
                  setShowTooltipState(false);
                }}
                className="p-1.5 rounded-full hover:bg-white/80 transition-colors"
                title="Agregar teléfono"
              >
                <Phone size={14} className="stroke-current" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRemove && transactionId) {
                    onRemove(transactionId);
                  }
                }}
                className="p-1.5 rounded-full hover:bg-white/80 transition-colors"
                title="Eliminar asignación"
              >
                <X size={14} className="stroke-current" />
              </button>
            )}
          </div>
        </div>
      </div>

      {tooltipContent}

      {/* Modal de agregar teléfono */}
      {isAddingPhone && responsible && createPortal(
        <div 
          ref={modalRef}
          className="fixed transform -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-[300px]"
          style={{
            top: tagRef.current ? tagRef.current.getBoundingClientRect().bottom + window.scrollY + 8 : 0,
            left: tagRef.current ? tagRef.current.getBoundingClientRect().left + (tagRef.current.getBoundingClientRect().width / 2) : 0,
            willChange: 'top, left', // Optimiza el renderizado
            transform: 'translateZ(0)' // Fuerza aceleración por hardware
          }}
          onMouseEnter={() => { 
            const modalElement = modalRef.current;
            if (modalElement) {
              const zIndex = getComputedStyle(modalElement).zIndex;
              console.log(`Z-Index del modal de agregar teléfono (posición: ${zIndex}): Agregar Teléfono`); 
              setShowTooltipState(false); 
            }
          }}
        >
          <form onSubmit={handleAddPhone} className="flex flex-col gap-2">
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Nuevo teléfono"
              className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingPhone(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Agregar
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}