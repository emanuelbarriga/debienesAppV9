import { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { OwnerAccount, Responsible } from '../../../types';
import { normalizeDocumento, normalizeBanco, autoAssociateResponsible } from '../../../utils/ownerAccountUtils';
import { BANCOS_COLOMBIA } from '../../../constants/banks';
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import toast from 'react-hot-toast';

interface OwnerAccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: OwnerAccount | null;
}

interface FormData {
  propietario: string;
  documentoPropietario: string;
  pagarA: string;
  documentoBeneficiario: string;
  numeroCuenta: string;
  banco: string;
  tipoCuenta: 'AHORROS' | 'CORRIENTE';
  observaciones: string;
  isDefault: boolean;
}

const initialFormData: FormData = {
  propietario: '',
  documentoPropietario: '',
  pagarA: '',
  documentoBeneficiario: '',
  numeroCuenta: '',
  banco: '',
  tipoCuenta: 'AHORROS',
  observaciones: '',
  isDefault: false
};

export default function OwnerAccountFormModal({
  isOpen,
  onClose,
  editingAccount
}: OwnerAccountFormModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<Responsible[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showCustomBanco, setShowCustomBanco] = useState(false);
  const [customBanco, setCustomBanco] = useState('');

  useEffect(() => {
    if (editingAccount) {
      setFormData({
        propietario: editingAccount.propietario,
        documentoPropietario: editingAccount.documentoPropietario,
        pagarA: editingAccount.pagarA,
        documentoBeneficiario: editingAccount.documentoBeneficiario,
        numeroCuenta: editingAccount.numeroCuenta,
        banco: editingAccount.banco,
        tipoCuenta: editingAccount.tipoCuenta,
        observaciones: editingAccount.observaciones || '',
        isDefault: editingAccount.isDefault || false
      });
    } else {
      setFormData(initialFormData);
    }
  }, [editingAccount, isOpen]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchOwner = async (searchTerm: string) => {
    handleChange('propietario', searchTerm);
    
    if (searchTerm.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setShowSearchResults(true);

    try {
      const ownersRef = collection(db, 'responsibles');
      const q = query(ownersRef, where('type', '==', 'owner'));
      const snapshot = await getDocs(q);
      
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Responsible))
        .filter(owner => 
          owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          owner.identificacion?.includes(searchTerm)
        )
        .slice(0, 10);
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching owners:', error);
    }
  };

  const handleSelectOwner = (owner: Responsible) => {
    setFormData(prev => ({
      ...prev,
      propietario: owner.name,
      documentoPropietario: owner.identificacion || '',
      pagarA: owner.name,
      documentoBeneficiario: owner.identificacion || ''
    }));
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleCopyToPayee = () => {
    setFormData(prev => ({
      ...prev,
      pagarA: prev.propietario,
      documentoBeneficiario: prev.documentoPropietario
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.propietario.trim()) {
      toast.error('El nombre del propietario es obligatorio');
      return false;
    }
    if (!formData.documentoPropietario.trim()) {
      toast.error('El documento del propietario es obligatorio');
      return false;
    }
    if (!formData.numeroCuenta.trim()) {
      toast.error('El número de cuenta es obligatorio');
      return false;
    }
    if (!formData.banco.trim()) {
      toast.error('El banco es obligatorio');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);

    try {
      const accountData: Omit<OwnerAccount, 'id'> = {
        propietario: formData.propietario.trim(),
        documentoPropietario: normalizeDocumento(formData.documentoPropietario),
        pagarA: formData.pagarA.trim() || formData.propietario.trim(),
        documentoBeneficiario: normalizeDocumento(formData.documentoBeneficiario || formData.documentoPropietario),
        numeroCuenta: formData.numeroCuenta.trim(),
        banco: normalizeBanco(formData.banco.trim()),
        tipoCuenta: formData.tipoCuenta,
        observaciones: formData.observaciones.trim(),
        status: 'activa',
        isDefault: formData.isDefault,
        createdAt: new Date(),
        createdBy: auth.currentUser?.email || ''
      };

      // Intentar asociación automática
      const association = await autoAssociateResponsible(accountData);
      if (association.success) {
        accountData.responsibleId = association.responsibleId;
        accountData.responsibleName = association.responsibleName;
        toast(`Asociado automáticamente a: ${association.responsibleName}`, { icon: '🔗' });
      }

      if (editingAccount?.id) {
        // Actualizar cuenta existente
        await updateDoc(doc(db, 'ownerAccounts', editingAccount.id), {
          ...accountData,
          updatedAt: new Date()
        });
        
        await addDoc(collection(db, 'logs'), {
          usuarioEmail: auth.currentUser?.email,
          accion: 'modificación',
          entidad: 'owner_accounts',
          detalles: `Actualizó cuenta de ${accountData.propietario}`,
          timestamp: new Date()
        });

        toast.success('Cuenta actualizada correctamente');
      } else {
        // Crear nueva cuenta
        await addDoc(collection(db, 'ownerAccounts'), accountData);
        
        await addDoc(collection(db, 'logs'), {
          usuarioEmail: auth.currentUser?.email,
          accion: 'creación',
          entidad: 'owner_accounts',
          detalles: `Creó cuenta de ${accountData.propietario} - ${accountData.banco}`,
          timestamp: new Date()
        });

        toast.success('Cuenta creada correctamente');
      }

      handleClose();
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error('Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setSearchResults([]);
    setShowSearchResults(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta de Propietario'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Sección: Propietario */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Datos del Propietario</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Propietario <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={formData.propietario}
                    onChange={(e) => handleSearchOwner(e.target.value)}
                    placeholder="Buscar o escribir nombre..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    required
                  />
                </div>
                
                {/* Resultados de búsqueda */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto border rounded-lg bg-white shadow-lg">
                    {searchResults.map(owner => (
                      <button
                        key={owner.id}
                        type="button"
                        onClick={() => handleSelectOwner(owner)}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0 flex items-center gap-2"
                      >
                        <User size={16} className="text-gray-400" />
                        <div>
                          <div className="font-medium">{owner.name}</div>
                          <div className="text-sm text-gray-600">{owner.identificacion}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento/NIT <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.documentoPropietario}
                  onChange={(e) => handleChange('documentoPropietario', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>
          </div>

          {/* Sección: Beneficiario */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Beneficiario del Pago</h3>
              <button
                type="button"
                onClick={handleCopyToPayee}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Copiar datos del propietario
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pagar A
                </label>
                <input
                  type="text"
                  value={formData.pagarA}
                  onChange={(e) => handleChange('pagarA', e.target.value)}
                  placeholder="Mismo que propietario"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento Beneficiario
                </label>
                <input
                  type="text"
                  value={formData.documentoBeneficiario}
                  onChange={(e) => handleChange('documentoBeneficiario', e.target.value)}
                  placeholder="Mismo que propietario"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Sección: Cuenta Bancaria */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Datos Bancarios</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Cuenta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.numeroCuenta}
                  onChange={(e) => handleChange('numeroCuenta', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco <span className="text-red-500">*</span>
                </label>
                <select
                  value={showCustomBanco ? 'OTRO' : formData.banco}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'OTRO') {
                      setShowCustomBanco(true);
                      setCustomBanco('');
                      handleChange('banco', '');
                    } else {
                      setShowCustomBanco(false);
                      handleChange('banco', value);
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Seleccionar banco...</option>
                  {BANCOS_COLOMBIA.filter(b => b !== 'OTRO').map(banco => (
                    <option key={banco} value={banco}>{banco}</option>
                  ))}
                  <option value="OTRO">➕ Otro banco (especificar)</option>
                </select>
                
                {showCustomBanco && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customBanco}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setCustomBanco(value);
                        handleChange('banco', value);
                      }}
                      placeholder="Ingrese el nombre del banco"
                      className="w-full px-4 py-2 border border-orange-300 rounded-lg bg-orange-50"
                      autoFocus
                    />
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Se guardará como "OTRO". Considera agregarlo al catálogo oficial.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cuenta
                </label>
                <select
                  value={formData.tipoCuenta}
                  onChange={(e) => handleChange('tipoCuenta', e.target.value as 'AHORROS' | 'CORRIENTE')}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => handleChange('isDefault', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Marcar como cuenta preferida
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => handleChange('observaciones', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear Cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
