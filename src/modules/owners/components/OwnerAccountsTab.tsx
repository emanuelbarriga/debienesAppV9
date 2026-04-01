import { useState, useRef } from 'react';
import { Plus, Upload, Search, Edit2, Link as LinkIcon, Star, Trash2 } from 'lucide-react';
import { useCollection } from '../../../hooks/useCollection';
import { OwnerAccount } from '../../../types';
import { maskAccountNumber, normalizeDocumento, normalizeBanco, normalizeTipoCuenta, autoAssociateResponsible, checkDuplicateAccount } from '../../../utils/ownerAccountUtils';
import { detectCSVDelimiter } from '../../../utils/csvUtils';
import { collection, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import OwnerAccountFormModal from './OwnerAccountFormModal';

export default function OwnerAccountsTab() {
  const { data: accounts, loading } = useCollection<OwnerAccount>('ownerAccounts');
  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterAssociation, setFilterAssociation] = useState<'all' | 'associated' | 'unassociated'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<OwnerAccount | null>(null);

  // Filtrar y ordenar cuentas alfabéticamente
  const filteredAccounts = accounts
    .filter(account => {
      const matchesSearch = !search || 
        account.propietario.toLowerCase().includes(search.toLowerCase()) ||
        account.documentoPropietario.includes(search);
      
      const matchesBank = filterBank === 'all' || account.banco === filterBank;
      
      const matchesAssociation = 
        filterAssociation === 'all' ||
        (filterAssociation === 'associated' && account.responsibleId) ||
        (filterAssociation === 'unassociated' && !account.responsibleId);
      
      return matchesSearch && matchesBank && matchesAssociation;
    })
    .sort((a, b) => a.propietario.localeCompare(b.propietario, 'es', { sensitivity: 'base' }));

  // Obtener bancos únicos para filtro
  const uniqueBanks = Array.from(new Set(accounts.map(a => a.banco))).sort();

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const delimiter = detectCSVDelimiter(text);
      
      toast(`Delimitador detectado: ${delimiter === ';' ? 'punto y coma' : 'coma'}`, { icon: 'ℹ️' });

      Papa.parse(text, {
        delimiter: delimiter,
        skipEmptyLines: true,
        complete: async (results) => {
          await processImport(results.data as string[][]);
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error);
          toast.error('Error al procesar el archivo');
          setImporting(false);
        }
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Error al leer el archivo');
      setImporting(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImport = async (rows: string[][]) => {
    const dataRows = rows.slice(1); // Skip header
    const BATCH_SIZE = 500;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    try {
      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = dataRows.slice(i, i + BATCH_SIZE);

        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j];
          const rowNum = i + j + 2;

          try {
            const propietario = row[0]?.trim();
            const nitPropietario = normalizeDocumento(row[1]);
            const pagarA = row[2]?.trim();
            const docBeneficiario = normalizeDocumento(row[3]);
            const numeroCuenta = row[4]?.toString().trim();
            const banco = row[5]?.trim();
            const observaciones = row[6]?.trim();
            const tipoCuenta = row[7]?.trim();

            if (!propietario || !nitPropietario || !numeroCuenta) {
              errors.push({ row: rowNum, message: 'Campos obligatorios faltantes' });
              skipped++;
              continue;
            }

            const accountData: Omit<OwnerAccount, 'id'> = {
              propietario,
              documentoPropietario: nitPropietario,
              pagarA: pagarA || propietario,
              documentoBeneficiario: docBeneficiario || nitPropietario,
              numeroCuenta,
              banco: normalizeBanco(banco),
              observaciones: observaciones || '',
              tipoCuenta: normalizeTipoCuenta(tipoCuenta),
              status: 'activa',
              createdAt: new Date(),
              createdBy: auth.currentUser?.email || ''
            };

            // Asociación automática
            const association = await autoAssociateResponsible(accountData);
            if (association.success) {
              accountData.responsibleId = association.responsibleId;
              accountData.responsibleName = association.responsibleName;
            }

            // Verificar duplicado
            const isDuplicate = await checkDuplicateAccount(nitPropietario, numeroCuenta);

            if (isDuplicate) {
              skipped++;
            } else {
              const docRef = doc(collection(db, 'ownerAccounts'));
              batch.set(docRef, accountData);
              imported++;
            }
          } catch (error) {
            errors.push({ row: rowNum, message: String(error) });
            skipped++;
          }
        }

        await batch.commit();
      }

      // Log de auditoría
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'importación',
        entidad: 'owner_accounts',
        detalles: JSON.stringify({ imported, updated, skipped, errors: errors.length }),
        timestamp: new Date()
      });

      toast.success(`Importación completada: ${imported} nuevas, ${skipped} omitidas`);
      
      if (errors.length > 0) {
        console.error('Errores de importación:', errors);
        toast.error(`${errors.length} errores encontrados (ver consola)`);
      }
    } catch (error) {
      console.error('Error in import:', error);
      toast.error('Error durante la importación');
    } finally {
      setImporting(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingAccount(null);
    setShowFormModal(true);
  };

  const handleOpenEditModal = (account: OwnerAccount) => {
    setEditingAccount(account);
    setShowFormModal(true);
  };

  const handleCloseModal = () => {
    setShowFormModal(false);
    setEditingAccount(null);
  };

  const handleDelete = async (account: OwnerAccount) => {
    if (!account.id) return;
    
    if (!window.confirm(`¿Eliminar cuenta de ${account.propietario}?`)) return;

    try {
      await deleteDoc(doc(db, 'ownerAccounts', account.id));
      
      await addDoc(collection(db, 'logs'), {
        usuarioEmail: auth.currentUser?.email,
        accion: 'eliminación',
        entidad: 'owner_accounts',
        detalles: `Eliminó cuenta de ${account.propietario} - ${account.banco}`,
        timestamp: new Date()
      });

      toast.success('Cuenta eliminada');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Error al eliminar');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando cuentas...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header con acciones */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Agregar Cuenta
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Upload size={20} />
            {importing ? 'Importando...' : 'Importar CSV'}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
        </div>

        <div className="text-sm text-gray-600">
          {filteredAccounts.length} de {accounts.length} cuentas
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o documento..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
          <select
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="all">Todos los bancos</option>
            {uniqueBanks.map(bank => (
              <option key={bank} value={bank}>{bank}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asociación</label>
          <select
            value={filterAssociation}
            onChange={(e) => setFilterAssociation(e.target.value as any)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="all">Todas</option>
            <option value="associated">Asociadas</option>
            <option value="unassociated">Sin asociar</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Propietario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagar A</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Cuenta</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banco</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asociado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAccounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{account.propietario}</td>
                <td className="px-4 py-3 text-sm font-mono">{account.documentoPropietario}</td>
                <td className="px-4 py-3 text-sm">
                  {account.pagarA}
                  {account.pagarA !== account.propietario && (
                    <span className="ml-1 text-xs text-orange-600">⚠</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-mono">{maskAccountNumber(account.numeroCuenta)}</td>
                <td className="px-4 py-3 text-sm">{account.banco}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 text-xs rounded ${
                    account.tipoCuenta === 'AHORROS' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {account.tipoCuenta}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {account.responsibleId ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <LinkIcon size={14} />
                      {account.isDefault && <Star size={14} className="fill-yellow-400 text-yellow-400" />}
                    </span>
                  ) : (
                    <span className="text-gray-400">Sin asociar</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEditModal(account)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No se encontraron cuentas
          </div>
        )}
      </div>

      {/* Modal de creación/edición */}
      <OwnerAccountFormModal
        isOpen={showFormModal}
        onClose={handleCloseModal}
        editingAccount={editingAccount}
      />
    </div>
  );
}
