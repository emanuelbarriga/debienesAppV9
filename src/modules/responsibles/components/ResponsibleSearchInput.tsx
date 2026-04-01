import React, { forwardRef, useEffect, useRef, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Responsible } from '../../../types';

interface ResponsibleSearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSelect'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  responsibles?: Responsible[];
  onSelect?: (responsible: Responsible) => void;
  autoFocus?: boolean;
}

export const ResponsibleSearchInput = forwardRef<HTMLInputElement, ResponsibleSearchInputProps>(({
  value,
  onChange,
  placeholder = 'Buscar por nombre, identificación, teléfono...',
  className,
  responsibles = [],
  onSelect,
  autoFocus = false,
  ...props
}, _ref) => {
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Filter responsibles based on search value
  const filteredResponsibles = useMemo(() => {
    if (!value.trim() || !responsibles) return [];
    const searchTerm = value.toLowerCase();
    return responsibles.filter(responsible => 
      responsible.name?.toLowerCase().includes(searchTerm) ||
      responsible.identificacion?.toLowerCase().includes(searchTerm) ||
      responsible.phones?.some(phone => phone.toLowerCase().includes(searchTerm)) ||
      (responsible.valor && responsible.valor.toString().includes(searchTerm))
    );
  }, [value, responsibles]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredResponsibles]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || filteredResponsibles.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredResponsibles.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleResponsibleSelect(filteredResponsibles[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        break;
    }
  };

  const handleResponsibleSelect = (responsible: Responsible) => {
    if (onSelect) {
      onSelect(responsible);
    }
    setShowResults(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setShowResults(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowResults(false);  
            }, 200);
          }}
          className={`block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${className || ''}`}
          placeholder={placeholder}
          {...props}
        />
      </div>

      {/* Resultados de búsqueda */}
      {showResults && filteredResponsibles.length > 0 && (
        <div 
          ref={resultsRef}
          className="absolute z-20 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto"
        >
          {filteredResponsibles.map((responsible, index) => {
            const colorClass = responsible.type === 'owner' ? 'bg-blue-500' :
                              responsible.type === 'tenant' ? 'bg-green-500' :
                              responsible.type === 'admin' ? 'bg-yellow-500' :
                              'bg-purple-500';
            return (
              <div
                key={responsible.id}
                className={`p-2 cursor-pointer ${
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleResponsibleSelect(responsible)}
              >
                <div className="flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${colorClass}`}></span>
                  <div className="font-medium">{responsible.name}</div>
                </div>
                <div className="text-sm text-gray-500">
                  {responsible.identificacion} • {responsible.phones?.[0]} • Valor: {formatCurrency(responsible.valor || 0)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
