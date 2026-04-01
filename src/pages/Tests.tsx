import { CheckCircle2, Beaker, AlertTriangle, Play } from 'lucide-react';
import { testsList } from '../components/test';
import toast from 'react-hot-toast';

export default function Tests() {
  const runAll = async () => {
    for (const test of testsList) {
      try {
        test.action();
        // Pequeña pausa para que los toasts no se solapen demasiado
        // eslint-disable-next-line no-await-in-loop
        await new Promise(res => setTimeout(res, 150));
      } catch (err) {
        console.error(`[TEST] Error al ejecutar ${test.id}:`, err);
        toast.error(`Error al ejecutar ${test.title}`);
      }
    }
    toast.success('Todos los tests mock ejecutados');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Beaker className="text-blue-600" size={24} />
          Panel de Pruebas (Solo lectura)
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Ejecución segura: no se escriben datos en Firestore ni en ningún estado persistente.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={runAll}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            <Play size={16} />
            Ejecutar todos los tests
          </button>
          <span className="text-xs text-gray-500 self-center">Ejecuta los tests en orden; solo toasts/logs (mock)</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {testsList.map(test => (
          <div
            key={test.id}
            className="border border-gray-200 rounded-lg bg-white shadow-sm p-4 flex items-start gap-3"
          >
            <div className="mt-1 text-blue-600">
              {test.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{test.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{test.description}</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={test.action}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                >
                  <CheckCircle2 size={16} />
                  Ejecutar prueba (mock)
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5" />
        <p>
          Estas pruebas son simuladas y no persisten datos. Úsalas para validar flujos de UI y lógicas
          sin afectar información real.
        </p>
      </div>
    </div>
  );
}
