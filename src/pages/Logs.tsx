import React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ActivityLog } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, User, FileText, Info } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';

function Logs() {
  const { data: logs, loading } = useCollection<ActivityLog>('logs', {
    orderBy: [{ field: 'timestamp', direction: 'desc' }],
    limit: 100
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-6">Registro de Actividades</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha y Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detalles
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      {format(log.timestamp.toDate(), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      {log.usuarioEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${log.accion === 'creación' ? 'bg-green-100 text-green-800' : ''}
                        ${log.accion === 'modificación' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${log.accion === 'eliminación' ? 'bg-red-100 text-red-800' : ''}
                        ${log.accion === 'importación' ? 'bg-blue-100 text-blue-800' : ''}`}>
                        {log.accion}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.entidad}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Info className="h-4 w-4 mr-2" />
                      {log.detalles}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Logs;
