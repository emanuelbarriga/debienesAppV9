import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  getFirestore, 
  QuerySnapshot, 
  DocumentData,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  orderBy,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FirestoreMetrics {
  reads: number;
  writes: number;
  lastUpdated: Date | null;
}

interface CacheConfig {
  expireTime: number; // tiempo en minutos
  localStorageKey: string;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  expireTime: 5, // 5 minutos por defecto
  localStorageKey: 'firestoreCache',
};

export const useFirestoreOptimized = <T extends { id?: string }>(
  collectionName: string,
  cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FirestoreMetrics>({
    reads: 0,
    writes: 0,
    lastUpdated: null,
  });

  // Función para guardar en caché local
  const saveToCache = (data: T[]) => {
    const cacheData = {
      data,
      timestamp: new Date().getTime(),
    };
    localStorage.setItem(
      `${cacheConfig.localStorageKey}_${collectionName}`,
      JSON.stringify(cacheData)
    );
  };

  // Función para obtener datos del caché
  const getFromCache = (): { data: T[] | null; isValid: boolean } => {
    const cached = localStorage.getItem(
      `${cacheConfig.localStorageKey}_${collectionName}`
    );
    if (!cached) return { data: null, isValid: false };

    const { data, timestamp } = JSON.parse(cached);
    const now = new Date().getTime();
    const diffMinutes = (now - timestamp) / (1000 * 60);

    return {
      data,
      isValid: diffMinutes < cacheConfig.expireTime,
    };
  };

  // Función para incrementar métricas
  const incrementMetric = useCallback((type: 'reads' | 'writes') => {
    setMetrics(prev => ({
      ...prev,
      [type]: prev[type] + 1,
      lastUpdated: new Date(),
    }));
  }, []);

  // Operaciones de Firestore con seguimiento de métricas
  const updateItem = useCallback(async (id: string, newData: Partial<T>) => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, newData);
      incrementMetric('writes');
      
      // Actualizar el estado local inmediatamente
      setData(prevData => 
        prevData.map(item => 
          (item as any).id === id ? { ...item, ...newData } : item
        )
      );
      
      return true;
    } catch (error) {
      return false;
    }
  }, [collectionName, incrementMetric]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      incrementMetric('writes');
      
      // Actualizar el estado local inmediatamente
      setData(prevData => prevData.filter(item => (item as any).id !== id));
      
      return true;
    } catch (error) {
      return false;
    }
  }, [collectionName, incrementMetric]);

  const addItem = useCallback(async (newItem: Omit<T, 'id'>) => {
    try {
      const collectionRef = collection(db, collectionName);
      const docRef = await addDoc(collectionRef, newItem);
      incrementMetric('writes');
      
      // Actualizar el estado local inmediatamente
      const itemWithId = { ...newItem, id: docRef.id } as T;
      setData(prevData => [...prevData, itemWithId]);
      
      return docRef.id;
    } catch (error) {
      return null;
    }
  }, [collectionName, incrementMetric]);

  useEffect(() => {
    setLoading(true);

    // Si no hay caché válido, obtener de Firestore
    const queryConstraints: QueryConstraint[] = [];
    
    // Agregar ordenamiento si está configurado
    if (cacheConfig.orderByField) {
      queryConstraints.push(
        orderBy(
          cacheConfig.orderByField, 
          cacheConfig.orderDirection || 'asc'
        )
      );
    }

    const collectionRef = collection(db, collectionName);

    const q = query(collectionRef, ...queryConstraints);
    
    const unsubscribe = onSnapshot(q, {
      next: (snapshot: QuerySnapshot<DocumentData>) => {

        if (!snapshot.metadata.fromCache) {
          incrementMetric('reads');
        }

        const newData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            firestoreId: doc.id
          };
        }) as T[];

        setData(newData);
        setLoading(false);
        saveToCache(newData);
      },
      error: (error) => {
        setLoading(false);
      }
    });

    // Limpiar la suscripción cuando el componente se desmonte
    return () => {
      unsubscribe();
    };
  }, [collectionName, cacheConfig.orderByField, cacheConfig.orderDirection]);

  return { 
    data, 
    loading, 
    metrics,
    updateItem,
    deleteItem,
    addItem
  };
};
