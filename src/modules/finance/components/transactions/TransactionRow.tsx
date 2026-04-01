import React, { useState, memo } from 'react';
import { Transaction, Responsible } from '../../../../types';
import { InlineEditInput } from './InlineEditInput';
import { InlineResponsibleSearch } from '../../../responsibles/components/InlineResponsibleSearch';
import { ResponsibleTypeTag } from '../../../responsibles/components/ResponsibleTypeTag';
import { extractDetailsCode } from '../../../../utils/transactionProcessor';

interface TransactionRowProps {
  transaction: Transaction;
  responsible?: Responsible;
  responsibles?: Responsible[];
  columnsConfig: Record<string, {
    width: string;
    label: string;
    key: string;
    wrap?: boolean;
    align?: 'left' | 'right';
    customClass?: string;
  }>;
  getColumnClasses: (columnKey: string, type: 'header' | 'cell') => string;
  onUpdateObservaciones: (transactionId: string, observaciones: string) => Promise<void>;
  onUpdateDocContable: (transactionId: string, docContable: string) => Promise<void>;
  onRemoveAssignment: (transactionId: string) => Promise<void>;
  onAssign: (transactionId: string, responsibleId: string) => Promise<void>;
}

const TransactionRowComponent: React.FC<TransactionRowProps> = ({
  transaction,
  responsible,
  columnsConfig: _columnsConfig, // Renombrado con _ para indicar que es intencional pero no utilizado
  getColumnClasses,
  onUpdateObservaciones,
  onUpdateDocContable,
  onRemoveAssignment,
  onAssign,
  responsibles = []
}) => {
  const [editingObservacion, setEditingObservacion] = useState<boolean>(false);
  const [editingDocContable, setEditingDocContable] = useState<boolean>(false);
  
  const getRowStyle = () => {
    const hasDocContable = transaction.docContable && transaction.docContable.trim() !== '';
    const hasResponsible = !!responsible;
    
    if (hasResponsible && hasDocContable) {
      return {
        background: 'bg-blue-50 hover:bg-blue-100',
        border: 'border-l-4 border-l-blue-500',
        transition: 'transition-colors duration-200'
      };
    }
    if (hasResponsible && !hasDocContable) {
      return {
        background: 'bg-yellow-50 hover:bg-yellow-100',
        border: 'border-l-4 border-l-yellow-500',
        transition: 'transition-colors duration-200'
      };
    }
    if (!hasResponsible && hasDocContable) {
      return {
        background: 'bg-orange-50 hover:bg-orange-100',
        border: 'border-l-4 border-l-orange-500',
        transition: 'transition-colors duration-200'
      };
    }
    if (!hasResponsible && !hasDocContable && transaction.observaciones?.trim()) {
      return {
        background: 'bg-green-50 hover:bg-green-100',
        border: 'border-l-4 border-l-green-500',
        transition: 'transition-colors duration-200'
      };
    }
    return {
      background: 'hover:bg-gray-50',
      border: '',
      transition: 'transition-colors duration-200'
    };
  };

  const rowStyle = getRowStyle();

  return (
    <tr className={`${rowStyle.background} ${rowStyle.border} ${rowStyle.transition}`}>
      <td className={getColumnClasses('index', 'cell')}>
        {transaction.rowIndex}
      </td>
      <td className={getColumnClasses('date', 'cell')}>
        {transaction.fechaStr}
      </td>
      <td className={getColumnClasses('description', 'cell')}>
        {transaction.descripcion}
      </td>
      <td className={getColumnClasses('amount', 'cell')}>
        <span className={transaction.valor > 0 ? 'text-green-600' : transaction.valor < 0 ? 'text-red-600' : ''}>
          {new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(transaction.valor)}
        </span>
      </td>
      <td className={getColumnClasses('details', 'cell')}>
        {transaction.detallesAdicionales || '-'}
      </td>
      <td className={getColumnClasses('detailsCode', 'cell')}>
        {extractDetailsCode(transaction.detallesAdicionales ?? '') || '-'}
      </td>
      <td className={getColumnClasses('responsible', 'cell')}>
        {responsible ? (
          <div className="flex items-center justify-between">
            <ResponsibleTypeTag
              type={responsible.type}
              responsible={responsible}
              showName={true}
              transactionId={transaction.id}
              onRemove={onRemoveAssignment}
            />
          </div>
        ) : (
          <div 
            className="px-2 py-1 text-blue-600 hover:text-blue-800 cursor-pointer"
            title="Asignar responsable"
          >
            <InlineResponsibleSearch 
              transaction={transaction}
              transactionId={transaction.id}
              responsibles={responsibles}
              onAssign={(responsibleId) => onAssign(transaction.id, responsibleId)}
            />
          </div>
        )}
      </td>
      <td className={getColumnClasses('observaciones', 'cell')}>
        <InlineEditInput
          value={transaction.observaciones || ''}
          onSave={(value) => onUpdateObservaciones(transaction.id, value)}
          placeholder="Agregar observación..."
          isEditing={editingObservacion}
          setIsEditing={setEditingObservacion}
        />
      </td>
      <td className={getColumnClasses('docContable', 'cell')}>
        <InlineEditInput
          value={transaction.docContable || ''}
          onSave={(value) => onUpdateDocContable(transaction.id, value)}
          placeholder="Agregar documento..."
          isEditing={editingDocContable}
          setIsEditing={setEditingDocContable}
        />
      </td>
    </tr>
  );
};

// Utilizamos React.memo para optimizar el rendimiento evitando re-renders innecesarios
export const TransactionRow = memo(TransactionRowComponent);
