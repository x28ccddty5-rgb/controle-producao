import React from 'react';

interface ProductionBatchProps {
  collaborators: string[];

  activitiesList: {
    code: number;
    label: string;
  }[];

  stoppagesList: {
    code: number;
    name: string;
  }[];
}

interface BatchRow {
  id: string;

  type: 'ATIVIDADE' | 'PARADA';

  code: string;

  local: string;

  listId: string;

  startTime: string;

  endTime: string;

  palletJackId: string;

  forkliftId: string;

  producedQuantity: number;

  itemsQuantity: number;

  notes: string;
}

export default function ProductionBatch({
  collaborators,
  activitiesList,
  stoppagesList
}: ProductionBatchProps) {

  const [rows, setRows] = React.useState<BatchRow[]>([
  {
    id: crypto.randomUUID(),

    type: 'ATIVIDADE',

    code: '',

    local: '',

    listId: '',

    startTime: '',

    endTime: '',

    palletJackId: '',

    forkliftId: '',

    producedQuantity: 0,

    itemsQuantity: 0,

    notes: ''
  }
]);
  
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
              <option value="">
                Selecione...
              </option>
            
              {collaborators.map(collab => (
                <option
                  key={collab}
                  value={collab}
                >
                  {collab}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">
          Lançamentos
        </h3>

         <div className="overflow-auto max-h-[500px] border border-slate-200 rounded-lg">

          <table className="w-full text-sm">

            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="border-b border-slate-300">

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
                <th className="text-center p-2">Remover</th>

              </tr>
            </thead>

            <tbody>

              {rows.map(row => (
            
                <tr
                  key={row.id}
                  className="border-b border-slate-200"
                >
            
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={row.type}
                    >
                      <option value="ATIVIDADE">
                        Atividade
                      </option>
            
                      <option value="PARADA">
                        Parada
                      </option>
                    </select>
                  </td>
            
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={row.code}
                    >
                      <option value="">
                        Selecione...
                      </option>
            
                      {row.type === 'ATIVIDADE'
                        ? activitiesList.map(activity => (
                            <option
                              key={activity.code}
                              value={activity.code}
                            >
                              {activity.code} - {activity.label}
                            </option>
                          ))
                        : stoppagesList.map(stoppage => (
                            <option
                              key={stoppage.code}
                              value={stoppage.code}
                            >
                              {stoppage.code} - {stoppage.name}
                            </option>
                          ))}
                    </select>
                  </td>
            
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={row.local}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={row.listId}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      type="time"
                      className="border rounded px-2 py-1 w-full"
                      value={row.startTime}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      type="time"
                      className="border rounded px-2 py-1 w-full"
                      value={row.endTime}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={row.palletJackId}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={row.forkliftId}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-full"
                      value={row.producedQuantity}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-full"
                      value={row.itemsQuantity}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={row.notes}
                    />
                  </td>
            
                  <td className="p-2 text-center">
                    <button
                      onClick={() =>
                        setRows(prev =>
                          prev.filter(r => r.id !== row.id)
                        )
                      }
                      className="text-red-600 font-bold text-lg"
                    >
                      🗑
                    </button>
                  </td>
            
                </tr>
            
              ))}
            
            </tbody>
            
          </table>

            <div className="mt-4">
              <button
                onClick={() =>
                  setRows(prev => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
            
                      type: 'ATIVIDADE',
            
                      code: '',
            
                      local: '',
            
                      listId: '',
            
                      startTime: '',
            
                      endTime: '',
            
                      palletJackId: '',
            
                      forkliftId: '',
            
                      producedQuantity: 0,
            
                      itemsQuantity: 0,
            
                      notes: ''
                    }
                  ])
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                + Inserir Linha
              </button>
            </div>

        </div>
      </div>

    </div>
  );
}
