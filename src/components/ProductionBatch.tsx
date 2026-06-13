import React from 'react';

export default function ProductionBatch() {
  return (
    <div className="space-y-6">

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">
          Produção em Lote
        </h2>

        <div className="grid grid-cols-2 gap-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data da Produção
            </label>

            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Colaborador
            </label>

            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option>Selecione...</option>
            </select>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">
          Lançamentos
        </h3>

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>
              <tr className="border-b">

                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Código</th>
                <th className="text-left p-2">Local</th>
                <th className="text-left p-2">Lista</th>
                <th className="text-left p-2">Início</th>
                <th className="text-left p-2">Fim</th>
                <th className="text-left p-2">Mov. Paleteira</th>
                <th className="text-left p-2">Mov. Empilhadeira</th>
                <th className="text-left p-2">Qtd Pçs</th>
                <th className="text-left p-2">Qtd Itens</th>
                <th className="text-left p-2">Observação</th>

              </tr>
            </thead>

            <tbody>

              <tr>

                <td className="p-2">
                  <select className="border rounded px-2 py-1 w-full">
                    <option>Atividade</option>
                    <option>Parada</option>
                  </select>
                </td>

                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input type="time" className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input type="time" className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input type="number" className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input type="number" className="border rounded px-2 py-1 w-full" />
                </td>

                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" />
                </td>

              </tr>

            </tbody>

          </table>

        </div>
      </div>

    </div>
  );
}
