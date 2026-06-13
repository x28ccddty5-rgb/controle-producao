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

  onAddActivity: any;

  onAddStoppage: any;
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
  stoppagesList,

  onAddActivity,
  onAddStoppage
}: ProductionBatchProps) {

  const [productionDate, setProductionDate] =
  React.useState('');

  const [selectedCollaborator, setSelectedCollaborator] =
  React.useState('');
  
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

  const calculateActivityHours = () => {

  let totalMinutes = 0;

  rows.forEach(row => {

    if (
      row.type !== 'ATIVIDADE' ||
      !row.startTime ||
      !row.endTime
    ) {
      return;
    }

    const [startHour, startMinute] =
      row.startTime.split(':').map(Number);

    const [endHour, endMinute] =
      row.endTime.split(':').map(Number);

    const start =
      startHour * 60 + startMinute;

    const end =
      endHour * 60 + endMinute;

    totalMinutes += end - start;

  });

  return totalMinutes;
};

  const handleSubmitBatch = () => {

  rows.forEach(row => {

    if (row.type === 'ATIVIDADE') {

      console.log('ATIVIDADE');

      console.log(row);

    }

    if (row.type === 'PARADA') {

      console.log('PARADA');

      console.log(row);

    }

  });

};
  
  return (
    <div className="space-y-6">

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">

            <h2 className="text-xl font-bold text-slate-800">
              Produção em Lote
            </h2>
          
            <div className="flex items-center gap-4">
          
              <div className="text-sm text-slate-600">
                Horas Produção:
          
                <span className="font-bold ml-2">
                  {(calculateActivityHours() / 60).toFixed(2)}h
                </span>
              </div>
          
              <button
                onClick={handleSubmitBatch}
                className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Lançar Lote Completo
              </button>
          
            </div>
          
          </div>

        <div className="grid grid-cols-2 gap-6 items-end">
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data da Produção
            </label>

            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={productionDate}
              onChange={(e) =>
                setProductionDate(e.target.value)
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Colaborador
            </label>

            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              value={selectedCollaborator}
              onChange={(e) =>
                setSelectedCollaborator(e.target.value)
              }
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

                <th className="text-left p-2 w-[120px]">Tipo</th>

                <th className="text-left p-2 w-[260px]">
                  Código
                </th>
                
                <th className="text-left p-2 w-[80px]">
                  Local
                </th>
                
                <th className="text-left p-2 w-[90px]">
                  Lista
                </th>
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
            
                  <td className="p-2 w-[120px]">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={row.type}
                      onChange={(e) =>
                        setRows(prev =>
                          prev.map(r =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  type: e.target.value as 'ATIVIDADE' | 'PARADA',
                                  code: ''
                                }
                              : r
                          )
                        )
                      }
                    >
                      <option value="ATIVIDADE">
                        Atividade
                      </option>
                  
                      <option value="PARADA">
                        Parada
                      </option>
                    </select>
                  </td>
                  <td className="p-2 w-[260px]">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={row.code}
                      onChange={(e) =>
                        setRows(prev =>
                          prev.map(r =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  code: e.target.value
                                }
                              : r
                          )
                        )
                      }
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
            
                  <td className="p-2 w-[80px]">
                    <input
                      className={`border rounded px-2 py-1 w-full ${
                        row.type === 'PARADA'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : ''
                      }`}
                      value={row.local}
                      onChange={(e) =>
                        setRows(prev =>
                          prev.map(r =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  local: e.target.value
                                }
                              : r
                          )
                        )
                      }
                      disabled={row.type === 'PARADA'}
                    />
                  </td>
            
                  <td className="p-2 w-[90px]">
                    <input
                      className={`border rounded px-2 py-1 w-full ${
                        row.type === 'PARADA'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : ''
                      }`}
                      value={row.listId}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                listId: e.target.value
                              }
                            : r
                        )
                      )
                    }
                      disabled={row.type === 'PARADA'}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      type="time"
                      className="border rounded px-2 py-1 w-full"
                      value={row.startTime}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                startTime: e.target.value
                              }
                            : r
                        )
                      )
                    }
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      type="time"
                      className="border rounded px-2 py-1 w-full"
                      value={row.endTime}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                endTime: e.target.value
                              }
                            : r
                        )
                      )
                    }
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className={`border rounded px-2 py-1 w-full ${
                        row.type === 'PARADA'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : ''
                      }`}
                      value={row.palletJackId}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                palletJackId: e.target.value
                              }
                            : r
                        )
                      )
                    }
                      disabled={row.type === 'PARADA'}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className={`border rounded px-2 py-1 w-full ${
                        row.type === 'PARADA'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : ''
                      }`}
                      value={row.forkliftId}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                forkliftId: e.target.value
                              }
                            : r
                        )
                      )
                    }
                      disabled={row.type === 'PARADA'}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className={`border rounded px-2 py-1 w-full ${
                        row.type === 'PARADA'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : ''
                      }`}
                      value={row.producedQuantity}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                producedQuantity: Number(e.target.value)
                              }
                            : r
                        )
                      )
                    }
                      disabled={row.type === 'PARADA'}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className={`border rounded px-2 py-1 w-full ${
                        row.type === 'PARADA'
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : ''
                      }`}
                      value={row.itemsQuantity}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                itemsQuantity: Number(e.target.value)
                              }
                            : r
                        )
                      )
                    }
                      disabled={row.type === 'PARADA'}
                    />
                  </td>
            
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={row.notes}
                      onChange={(e) =>
                      setRows(prev =>
                        prev.map(r =>
                          r.id === row.id
                            ? {
                                ...r,
                                notes: e.target.value
                              }
                            : r
                        )
                      )
                    }
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
