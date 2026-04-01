import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, QueryConstraint } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Assignment } from '../types';

interface UseAssignmentsOptions {
  transactionId?: string;
  responsibleId?: string;
}

export function useAssignments(options: UseAssignmentsOptions = {}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('assignedAt', 'desc')];
    
    if (options.transactionId) {
      constraints.push(where('transactionId', '==', options.transactionId));
    }
    
    if (options.responsibleId) {
      constraints.push(where('responsibleId', '==', options.responsibleId));
    }

    const q = query(collection(db, 'assignments'), ...constraints);

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const assignmentsData: Assignment[] = [];
        snapshot.forEach((doc) => {
          assignmentsData.push({
            id: doc.id,
            ...doc.data() as Omit<Assignment, 'id'>
          });
        });
        setAssignments(assignmentsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching assignments:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [options.transactionId, options.responsibleId]);

  return { assignments, loading, error };
}

export function useLatestAssignments(options: UseAssignmentsOptions = {}) {
  const { assignments, loading, error } = useAssignments(options);
  
  // Get the latest assignment for each transaction
  const latestAssignments = assignments.reduce((acc, current) => {
    const existing = acc.get(current.transactionId);
    if (!existing || existing.assignedAt < current.assignedAt) {
      acc.set(current.transactionId, current);
    }
    return acc;
  }, new Map<string, Assignment>());

  return {
    assignments: Array.from(latestAssignments.values()),
    loading,
    error
  };
}
