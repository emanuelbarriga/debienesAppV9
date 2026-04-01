import React from 'react';
import { Tag } from 'lucide-react';

type ResponsibleType = 'tenant' | 'owner' | 'provider' | 'admin' | 'third' | 'other';

interface SimpleTypeTagProps {
  type: ResponsibleType | string;
}

const TYPE_CONFIG: Record<string, { style: string, label: string, icon: React.ReactNode }> = {
  tenant: {
    style: 'bg-blue-50 text-blue-700 border-blue-200',
    label: 'Arrendatario',
    icon: <Tag className="w-3.5 h-3.5" />
  },
  owner: {
    style: 'bg-green-50 text-green-700 border-green-200',
    label: 'Propietario',
    icon: <Tag className="w-3.5 h-3.5" />
  },
  provider: {
    style: 'bg-green-50 text-green-700 border-green-200',
    label: 'Proveedor',
    icon: <Tag className="w-3.5 h-3.5" />
  },
  admin: {
    style: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Administración',
    icon: <Tag className="w-3.5 h-3.5" />
  },
  third: {
    style: 'bg-violet-50 text-violet-700 border-violet-200',
    label: 'Tercero',
    icon: <Tag className="w-3.5 h-3.5" />
  },
  other: {
    style: 'bg-gray-50 text-gray-500 border-gray-200',
    label: 'Otro',
    icon: <Tag className="w-3.5 h-3.5" />
  }
};

export function SimpleTypeTag({ type }: SimpleTypeTagProps) {
  // Normalizar el tipo para manejar casos como 'third-party' -> 'third'
  const normalizedType = type === 'third-party' ? 'third' : type;
  
  // Obtener la configuración del tipo o usar una por defecto
  const config = TYPE_CONFIG[normalizedType] || {
    style: 'bg-gray-50 text-gray-500 border-gray-200',
    label: type || 'N/A',
    icon: <Tag className="w-3.5 h-3.5" />
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${config.style}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
