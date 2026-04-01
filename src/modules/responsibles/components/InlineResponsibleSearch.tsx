import React, { useState, useRef, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { ResponsibleSearchInput } from './ResponsibleSearchInput';
import { Responsible } from '../../../types';
import { Transaction } from '../../../types';
import { createPortal } from 'react-dom';

interface InlineResponsibleSearchProps {
  transaction: Transaction;
  transactionId: string;
  responsibles: Responsible[];
  onAssign: (responsibleId: string) => void;
}

export const InlineResponsibleSearch = React.memo(function InlineResponsibleSearch({
  transaction,
  transactionId,
  responsibles,
  onAssign
}: InlineResponsibleSearchProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchPosition, setSearchPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const isDisabled = React.useMemo(() => {
    const hasZeroValue = transaction.valor === 0;
    const hasGravDesc = transaction.descripcion?.toUpperCase().includes('GRAV') || false;
    return hasZeroValue || hasGravDesc;
  }, [transaction.valor, transaction.descripcion]);

  const disabledTitle = React.useMemo(() => {
    if (transaction.valor === 0) return 'No se puede asignar responsable a transacciones con valor 0';
    if (transaction.descripcion?.toUpperCase().includes('GRAV')) return 'No se puede asignar responsable a transacciones GRAV';
    return '';
  }, [transaction.valor, transaction.descripcion]);

  // Calculamos la posición basada en el botón pero la renderizamos con portal
  const calculatePosition = () => {
    if (!buttonRef.current) return;
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    
    // Posicionamiento horizontal - junto al botón a la derecha
    const left = buttonRect.right + 5; // 5px de separación
    
    // Posicionamiento vertical - alineado con el centro del botón
    const top = buttonRect.top - 4;
    
    setSearchPosition({ left, top });
  };
  
  useEffect(() => {
    if (isSearching) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('click', calculatePosition);
    }
    
    return () => {
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('click', calculatePosition);
    };
  }, [isSearching]);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      searchPanelRef.current &&
      !searchPanelRef.current.contains(event.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setIsSearching(false);
      setSearchTerm('');
    }
  };

  useEffect(() => {
    if (isSearching) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearching]);

  const handleAssign = async (responsible: Responsible) => {
    if (!transactionId || !responsible.id) {
      console.error('Missing required IDs:', { transactionId, responsibleId: responsible.id });
      return;
    }

    onAssign(responsible.id);
    setIsSearching(false);
    setSearchTerm('');
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => !isDisabled && setIsSearching(true)}
        className={`p-2 rounded-lg transition-colors ${
          isDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
        disabled={isDisabled}
        title={disabledTitle || 'Asignar responsable'}
      >
        <UserPlus className="w-4 h-4" />
      </button>

      {isSearching && createPortal(
        <div 
          ref={searchPanelRef}
          style={{
            position: 'fixed',
            top: `${searchPosition.top}px`,
            left: `${searchPosition.left}px`,
            zIndex: 99999, // Valor muy alto para estar por encima de todo
            width: '450px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div className="bg-white rounded-lg border border-gray-200 overflow-visible">
            <ResponsibleSearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              responsibles={responsibles}
              onSelect={handleAssign}
              placeholder="Buscar responsable..."
              autoFocus={true}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

