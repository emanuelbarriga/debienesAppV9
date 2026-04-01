import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Assignment, ResponsibleType } from '../types';
import toast from 'react-hot-toast';

export const useAssignResponsible = () => {
  const [loading, setLoading] = useState(false);

  const assignResponsible = async (
    transactionId: string, 
    responsibleId: string,
    metadata?: {
      assignedBy?: string;
      assignedAt?: string;
      matchedCode?: string;
      matchType?: string;
      matchedAmount?: number;
    }
  ) => {
    if (!transactionId || !responsibleId) {
      console.error('Missing required IDs:', { transactionId, responsibleId });
      toast.error('Error: IDs no válidos');
      return;
    }

    try {
      setLoading(true);

      // Create batch for all operations
      const batch = writeBatch(db);

      // Get all required documents in parallel
      const [transactionDoc, responsibleDoc, existingAssignments] = await Promise.all([
        getDoc(doc(db, 'transactions', transactionId)),
        getDoc(doc(db, 'responsibles', responsibleId)),
        getDocs(query(collection(db, 'assignments'), where('transactionId', '==', transactionId)))
      ]);

      // Validate documents exist
      if (!transactionDoc.exists()) {
        throw new Error(`Transaction with ID ${transactionId} not found`);
      }
      if (!responsibleDoc.exists()) {
        throw new Error(`Responsible with ID ${responsibleId} not found`);
      }

      const responsible = responsibleDoc.data();

      // Delete existing assignments
      existingAssignments.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Prepare new assignment data
      const assignmentData: Assignment = {
        transactionId,
        responsibleId,
        responsibleType: (responsible.type || 'other') as ResponsibleType,
        assignedAt: new Date(),
        assignedBy: metadata?.assignedBy || 'USER',
        assignmentMethod: metadata?.assignedBy === 'AUTO' ? 'automatic' : 'manual'
      };

      if (metadata?.matchedCode) {
        assignmentData.matchedCode = metadata.matchedCode;
      }
      
      if (metadata?.matchType) {
        // Keep for backward compatibility
      }
      
      if (metadata?.matchedAmount) {
        assignmentData.matchedAmount = metadata.matchedAmount;
      }

      // Create new assignment
      const newAssignmentRef = doc(collection(db, 'assignments'));
      batch.set(newAssignmentRef, assignmentData);

      // Update transaction
      const transactionUpdate = {
        responsible: {
          id: responsibleId,
          name: responsible.name,
          type: responsible.type
        },
        lastAssignment: {
          assignedAt: assignmentData.assignedAt,
          assignedBy: assignmentData.assignedBy,
          assignmentMethod: assignmentData.assignmentMethod
        }
      };

      batch.update(doc(db, 'transactions', transactionId), transactionUpdate);

      // Commit all changes in a single batch
      await batch.commit();

      toast.success('Responsable asignado correctamente');
      return newAssignmentRef.id;
    } catch (error) {
      console.error('Error in assignResponsible:', error);
      toast.error('Error al asignar responsable');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { assignResponsible, loading };
};
