import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Responsible } from '../../../types';
import { format } from 'date-fns';

// Define specific types for the form data to avoid TypeScript errors with dates
export type ResponsibleFormData = Omit<Responsible, 'id' | 'createdAt' | 'updatedAt'> & {
  f_inicial_contrato?: Date | null;
  f_final_contrato?: Date | null;
  // Ensure these fields are properly typed to avoid errors
  phones: string[];
  identificacion: string;
};

interface ResponsibleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ResponsibleFormData) => void;
  initialData: ResponsibleFormData;
  isEditing: boolean;
}

const ResponsibleForm: React.FC<ResponsibleFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing
}) => {
  const [formData, setFormData] = useState<ResponsibleFormData>(initialData);
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
    }
  }, [isOpen, initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Manejar tipos específicos de campos
    if (name === 'valor') {
      setFormData({
        ...formData,
        [name]: value ? parseInt(value) : 0
      });
    } else if (type === 'date') {
      // Asegurarnos de que la fecha se crea correctamente sin ajustes por zona horaria
      if (value) {
        const [year, month, day] = value.split('-').map(Number);
        const dateWithoutTimezoneIssue = new Date(year, month - 1, day, 12, 0, 0);
        setFormData({
          ...formData,
          [name]: dateWithoutTimezoneIssue
        });
      } else {
        setFormData({
          ...formData,
          [name]: null
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleAddPhone = () => {
    if (phoneInput && !formData.phones.includes(phoneInput)) {
      setFormData({
        ...formData,
        phones: [...formData.phones, phoneInput]
      });
      setPhoneInput('');
    }
  };

  const handleRemovePhone = (phone: string) => {
    setFormData({
      ...formData,
      phones: formData.phones.filter((p) => p !== phone)
    });
  };

  const formatDateForInput = (date: Date | null | undefined) => {
    if (!date) return '';
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditing ? 'Editar Responsable' : 'Nuevo Responsable'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block mb-1 font-medium">Nombre</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Tipo</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                <option value="tenant">Inquilino</option>
                <option value="owner">Propietario</option>
                <option value="provider">Proveedor</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 font-medium">Identificación</label>
              <input
                type="text"
                name="identificacion"
                value={formData.identificacion}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Teléfonos</label>
              <div className="flex">
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-l px-3 py-2"
                />
                <button
                  type="button"
                  onClick={handleAddPhone}
                  className="bg-blue-500 text-white px-3 py-2 rounded-r"
                >
                  +
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.phones.map((phone, index) => (
                  <div key={index} className="bg-gray-100 px-2 py-1 rounded flex items-center">
                    <span>{phone}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(phone)}
                      className="ml-1 text-red-500 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-1 font-medium">Empresa</label>
              <input
                type="text"
                name="empresa"
                value={formData.empresa || ''}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Valor</label>
              <input
                type="number"
                name="valor"
                value={formData.valor || 0}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Inicio de Contrato</label>
              <input
                type="date"
                name="f_inicial_contrato"
                value={formatDateForInput(formData.f_inicial_contrato as Date | null)}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Fin de Contrato</label>
              <input
                type="date"
                name="f_final_contrato"
                value={formatDateForInput(formData.f_final_contrato as Date | null)}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div className="col-span-2">
              <label className="block mb-1 font-medium">Dirección</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion || ''}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {isEditing ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResponsibleForm;
