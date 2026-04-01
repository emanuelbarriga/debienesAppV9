import React from 'react';
import { Database } from 'lucide-react';

interface FirestoreMetricsProps {
  reads: number;
  writes: number;
  lastUpdated: Date | null;
}

export const FirestoreMetrics: React.FC<FirestoreMetricsProps> = ({
  reads,
  writes,
  //lastUpdated,
}) => {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
      <Database className="w-4 h-4" />
      <div className="flex items-center gap-3">
        <span title="Lecturas de Firestore" className="flex items-center gap-1">
          <span className="font-medium text-blue-600">{reads}</span>
          <span className="text-xs">lecturas</span>
        </span>
        <span title="Escrituras en Firestore" className="flex items-center gap-1">
          <span className="font-medium text-green-600">{writes}</span>
          <span className="text-xs">escrituras</span>
        </span>
      </div>
    </div>
  );
};
