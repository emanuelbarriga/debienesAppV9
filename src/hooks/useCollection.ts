import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, QuerySnapshot, DocumentData, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';

interface OrderByOption {
  field: string;
  direction: 'asc' | 'desc';
}

interface CollectionOptions {
  orderBy?: OrderByOption[];
}

export function useCollection<T>(collectionName: string, options?: CollectionOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const refresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    // Verificar si el usuario está autenticado
    const user = auth.currentUser;
    if (!user) {
      setError(new Error('Usuario no autenticado'));
      setLoading(false);
      return;
    }

    // Limpiar la suscripción anterior si existe
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      let collectionRef = collection(db, collectionName);
      
      if (options?.orderBy) {
        const queryConstraints = options.orderBy.map(({ field, direction }) => 
          firestoreOrderBy(field, direction)
        );
        collectionRef = query(collectionRef, ...queryConstraints) as any;
      }

      const unsubscribe = onSnapshot(
        collectionRef,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const documents = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
          })) as T[];
          setData(documents);
          setLoading(false);
        },
        (err: Error) => {
          console.error(`Error al obtener ${collectionName}:`, err);
          setError(err);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
      
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (err) {
      console.error(`Error al configurar la suscripción a ${collectionName}:`, err);
      setError(err as Error);
      setLoading(false);
    }
  }, [collectionName, JSON.stringify(options), refreshKey]);

  return { data, loading, error, refresh };
}