import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, Edit3, FileSpreadsheet, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { createXlsxBlob, readFirstSheetXlsx } from '../xlsxUtils';
import {
  MobilePlanningCollaborator,
  MobileShiftPlan,
  mobileAdminDeactivateShiftPlan,
  mobileAdminImportShiftPlans,
  mobileAdminListShiftPlans,
  mobileAdminSaveShiftPlan
} from '../mobileSupabase';

interface Props {
  compact?: boolean;
}

interface FormState {
  id?: string;
  collaboratorId: string;
  date: string;
  start: string;
  end: string;
  notes: string;
}

interface ImportRow {
  collaborator_id: string;
  planned_start_at: string;
  planned_end_at: string;
  notes?: string;
}

const SAO_PAULO_OFFSET = '-03:00';

function dateInputToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(value: string, days: number) {
  const d = new Date(`${value}T12:00:00${SAO_PAULO_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function localDateTime(date: string, time: string) {
  return `${date}T${time}:00${SAO_PAULO_OFFSET}`;
}

function formatPlan(plan: MobileShiftPlan) {
  const start = new Date(plan.planned_start_at);
  const end = new Date(plan.planned_end_at);
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(start);
  const timeParts = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(value);
    const hour = parts.find(part => part.type === 'hour')?.value || '00';
    const minute = parts.find(part => part.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  };
  return {
    date,
    start: timeParts(start),
    end: timeParts(end)
  };
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeExcelDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const serial = Number(trimmed);
  if (Number.isFinite(serial) && serial > 20000 && serial < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return date.toISOString().slice(0, 10);
  }

  return trimmed;
}

function normalizeExcelTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const serial = Number(trimmed);
  if (Number.isFinite(serial) && serial >= 0 && serial < 1) {
    const totalMinutes = Math.round(serial * 24 * 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }

  return trimmed;
}

function parseExcelRows(rows: string[][]) {
  if (rows.length < 2) throw new Error('O arquivo Excel não possui linhas de dados.');

  const headers = rows[0].map(normalizeHeader);
  const find = (...names: string[]) => {
    const index = names.map(normalizeHeader).map(name => headers.indexOf(name)).find(index => index >= 0);
    return index ?? -1;
  };

  const dateIndex = find('data');
  const collaboratorIndex = find('colaborador');
  const startIndex = find('hora inicio');
  const endIndex = find('hora fim');
  const notesIndex = find('observacao');
  const typeIndex = find('tipo', 'situacao');

  if (dateIndex < 0 || collaboratorIndex < 0) {
    throw new Error('Cabeçalho inválido. Use o modelo Excel fornecido pelo sistema.');
  }

  return rows.slice(1)
    .map((values, index) => {
      const get = (column: number) => column >= 0 ? String(values[column] || '').trim() : '';
      const date = normalizeExcelDate(get(dateIndex));
      const collaborator = get(collaboratorIndex);
      const start = normalizeExcelTime(get(startIndex));
      const end = normalizeExcelTime(get(endIndex));
      const notes = get(notesIndex);
      const type = get(typeIndex).toUpperCase();

      if (!date && !collaborator && !start && !end && !notes && !type) return null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Linha ${index + 2}: data deve estar em AAAA-MM-DD.`);
      }

      if (type === 'FOLGA' || type === 'FERIAS' || type === 'FÉRIAS') {
        if (start || end) {
          throw new Error(`Linha ${index + 2}: folga/férias não deve ter horário. Se houver horário, o horário prevalece.`);
        }
        return { date, collaborator, start: '', end: '', notes, type };
      }

      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        throw new Error(`Linha ${index + 2}: para TRABALHO, informe início e fim em HH:MM.`);
      }

      return { date, collaborator, start, end, notes, type: type || 'TRABALHO' };
    })
    .filter((row): row is { date: string; collaborator: string; start: string; end: string; notes: string; type: string } => row !== null);
}

function toImportRow(
  row: { date: string; collaborator: string; start: string; end: string; notes: string; type: string },
  collaborators: MobilePlanningCollaborator[]
): ImportRow | null {
  if (row.type === 'FOLGA' || row.type === 'FERIAS' || row.type === 'FÉRIAS') return null;

  const collaboratorMatch = collaborators.find(
    item => item.name.trim().toLocaleLowerCase() === row.collaborator.trim().toLocaleLowerCase()
  );
  if (!collaboratorMatch) {
    throw new Error(`Colaborador não encontrado ou inativo: ${row.collaborator}`);
  }

  let endDate = row.date;
  if (row.end <= row.start) endDate = addDays(row.date, 1);

  return {
    collaborator_id: collaboratorMatch.id,
    planned_start_at: localDateTime(row.date, row.start),
    planned_end_at: localDateTime(endDate, row.end),
    notes: row.notes
  };
}

function initialForm(): FormState {
  const today = dateInputToday();
  return {
    collaboratorId: '',
    date: today,
    start: '06:00',
    end: '14:00',
    notes: ''
  };
}

export default function ShiftPlanning({ compact = false }: Props) {
  const [startDate, setStartDate] = useState(dateInputToday());
  const [endDate, setEndDate] = useState(() => addDays(dateInputToday(), compact ? 6 : 30));
  const [collaboratorFilter, setCollaboratorFilter] = useState('');
  const [plans, setPlans] = useState<MobileShiftPlan[]>([]);
  const [collaborators, setCollaborators] = useState<MobilePlanningCollaborator[]>([]);
  const [form, setForm] = useState<FormState>(initialForm());
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await mobileAdminListShiftPlans(
        startDate,
        endDate,
        collaboratorFilter || undefined
      );
      setPlans(result.plans);
      setCollaborators(result.collaborators);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o planejamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [startDate, endDate, collaboratorFilter]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(a.planned_start_at).getTime() - new Date(b.planned_start_at).getTime()),
    [plans]
  );

  const openNew = () => {
    setForm({ ...initialForm(), collaboratorId: collaborators[0]?.id || '' });
    setError('');
    setNotice('');
    setModalOpen(true);
  };

  const openEdit = (plan: MobileShiftPlan) => {
    const start = new Date(plan.planned_start_at);
    const end = new Date(plan.planned_end_at);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(start);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    const time = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(d);
      return `${parts.find(part => part.type === 'hour')?.value || '00'}:${parts.find(part => part.type === 'minute')?.value || '00'}`;
    };
    setForm({
      id: plan.id,
      collaboratorId: plan.collaborator_id,
      date,
      start: time(start),
      end: time(end),
      notes: plan.notes || ''
    });
    setError('');
    setNotice('');
    setModalOpen(true);
  };

  const save = async () => {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      if (!form.collaboratorId || !form.date || !form.start || !form.end) {
        throw new Error('Preencha colaborador, data, início e fim.');
      }
      let endDate = form.date;
      if (form.end <= form.start) endDate = addDays(form.date, 1);

      await mobileAdminSaveShiftPlan({
        id: form.id,
        collaboratorId: form.collaboratorId,
        plannedStartAt: localDateTime(form.date, form.start),
        plannedEndAt: localDateTime(endDate, form.end),
        notes: form.notes
      });
      setModalOpen(false);
      setNotice(form.id ? 'Escala atualizada.' : 'Escala adicionada.');
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a escala.');
    } finally {
      setWorking(false);
    }
  };

  const remove = async (plan: MobileShiftPlan) => {
    if (!window.confirm('Remover esta escala do planejamento? O registro será mantido como inativo.')) return;
    setWorking(true);
    setError('');
    try {
      await mobileAdminDeactivateShiftPlan(plan.id);
      setNotice('Escala removida do planejamento.');
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível remover a escala.');
    } finally {
      setWorking(false);
    }
  };

  const exportExcel = () => {
    const collaboratorMap = new Map(collaborators.map(item => [item.id, item.name]));
    const rows = sortedPlans.map(plan => {
      const formatted = formatPlan(plan);
      const isoDate = new Date(plan.planned_start_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      return [
        isoDate,
        collaboratorMap.get(plan.collaborator_id) || plan.collaborator_id,
        formatted.start,
        formatted.end,
        'TRABALHO',
        plan.notes || ''
      ];
    });

    const blob = createXlsxBlob([
      {
        name: 'Escala',
        rows: [
          ['Data', 'Colaborador', 'Hora Início', 'Hora Fim', 'Tipo', 'Observação'],
          ...rows
        ].map(row => row.map(value => ({ value: String(value ?? '') })))
      },
      {
        name: 'Instruções',
        rows: [
          ['COMO PREENCHER A ESCALA'],
          ['TRABALHO', 'Informe Data, Colaborador, Hora Início e Hora Fim.'],
          ['FOLGA', 'Informe Data, Colaborador e Tipo = FOLGA. Não informe horários. Esta linha é apenas informativa e não cria turno.'],
          ['FÉRIAS', 'Informe Data, Colaborador e Tipo = FÉRIAS. Não informe horários. Esta linha é apenas informativa e não cria turno.'],
          ['REGRA', 'Se uma linha tiver horário, o horário prevalece. Não use FOLGA/FÉRIAS com horários.'],
          ['VIRADA', 'Se Hora Fim for menor ou igual à Hora Início, o sistema considera término no dia seguinte.'],
          ['OBSERVAÇÃO', 'Use este campo para detalhes administrativos. Não substitua um horário por texto como folga ou férias.']
        ].map(row => row.map(value => ({ value: String(value ?? '') })))
      }
    ]);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `escala_${startDate}_${endDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setWorking(true);
    setError('');
    setNotice('');
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        throw new Error('Use o arquivo Excel .xlsx gerado pelo botão MODELO ou EXPORTAR.');
      }

      const rows = await readFirstSheetXlsx(file);
      const parsed = parseExcelRows(rows);
      if (parsed.length > 500) throw new Error('Importação limitada a 500 linhas por operação.');

      const informationalRows = parsed.filter(row => row.type === 'FOLGA' || row.type === 'FERIAS' || row.type === 'FÉRIAS');
      const workRows = parsed
        .map(row => toImportRow(row, collaborators))
        .filter((row): row is ImportRow => row !== null);

      if (workRows.length === 0) {
        throw new Error('Nenhuma escala de TRABALHO foi encontrada. FOLGA/FÉRIAS são apenas informativas no modelo.');
      }

      const keys = new Set<string>();
      for (const row of workRows) {
        const key = `${row.collaborator_id}|${row.planned_start_at}|${row.planned_end_at}`;
        if (keys.has(key)) throw new Error('O arquivo contém uma escala duplicada.');
        keys.add(key);
      }

      for (let i = 0; i < workRows.length; i += 1) {
        for (let j = i + 1; j < workRows.length; j += 1) {
          if (
            workRows[i].collaborator_id === workRows[j].collaborator_id &&
            workRows[i].planned_start_at < workRows[j].planned_end_at &&
            workRows[i].planned_end_at > workRows[j].planned_start_at
          ) {
            throw new Error('O arquivo contém escalas sobrepostas para o mesmo colaborador.');
          }
        }
      }

      const existing = plans.filter(plan => plan.active);
      for (const row of workRows) {
        if (existing.some(plan =>
          plan.collaborator_id === row.collaborator_id &&
          plan.planned_start_at < row.planned_end_at &&
          plan.planned_end_at > row.planned_start_at
        )) {
          throw new Error('O arquivo contém uma escala que sobrepõe uma escala já cadastrada.');
        }
      }

      setImportPreview(workRows);

      if (informationalRows.length > 0) {
        setNotice(`${informationalRows.length} linha(s) de FOLGA/FÉRIAS foram reconhecidas como informativas e não serão gravadas como turno.`);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível preparar a importação Excel.');
    } finally {
      setWorking(false);
    }
  };

  const confirmImport = async () => {
    if (!importPreview?.length) return;
    setWorking(true);
    setError('');
    try {
      const result = await mobileAdminImportShiftPlans(importPreview);
      setImportPreview(null);
      setNotice(`${result.inserted} escala(s) importada(s) com sucesso.`);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar a importação.');
    } finally {
      setWorking(false);
    }
  };

  const downloadTemplate = () => {
    const blob = createXlsxBlob([
      {
        name: 'Escala',
        rows: [
          ['Data', 'Colaborador', 'Hora Início', 'Hora Fim', 'Tipo', 'Observação'],
          ['2026-10-05', 'Luis', '22:00', '06:00', 'TRABALHO', 'Escala exemplo'],
          ['2026-10-06', 'Luis', '', '', 'FOLGA', 'Folga semanal'],
          ['2026-10-07', 'Luis', '', '', 'FÉRIAS', 'Férias']
        ].map(row => row.map(value => ({ value: String(value ?? '') })))
      },
      {
        name: 'Instruções',
        rows: [
          ['TIPO', 'COMO PREENCHER'],
          ['TRABALHO', 'Preencha Data, Colaborador, Hora Início e Hora Fim.'],
          ['FOLGA', 'Preencha Data, Colaborador e Tipo = FOLGA. Deixe horários vazios.'],
          ['FÉRIAS', 'Preencha Data, Colaborador e Tipo = FÉRIAS. Deixe horários vazios.'],
          ['ATENÇÃO', 'FOLGA/FÉRIAS são informativas e não criam turno no banco.'],
          ['REGRA', 'Se houver horário, o horário prevalece. Não use observação para substituir horário.'],
          ['VIRADA', 'Fim menor ou igual ao início = término no dia seguinte.']
        ].map(row => row.map(value => ({ value: String(value ?? '') })))
      }
    ]);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_escala_mobile.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-bold">Planejamento</div>
          <h2 className="text-xl font-bold">Escalas</h2>
          <p className="text-xs text-slate-500 mt-1">
            {compact ? 'Ajuste individual da escala.' : 'Carga semanal/mensal com validação antes da gravação.'}
          </p>
        </div>
        <button type="button" onClick={openNew} className="mobile-primary px-4">
          <Plus className="w-4 h-4" /> ADICIONAR
        </button>
      </div>

      <div className={`rounded-2xl border ${compact ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} p-4`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="space-y-1 text-xs">
            <span className={compact ? 'text-slate-500' : 'text-slate-500'}>De</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm'} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">Até</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm'} />
          </label>
          <label className="space-y-1 text-xs md:col-span-2">
            <span className="text-slate-500">Colaborador</span>
            <select value={collaboratorFilter} onChange={e => setCollaboratorFilter(e.target.value)} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm'}>
              <option value="">Todos</option>
              {collaborators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" onClick={exportExcel} disabled={loading || working} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> EXPORTAR EXCEL
            </button>
            <label className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> IMPORTAR EXCEL
              <input type="file" accept=".csv,text/csv" onChange={importExcel} className="hidden" />
            </label>
            <button type="button" onClick={downloadTemplate} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold">
              MODELO
            </button>
            <button type="button" onClick={load} disabled={loading} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> ATUALIZAR
            </button>
          </div>
        )}
      </div>

      {(error || notice) && (
        <div className={`rounded-xl p-3 text-sm border ${error ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {error || notice}
        </div>
      )}

      <div className={`rounded-2xl border overflow-hidden ${compact ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Carregando escala...</div>
        ) : sortedPlans.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Nenhuma escala encontrada no período.</div>
        ) : compact ? (
          <div className="max-h-[58vh] overflow-y-auto divide-y divide-slate-800">
            {sortedPlans.map(plan => {
              const formatted = formatPlan(plan);
              const name = collaborators.find(c => c.id === plan.collaborator_id)?.name || plan.collaborator_id;
              return (
                <div key={plan.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500">{formatted.date}</div>
                      <div className="font-bold text-white mt-1 truncate">{name}</div>
                      <div className="font-mono text-sm text-blue-300 mt-1">{formatted.start} → {formatted.end}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => openEdit(plan)} className="p-2.5 rounded-xl border border-slate-700 text-slate-300" title="Editar">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => remove(plan)} className="p-2.5 rounded-xl border border-rose-500/30 text-rose-300" title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {plan.notes && <div className="mt-3 text-xs text-slate-500">{plan.notes}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-h-[58vh] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 shadow-sm">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Horário</th>
                  <th className="px-4 py-3">Observação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedPlans.map(plan => {
                  const formatted = formatPlan(plan);
                  const name = collaborators.find(c => c.id === plan.collaborator_id)?.name || plan.collaborator_id;
                  return (
                    <tr key={plan.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap">{formatted.date}</td>
                      <td className="px-4 py-3 font-semibold">{name}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{formatted.start} → {formatted.end}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[28rem] truncate">{plan.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openEdit(plan)} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100" title="Editar">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => remove(plan)} className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {importPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 flex items-end md:items-center justify-center">
          <div className={`w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border p-5 ${compact ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Pré-visualização</div>
                <h3 className="text-lg font-bold">Confirmar importação</h3>
                <p className="text-xs text-slate-500 mt-1">{importPreview.length} escala(s) prontas para gravação.</p>
              </div>
              <button type="button" onClick={() => setImportPreview(null)} className="p-2 rounded-xl border border-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs">
                <thead className={compact ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-500'}>
                  <tr>
                    <th className="px-3 py-2 text-left">Colaborador</th>
                    <th className="px-3 py-2 text-left">Início</th>
                    <th className="px-3 py-2 text-left">Fim</th>
                    <th className="px-3 py-2 text-left">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {importPreview.slice(0, 100).map((row, index) => {
                    const name = collaborators.find(c => c.id === row.collaborator_id)?.name || row.collaborator_id;
                    return (
                      <tr key={`${row.collaborator_id}-${row.planned_start_at}-${index}`}>
                        <td className="px-3 py-2 font-semibold">{name}</td>
                        <td className="px-3 py-2 font-mono">{new Date(row.planned_start_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                        <td className="px-3 py-2 font-mono">{new Date(row.planned_end_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                        <td className="px-3 py-2 text-slate-500">{row.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {importPreview.length > 100 && <div className="text-xs text-slate-500 mt-2">Mostrando as primeiras 100 linhas. A gravação será feita para todas as {importPreview.length} linhas.</div>}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setImportPreview(null)} className="mobile-secondary flex-1">CANCELAR</button>
              <button type="button" onClick={confirmImport} disabled={working} className="mobile-primary flex-1">{working ? 'GRAVANDO...' : 'CONFIRMAR E GRAVAR'}</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 flex items-end md:items-center justify-center">
          <div className={`w-full max-w-lg rounded-3xl border p-5 ${compact ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Escala</div>
                <h3 className="text-lg font-bold">{form.id ? 'Editar escala' : 'Adicionar escala'}</h3>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-xl border border-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <label className="col-span-2 space-y-1 text-xs">
                <span className="text-slate-500">Colaborador</span>
                <select value={form.collaboratorId} onChange={e => setForm(v => ({ ...v, collaboratorId: e.target.value }))} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2'}>
                  <option value="">Selecione</option>
                  {collaborators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Data</span>
                <input type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2'} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Início</span>
                <input type="time" value={form.start} onChange={e => setForm(v => ({ ...v, start: e.target.value }))} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2'} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Fim</span>
                <input type="time" value={form.end} onChange={e => setForm(v => ({ ...v, end: e.target.value }))} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2'} />
              </label>
              <label className="col-span-2 space-y-1 text-xs">
                <span className="text-slate-500">Observação</span>
                <textarea value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} rows={3} className={compact ? 'mobile-input' : 'w-full border border-slate-200 rounded-lg px-3 py-2'} />
              </label>
            </div>

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setModalOpen(false)} className="mobile-secondary flex-1">CANCELAR</button>
              <button type="button" onClick={save} disabled={working} className="mobile-primary flex-1">{working ? 'SALVANDO...' : 'SALVAR'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
