import React from 'react';
import { Keyboard, Plus, Trash2 } from 'lucide-react';

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

type GridField =
  | 'type'
  | 'code'
  | 'local'
  | 'listId'
  | 'startTime'
  | 'endTime'
  | 'palletJackId'
  | 'forkliftId'
  | 'producedQuantity'
  | 'itemsQuantity'
  | 'notes';

const GRID_FIELDS: GridField[] = [
  'type',
  'code',
  'local',
  'listId',
  'startTime',
  'endTime',
  'palletJackId',
  'forkliftId',
  'producedQuantity',
  'itemsQuantity',
  'notes'
];

const createEmptyRow = (): BatchRow => ({
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
});

const getTimeDigits = (value: string) =>
  value.replace(/\D/g, '').slice(0, 4);

const formatTimeInput = (value: string) => {
  const digits = getTimeDigits(value);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const isValidTime = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hour, minute] = value.split(':').map(Number);

  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
};

export default function ProductionBatch({
  collaborators,
  activitiesList,
  stoppagesList,
  onAddActivity,
  onAddStoppage,
  onAddBatch
}: ProductionBatchProps) {
  // Mantidos na interface por compatibilidade com o componente atual.
  void onAddActivity;
  void onAddStoppage;

  const [productionDate, setProductionDate] = React.useState('');
  const [selectedCollaborator, setSelectedCollaborator] = React.useState('');

  const [rows, setRows] = React.useState<BatchRow[]>([
    createEmptyRow()
  ]);

  const gridRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const getGridKey = (rowId: string, field: GridField) =>
    `${rowId}:${field}`;

  const focusCell = React.useCallback(
    (rowId: string, field: GridField) => {
      const element = gridRefs.current[getGridKey(rowId, field)];

      if (!element) {
        return;
      }

      element.focus();

      if (
        element instanceof HTMLInputElement &&
        element.type === 'text' &&
        element.selectionStart !== null
      ) {
        const length = element.value.length;
        element.setSelectionRange(length, length);
      }
    },
    []
  );

  const updateRow = React.useCallback(
    <K extends keyof BatchRow>(
      rowId: string,
      field: K,
      value: BatchRow[K]
    ) => {
      setRows(prev =>
        prev.map(row =>
          row.id === rowId
            ? {
                ...row,
                [field]: value
              }
            : row
        )
      );
    },
    []
  );

  const addRow = React.useCallback(
    (afterRowId?: string, focusField: GridField = 'type') => {
      const newRow = createEmptyRow();

      setRows(prev => {
        if (!afterRowId) {
          return [...prev, newRow];
        }

        const index = prev.findIndex(row => row.id === afterRowId);

        if (index === -1) {
          return [...prev, newRow];
        }

        return [
          ...prev.slice(0, index + 1),
          newRow,
          ...prev.slice(index + 1)
        ];
      });

      window.setTimeout(() => {
        focusCell(newRow.id, focusField);
      }, 0);
    },
    [focusCell]
  );

  const removeRow = React.useCallback((rowId: string) => {
    setRows(prev => {
      if (prev.length === 1) {
        return [createEmptyRow()];
      }

      return prev.filter(row => row.id !== rowId);
    });
  }, []);

  const handleGridKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    field: GridField
  ) => {
    const target = event.currentTarget;

    // Enter cria uma nova linha sem alterar as regras de lançamento.
    if (event.key === 'Enter') {
      event.preventDefault();
      addRow(rows[rowIndex]?.id, 'type');
      return;
    }

    // Mantemos as setas nativas de selects e textareas.
    if (
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return;
    }

    const fieldIndex = GRID_FIELDS.indexOf(field);

    if (fieldIndex === -1) {
      return;
    }

    const isFieldAvailable = (targetRow: BatchRow, targetField: GridField) => {
      if (
        targetRow.type === 'PARADA' &&
        [
          'local',
          'listId',
          'palletJackId',
          'forkliftId',
          'producedQuantity',
          'itemsQuantity'
        ].includes(targetField)
      ) {
        return false;
      }

      if (
        targetRow.type === 'ATIVIDADE' &&
        targetField === 'listId' &&
        Number(targetRow.code) !== 1
      ) {
        return false;
      }

      return true;
    };

    let nextRowIndex = rowIndex;
    let nextFieldIndex = fieldIndex;

    const rowStep =
      event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowDown'
          ? 1
          : 0;

    const fieldStep =
      event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowRight'
          ? 1
          : 0;

    nextRowIndex += rowStep;
    nextFieldIndex += fieldStep;

    if (
      nextRowIndex < 0 ||
      nextRowIndex >= rows.length ||
      nextFieldIndex < 0 ||
      nextFieldIndex >= GRID_FIELDS.length
    ) {
      return;
    }

    // Ao navegar verticalmente, pula campos que não fazem parte da parada.
    if (rowStep !== 0) {
      const nextRow = rows[nextRowIndex];
      const nextField = GRID_FIELDS[nextFieldIndex];

      if (!isFieldAvailable(nextRow, nextField)) {
        const direction = rowStep;
        let candidateRowIndex = nextRowIndex;

        while (
          candidateRowIndex >= 0 &&
          candidateRowIndex < rows.length
        ) {
          if (
            isFieldAvailable(
              rows[candidateRowIndex],
              nextField
            )
          ) {
            nextRowIndex = candidateRowIndex;
            break;
          }

          candidateRowIndex += direction;
        }

        if (
          candidateRowIndex < 0 ||
          candidateRowIndex >= rows.length
        ) {
          return;
        }
      }
    }

    if (fieldStep !== 0) {
      const nextRow = rows[nextRowIndex];

      while (
        nextFieldIndex >= 0 &&
        nextFieldIndex < GRID_FIELDS.length &&
        !isFieldAvailable(
          nextRow,
          GRID_FIELDS[nextFieldIndex]
        )
      ) {
        nextFieldIndex += fieldStep;
      }

      if (
        nextFieldIndex < 0 ||
        nextFieldIndex >= GRID_FIELDS.length
      ) {
        return;
      }
    }

    event.preventDefault();
    focusCell(
      rows[nextRowIndex].id,
      GRID_FIELDS[nextFieldIndex]
    );
  };

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

      let start = startHour * 60 + startMinute;
      let end = endHour * 60 + endMinute;

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
          alert(
            `Linha ${rows.indexOf(row) + 1}: selecione uma atividade ou parada.`
          );
          return;
        }

        if (!row.startTime || !row.endTime) {
          alert(
            `Linha ${rows.indexOf(row) + 1}: informe horário inicial e final.`
          );
          return;
        }

        if (
          !isValidTime(row.startTime) ||
          !isValidTime(row.endTime)
        ) {
          alert(
            `Linha ${rows.indexOf(row) + 1}: informe horários válidos no formato HH:MM.`
          );
          return;
        }

        const [sh, sm] = row.startTime.split(':').map(Number);
        const [eh, em] = row.endTime.split(':').map(Number);

        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;

        if (startMinutes === endMinutes) {
          alert(
            `Linha ${rows.indexOf(row) + 1}: horário inicial e final não podem ser iguais.`
          );
          return;
        }

        if (row.type === 'ATIVIDADE' && !row.local?.trim()) {
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
          alert(
            `Linha ${rows.indexOf(row) + 1}: quantidade inválida.`
          );
          return;
        }

        if (
          row.type === 'ATIVIDADE' &&
          row.producedQuantity > 10000
        ) {
          const confirmed = window.confirm(
            `Linha ${rows.indexOf(row) + 1}: foram informadas ${row.producedQuantity.toLocaleString('pt-BR')} peças.\n\n` +
              `Esse valor está acima do limite de conferência de 10.000 peças para uma única atividade.\n\n` +
              `Deseja continuar mesmo assim?`
          );

          if (!confirmed) {
            return;
          }
        }
      }

      let totalActivityMinutes = 0;

      for (const row of rows) {
        if (
          row.type !== 'ATIVIDADE' ||
          !row.startTime ||
          !row.endTime
        ) {
          continue;
        }

        const [sh, sm] = row.startTime.split(':').map(Number);
        const [eh, em] = row.endTime.split(':').map(Number);

        let startMinutes = sh * 60 + sm;
        let endMinutes = eh * 60 + em;

        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        totalActivityMinutes += endMinutes - startMinutes;
      }

      const minimumMinutes = 450;

      if (totalActivityMinutes < minimumMinutes) {
        const hours = Math.floor(totalActivityMinutes / 60);
        const minutes = totalActivityMinutes % 60;

        const confirmed = window.confirm(
          `A soma das atividades é ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}.\n\n` +
            `A jornada mínima esperada é 07:30.\n\n` +
            `Deseja continuar mesmo assim?`
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
        const current = activityRows[i];

        const [sh1, sm1] = current.startTime.split(':').map(Number);
        const [eh1, em1] = current.endTime.split(':').map(Number);

        let start1 = sh1 * 60 + sm1;
        let end1 = eh1 * 60 + em1;

        if (end1 < start1) {
          end1 += 24 * 60;
        }

        for (let j = i + 1; j < activityRows.length; j++) {
          const next = activityRows[j];

          const [sh2, sm2] = next.startTime.split(':').map(Number);
          const [eh2, em2] = next.endTime.split(':').map(Number);

          let start2 = sh2 * 60 + sm2;
          let end2 = eh2 * 60 + em2;

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
        const confirmed = window.confirm(
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

        const [sh, sm] = row.startTime.split(':').map(Number);
        const [eh, em] = row.endTime.split(':').map(Number);

        let startMinutes = sh * 60 + sm;
        let endMinutes = eh * 60 + em;

        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        const durationMinutes = endMinutes - startMinutes;

        if (durationMinutes > 720) {
          hasLongDuration = true;
          break;
        }
      }

      if (hasLongDuration) {
        alert(
          'Lançamento bloqueado: a duração de uma linha não pode ser superior a 12 horas. Verifique os horários de início e fim. Viradas de turno após 00:00 continuam permitidas quando a duração real permanece dentro de 12 horas.'
        );
        return;
      }

      onAddBatch(
        rows,
        productionDate,
        selectedCollaborator
      );

      setRows([createEmptyRow()]);
      setProductionDate('');
      setSelectedCollaborator('');

      alert('Lote lançado com sucesso.');
    } catch (error) {
      console.error('ERRO LOTE:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Produção em Lote
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Lance várias atividades e paradas para um colaborador por vez.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Horas Produção:
              <span className="font-bold ml-2 text-slate-800">
                {(calculateActivityHours() / 60).toFixed(2)}h
              </span>
            </div>

            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Linhas:
              <span className="font-bold ml-2 text-slate-800">
                {rows.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSubmitBatch}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm"
            >
              Lançar Lote Completo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data da Produção
            </label>

            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={productionDate}
              onChange={e => setProductionDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Colaborador
            </label>

            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedCollaborator}
              onChange={e => setSelectedCollaborator(e.target.value)}
            >
              <option value="">Selecione...</option>

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">
              Lançamentos
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Tab navega entre campos • Enter insere linha • Setas navegam na grade
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <Keyboard size={15} />
            Navegação rápida por teclado
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-auto max-h-[62vh] min-h-[280px]">
            <table className="w-full min-w-[1700px] text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                <tr>
                  <th className="text-left p-2 w-[125px] min-w-[125px] border-b border-slate-300">
                    Tipo
                  </th>

                  <th className="text-left p-2 w-[260px] min-w-[260px] border-b border-slate-300">
                    Código
                  </th>

                  <th className="text-left p-2 w-[120px] min-w-[120px] border-b border-slate-300">
                    Local
                  </th>

                  <th className="text-left p-2 w-[110px] min-w-[110px] border-b border-slate-300">
                    Lista
                  </th>

                  <th className="text-left p-2 w-[105px] min-w-[105px] border-b border-slate-300">
                    Início
                  </th>

                  <th className="text-left p-2 w-[105px] min-w-[105px] border-b border-slate-300">
                    Fim
                  </th>

                  <th className="text-left p-2 w-[155px] min-w-[155px] border-b border-slate-300">
                    Mov. Paleteira
                  </th>

                  <th className="text-left p-2 w-[165px] min-w-[165px] border-b border-slate-300">
                    Mov. Empilhadeira
                  </th>

                  <th className="text-left p-2 w-[105px] min-w-[105px] border-b border-slate-300">
                    Qtd. Pçs
                  </th>

                  <th className="text-left p-2 w-[105px] min-w-[105px] border-b border-slate-300">
                    Qtd. Itens
                  </th>

                  <th className="text-left p-2 w-[260px] min-w-[260px] border-b border-slate-300">
                    Observação
                  </th>

                  <th className="text-center p-2 w-[70px] min-w-[70px] border-b border-slate-300">
                    Remover
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => {
                  const isStoppage = row.type === 'PARADA';
                  const isActivityOne =
                    row.type === 'ATIVIDADE' &&
                    Number(row.code) === 1;

                  const registerRef = (
                    field: GridField
                  ) => (element: HTMLElement | null) => {
                    gridRefs.current[getGridKey(row.id, field)] = element;
                  };

                  const commonInputClass =
                    'border border-slate-300 rounded-md px-2 py-1.5 w-full min-w-0 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

                  const disabledInputClass =
                    'bg-slate-100 text-slate-400 cursor-not-allowed';

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70"
                    >
                      <td className="p-2 align-top">
                        <select
                          ref={registerRef('type')}
                          data-batch-row={rowIndex}
                          data-batch-col={0}
                          className={commonInputClass}
                          value={row.type}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'type',
                              e.target.value as 'ATIVIDADE' | 'PARADA'
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'type')
                          }
                        >
                          <option value="ATIVIDADE">Atividade</option>
                          <option value="PARADA">Parada</option>
                        </select>
                      </td>

                      <td className="p-2 align-top">
                        <select
                          ref={registerRef('code')}
                          data-batch-row={rowIndex}
                          data-batch-col={1}
                          className={commonInputClass}
                          value={row.code}
                          onChange={e =>
                            updateRow(row.id, 'code', e.target.value)
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'code')
                          }
                        >
                          <option value="">Selecione...</option>

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

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('local')}
                          data-batch-row={rowIndex}
                          data-batch-col={2}
                          className={`${commonInputClass} ${
                            isStoppage ? disabledInputClass : ''
                          }`}
                          value={row.local}
                          onChange={e =>
                            updateRow(row.id, 'local', e.target.value)
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'local')
                          }
                          disabled={isStoppage}
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('listId')}
                          data-batch-row={rowIndex}
                          data-batch-col={3}
                          className={`${commonInputClass} ${
                            !isActivityOne ? disabledInputClass : ''
                          }`}
                          value={row.listId}
                          onChange={e =>
                            updateRow(row.id, 'listId', e.target.value)
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'listId')
                          }
                          disabled={!isActivityOne}
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('startTime')}
                          data-batch-row={rowIndex}
                          data-batch-col={4}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={5}
                          placeholder="HH:MM"
                          aria-label={`Início da linha ${rowIndex + 1}`}
                          className={`${commonInputClass} font-mono`}
                          value={row.startTime}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'startTime',
                              formatTimeInput(e.target.value)
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'startTime')
                          }
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('endTime')}
                          data-batch-row={rowIndex}
                          data-batch-col={5}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={5}
                          placeholder="HH:MM"
                          aria-label={`Fim da linha ${rowIndex + 1}`}
                          className={`${commonInputClass} font-mono`}
                          value={row.endTime}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'endTime',
                              formatTimeInput(e.target.value)
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'endTime')
                          }
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('palletJackId')}
                          data-batch-row={rowIndex}
                          data-batch-col={6}
                          className={`${commonInputClass} ${
                            isStoppage ? disabledInputClass : ''
                          }`}
                          value={row.palletJackId}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'palletJackId',
                              e.target.value
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(
                              event,
                              rowIndex,
                              'palletJackId'
                            )
                          }
                          disabled={isStoppage}
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('forkliftId')}
                          data-batch-row={rowIndex}
                          data-batch-col={7}
                          className={`${commonInputClass} ${
                            isStoppage ? disabledInputClass : ''
                          }`}
                          value={row.forkliftId}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'forkliftId',
                              e.target.value
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(
                              event,
                              rowIndex,
                              'forkliftId'
                            )
                          }
                          disabled={isStoppage}
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('producedQuantity')}
                          data-batch-row={rowIndex}
                          data-batch-col={8}
                          type="number"
                          min={0}
                          className={`${commonInputClass} ${
                            isStoppage ? disabledInputClass : ''
                          }`}
                          value={row.producedQuantity}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'producedQuantity',
                              Number(e.target.value)
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(
                              event,
                              rowIndex,
                              'producedQuantity'
                            )
                          }
                          disabled={isStoppage}
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('itemsQuantity')}
                          data-batch-row={rowIndex}
                          data-batch-col={9}
                          type="number"
                          min={0}
                          className={`${commonInputClass} ${
                            isStoppage ? disabledInputClass : ''
                          }`}
                          value={row.itemsQuantity}
                          onChange={e =>
                            updateRow(
                              row.id,
                              'itemsQuantity',
                              Number(e.target.value)
                            )
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(
                              event,
                              rowIndex,
                              'itemsQuantity'
                            )
                          }
                          disabled={isStoppage}
                        />
                      </td>

                      <td className="p-2 align-top">
                        <input
                          ref={registerRef('notes')}
                          data-batch-row={rowIndex}
                          data-batch-col={10}
                          className={commonInputClass}
                          value={row.notes}
                          onChange={e =>
                            updateRow(row.id, 'notes', e.target.value)
                          }
                          onKeyDown={event =>
                            handleGridKeyDown(event, rowIndex, 'notes')
                          }
                        />
                      </td>

                      <td className="p-2 align-top text-center">
                        <button
                          type="button"
                          title="Remover linha"
                          aria-label={`Remover linha ${rowIndex + 1}`}
                          onClick={() => removeRow(row.id)}
                          className="inline-flex items-center justify-center p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3 bg-slate-50 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              A grade mantém o cabeçalho visível durante a rolagem.
            </div>

            <button
              type="button"
              onClick={() => addRow()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={17} />
              Inserir Linha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
