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

  onAddActivity: (activity: any) => void;

  onAddStoppage: (stoppage: any) => void;

  onAddBatch: (rows: BatchRow[], productionDate: string, collaborator: string) => void;
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
  onAddStoppage,
  onAddBatch
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

    let start =
    startHour * 60 + startMinute;
  
    let end =
      endHour * 60 + endMinute;
    
    if (end < start) {
      end += 24 * 60;
    }
    
    totalMinutes += end - start;

  });

  return totalMinutes;
};

  const handleSubmitBatch = async () => {

  try {
  
    if (!productionDate) {
    alert('Informe a data da produção.');
    return;
  }
  
  if (!selectedCollaborator) {
    alert('Selecione um colaborador.');
    return;
  }

    for (const row of rows) {

  const isEmptyRow =
  !row.code &&
  !row.startTime &&
  !row.endTime &&
  !row.local?.trim() &&
  !row.listId?.trim() &&
  !row.notes?.trim() &&
  !row.palletJackId?.trim() &&
  !row.forkliftId?.trim() &&
  (!row.producedQuantity || row.producedQuantity === 0) &&
  (!row.itemsQuantity || row.itemsQuantity === 0);

if (isEmptyRow) {
  continue;
}
      
  if (!row.code) {
  alert(`Linha ${rows.indexOf(row) + 1}: selecione uma atividade ou parada.`);
  return;
}
      
  if (!row.startTime || !row.endTime) {
  alert(`Linha ${rows.indexOf(row) + 1}: informe horário inicial e final.`);
  return;
}

  const [sh, sm] =
  row.startTime.split(':').map(Number);

const [eh, em] =
  row.endTime.split(':').map(Number);

const startMinutes =
  sh * 60 + sm;

const endMinutes =
  eh * 60 + em;

if (startMinutes === endMinutes) {

  alert(
    `Linha ${rows.indexOf(row) + 1}: horário inicial e final não podem ser iguais.`
  );

  return;
}
      
  if (
  row.type === 'ATIVIDADE' &&
  !row.local?.trim()
) {
  alert(
     `Linha ${rows.indexOf(row) + 1}: informe o local da atividade.`
  );
  return;
}

  if (
  row.type === 'ATIVIDADE' &&
  Number(row.code) === 1 &&
  !row.listId?.trim()
) {
  alert(
    `Linha ${rows.indexOf(row) + 1}: informe o número da lista.`
  );
  return;
}

    if (
  row.type === 'ATIVIDADE' &&
  [1, 2, 3].includes(Number(row.code))
) {

  if (
    row.producedQuantity <= 0 ||
    row.itemsQuantity <= 0
  ) {

    alert(
      `Linha ${rows.indexOf(row) + 1}: informe quantidade de peças e itens.`
    );

    return;
  }

}

  if (
  row.producedQuantity < 0 ||
  row.itemsQuantity < 0
) {

  if (
  row.type === 'ATIVIDADE' &&
  row.producedQuantity > 10000
) {

  const confirmed = window.confirm(
    `Linha ${rows.indexOf(row) + 1}: foram informadas ${row.producedQuantity.toLocaleString('pt-BR')} peças.\n\n` +
    `Esse valor está acima do limite de conferência de 15.000 peças para uma única atividade.\n\n` +
    `Deseja continuar mesmo assim?`
  );

  if (!confirmed) {
    return;
  }

}
    
  alert(
    `Linha ${rows.indexOf(row) + 1}: quantidade inválida.`
  );

  return;
}
      
}

let totalActivityMinutes = 0;

for (const row of rows) {

  if (row.type !== 'ATIVIDADE') {
    continue;
  }

  if (!row.startTime || !row.endTime) {
    continue;
  }

  const [sh, sm] =
    row.startTime.split(':').map(Number);

  const [eh, em] =
    row.endTime.split(':').map(Number);

  let startMinutes =
    sh * 60 + sm;

  let endMinutes =
    eh * 60 + em;

  // suporta virada de dia
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  totalActivityMinutes +=
    endMinutes - startMinutes;
}

  const minimumMinutes = 450; // 7h30

if (totalActivityMinutes < minimumMinutes) {

  const hours =
    Math.floor(totalActivityMinutes / 60);

  const minutes =
    totalActivityMinutes % 60;

  const confirmed =
    window.confirm(
      `A soma das atividades é ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}.

A jornada mínima esperada é 07:30.

Deseja continuar mesmo assim?`
    );

  if (!confirmed) {
    return;
  }

}
    
    const activityRows = rows.filter(
  row =>
    row.type === 'ATIVIDADE' &&
    row.startTime &&
    row.endTime
);

let hasConflict = false;

for (let i = 0; i < activityRows.length; i++) {

  const current =
    activityRows[i];

  const [sh1, sm1] =
    current.startTime.split(':').map(Number);

  const [eh1, em1] =
    current.endTime.split(':').map(Number);

  let start1 =
    sh1 * 60 + sm1;

  let end1 =
    eh1 * 60 + em1;

  if (end1 < start1) {
    end1 += 24 * 60;
  }

  for (
    let j = i + 1;
    j < activityRows.length;
    j++
  ) {

    const next =
      activityRows[j];

    const [sh2, sm2] =
      next.startTime.split(':').map(Number);

    const [eh2, em2] =
      next.endTime.split(':').map(Number);

    let start2 =
      sh2 * 60 + sm2;

    let end2 =
      eh2 * 60 + em2;

    if (end2 < start2) {
      end2 += 24 * 60;
    }

    const overlap =
      start1 < end2 &&
      end1 > start2;

    if (overlap) {

      hasConflict = true;

      break;

    }

  }

  if (hasConflict) {
    break;
  }

}

    if (hasConflict) {

  const confirmed =
    window.confirm(
      'Existe conflito de horários entre os lançamentos. Deseja continuar mesmo assim?'
    );

  if (!confirmed) {
    return;
  }

}

    let hasLongDuration = false;

for (const row of rows) {

  if (!row.startTime || !row.endTime) {
    continue;
  }

  const [sh, sm] =
    row.startTime.split(':').map(Number);

  const [eh, em] =
    row.endTime.split(':').map(Number);

  let startMinutes =
    sh * 60 + sm;

  let endMinutes =
    eh * 60 + em;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes =
    endMinutes - startMinutes;

  if (durationMinutes > 720) {
    hasLongDuration = true;
    break;
  }

}

    if (hasLongDuration) {

  const confirmed =
    window.confirm(
      'Foi identificado um lançamento com duração superior a 12 horas. Deseja continuar mesmo assim?'
    );

  if (!confirmed) {
    return;
  }

}
    
    onAddBatch(
    rows,
    productionDate,
    selectedCollaborator
  );
    
    setRows([
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

setProductionDate('');
setSelectedCollaborator('');
    
alert('Lote lançado com sucesso.');
    
  } catch (error) {

    console.error(
      'ERRO LOTE:',
      error
    );

  }

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
                        row.type === 'PARADA' ||
                        Number(row.code) !== 1
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
                      disabled={
                      row.type === 'PARADA' ||
                      Number(row.code) !== 1
                    }
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
