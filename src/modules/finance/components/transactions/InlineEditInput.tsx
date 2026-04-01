import { useState, useEffect, useRef } from 'react';

interface InlineEditInputProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const InlineEditInput: React.FC<InlineEditInputProps> = ({
  value,
  onSave,
  placeholder = 'Click para editar',
  isEditing,
  setIsEditing,
  className = '',
  onKeyDown
}) => {
  const [tempValue, setTempValue] = useState<string>(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Actualiza el valor temporal cuando cambia el valor externo
  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  // Focus en el input cuando se activa el modo edición
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    try {
      // Solo guardar si hay cambios
      if (tempValue !== value) {
        await onSave(tempValue);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error al guardar:', error);
      // Restaurar el valor original en caso de error
      setTempValue(value || '');
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que se active la edición
    navigator.clipboard.writeText(value || '');
    const button = e.currentTarget as HTMLButtonElement;
    const originalText = button.innerHTML;
    button.innerHTML = '✓';
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 1000);
  };  

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value || '');
    }
    
    // Llamar al manejador personalizado si existe
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`px-2 py-1 border border-gray-300 rounded-md w-full ${className}`}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  return (
    <div className="flex items-center group">
      <div 
        onClick={() => setIsEditing(true)}
        className={`cursor-pointer py-1 px-2 rounded hover:bg-gray-100 ${value ? '' : 'text-gray-400 italic'} ${className} flex-grow`}
      >
        {value || placeholder}
      </div>
      {value && (
        <button 
          onClick={handleCopy} 
          className="ml-1 text-gray-400 hover:text-gray-700 p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded hover:bg-gray-100"
          title="Copiar al portapapeles"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
          </svg>
        </button>
      )}
    </div>
  );
};
