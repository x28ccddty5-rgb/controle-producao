import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Pencil,
  PowerOff,
  Search,
  X
} from 'lucide-react';
import {
  dbAdminCorrectActivityHistory,
  dbAdminCorrectStoppageHistory,
  dbFetchActivityHistoryPage,
  dbFetchStoppageHistoryPage,
  HistoryPageResult
} from '../supabase';
import { Activity, Stoppage } from '../types';

interface HistoryLogsProps {
  onDeleteActivity?: (id: string) => void;
  onEditActivity?: (activity: Activity) => void;
  onDeleteStoppage?: (id: string) => void;
  onEditStoppage?: (stoppage: Stoppage) => void;
  isAdmin?: boolean;
  collaborators?: string[];
}

type SheetTab = 'ACTIVITIES' | 'STOPPAGES';

const PAGE_SIZE = 20;

const ACTIVITY_OPTIONS = [
  [1, '1 - Separação'],
  [2, '2 - Armazenamento'],
  [3, '3 - Remontar Picadeiras'],
  [4, '4 - Trocar Strechs dos Pallets'],
  [5, '5 - Movimentação'],
  [6, '6 - Atualizar Etiquetas'],
  [7, '7 - Endereçamento'],
  [8, '8 - Empilhamento'],
  [9, '9 - Liberando peças do Forno'],
  [10, '10 - Inventário Rotativo'],
  [11, '11 - Outros']
] as const;

const STOPPAGE_OPTIONS = [
  [1, '1 - Banheiro/Água'],
  [2, '2 - Trabalhando em outro setor'],
  [3, '3 - Treinamento'],
  [4, '4 - Reunião'],
  [5, '5 - Limpeza do setor'],
  [6, '6 - Auxiliando externo'],
  [7, '7 - Inventário Pontual'],
  [8, '8 - Equipamento instável'],
  [9, '9 - Procurando Pallet'],
  [10, '10 - Checklist'],
  [11, '11 - Descarte quebra'],
  [12, '12 - Auditoria'],
  [13, '13 - Outros']
] as const;

function getTodayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date: string): string {
  if (!date) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;

  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  return date;
}

function formatDateForFilename(date: string): string {
  return date.replace(/-/g, '');
}

function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function fetchAllActivities(
  startDate: string,
  endDate: string,
  operator: string,
  code?: number
): Promise<Activity[]> {
  const result: Activity[] = [];
  let offset = 0;

  while (true) {
    const page = await dbFetchActivityHistoryPage({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      operator,
      code,
      limit: 1000,
      offset
    });

    if (!page) throw new Error('Não foi possível consultar o histórico de atividades.');

    result.push(...page.items);
    if (page.items.length < 1000) break;

    offset += page.items.length;
  }

  return result;
}

async function fetchAllStoppages(
  startDate: string,
  endDate: string,
  operator: string,
  code?: number
): Promise<Stoppage[]> {
  const result: Stoppage[] = [];
  let offset = 0;

  while (true) {
    const page = await dbFetchStoppageHistoryPage({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      operator,
      code,
      limit: 1000,
      offset
    });

    if (!page) throw new Error('Não foi possível consultar o histórico de paradas.');

    result.push(...page.items);
    if (page.items.length < 1000) break;

    offset += page.items.length;
  }

  return result;
}

export default function HistoryLogs({
  onDeleteActivity,
  onEditActivity,
  onDeleteStoppage,
  onEditStoppage,
  isAdmin,
  collaborators = []
}: HistoryLogsProps) {
  const [activeSheetTab, setActiveSheetTab] = useState<SheetTab>('ACTIVITIES');
  const [startDate, setStartDate] = useState(getTodayIsoDate);
  const [endDate, setEndDate] = useState(getTodayIsoDate);
  const [operatorFilter, setOperatorFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [activitiesPage, setActivitiesPage] = useState<HistoryPageResult<Activity>>({ items: [], totalCount: 0 });
  const [stoppagesPage, setStoppagesPage] = useState<HistoryPageResult<Stoppage>>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingStoppage, setEditingStoppage] = useState<Stoppage | null>(null);

  const selectedCode = codeFilter === 'ALL' ? undefined : Number(codeFilter);
  const currentItems = activeSheetTab === 'ACTIVITIES' ? activitiesPage.items : stoppagesPage.items;
  const totalCount = activeSheetTab === 'ACTIVITIES' ? activitiesPage.totalCount : stoppagesPage.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const codeOptions = useMemo(
    () => activeSheetTab === 'ACTIVITIES' ? ACTIVITY_OPTIONS : STOPPAGE_OPTIONS,
    [activeSheetTab]
  );

  const sortedCollaborators = useMemo(
    () => [...collaborators].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [collaborators]
  );

  const validatePeriod = () => {
    if (!startDate || !endDate) {
      setError('Informe a data inicial e a data final.');
      return false;
    }

    if (startDate > endDate) {
      setError('A data inicial não pode ser maior que a data final.');
      return false;
    }

    return true;
  };

  const queryHistory = async (requestedPage = page) => {
    if (!validatePeriod()) return;

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const offset = requestedPage * PAGE_SIZE;

      if (activeSheetTab === 'ACTIVITIES') {
        const result = await dbFetchActivityHistoryPage({
          startDate,
          endDate,
          operator: operatorFilter,
          code: selectedCode,
          limit: PAGE_SIZE,
          offset
        });

        if (!result) throw new Error('Não foi possível consultar o histórico de atividades.');
        setActivitiesPage(result);
      } else {
        const result = await dbFetchStoppageHistoryPage({
          startDate,
          endDate,
          operator: operatorFilter,
          code: selectedCode,
          limit: PAGE_SIZE,
          offset
        });

        if (!result) throw new Error('Não foi possível consultar o histórico de paradas.');
        setStoppagesPage(result);
      }

      setPage(requestedPage);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao consultar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void queryHistory(0);
    // A consulta automática acontece somente na troca de aba.
    // Filtros são aplicados pelo botão Consultar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetTab]);

  const handleToday = () => {
    const today = getTodayIsoDate();
    setStartDate(today);
    setEndDate(today);
    setPage(0);
  };

  const handleTabChange = (tab: SheetTab) => {
    setActiveSheetTab(tab);
    setCodeFilter('ALL');
    setPage(0);
  };

  const handleExport = async () => {
    if (!validatePeriod()) return;

    setExporting(true);
    setError('');
    try {
      if (activeSheetTab === 'ACTIVITIES') {
        const rows = await fetchAllActivities(startDate, endDate, operatorFilter, selectedCode);
        if (!rows.length) {
          setError('Nenhuma atividade encontrada para exportação.');
          return;
        }

        const headers = ['ID', 'Data', 'Colaborador', 'Código Atividade', 'Local', 'Lista', 'Inicial', 'Final', 'Duração', 'Mov. Paleteira', 'Mov. Empilhadeira', 'Qtd Peças', 'Qtd de Itens', 'Observação', 'Quem fez o lançamento', 'Data de lançamento'];
        const csv = [headers.join(';'), ...rows.map(act => [
          act.id, act.date, act.operator, act.activityCode, act.local, act.listId, act.startTime, act.endTime || '',
          act.duration, act.palletJackId || '', act.forkliftId || '', act.producedQuantity, act.itemsQuantity,
          act.notes || '', act.creator, act.createdAt
        ].map(escapeCsv).join(';'))].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `historico_atividades_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        const rows = await fetchAllStoppages(startDate, endDate, operatorFilter, selectedCode);
        if (!rows.length) {
          setError('Nenhuma parada encontrada para exportação.');
          return;
        }

        const headers = ['ID', 'Data', 'Colaborador', 'Nº Parada', 'Inicial', 'Final', 'Duração', 'Observação', 'Quem fez o lançamento', 'Data de lançamento'];
        const csv = [headers.join(';'), ...rows.map(stop => [
          stop.id, stop.date, stop.operator, stop.stoppageCode, stop.startTime, stop.endTime || '',
          stop.duration, stop.notes || '', stop.creator, stop.createdAt
        ].map(escapeCsv).join(';'))].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `historico_paradas_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível exportar o histórico.');
    } finally {
      setExporting(false);
    }
  };

  const saveActivity = async () => {
    if (!editingActivity) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await dbAdminCorrectActivityHistory(editingActivity.id, {
        local: editingActivity.local,
        list_id: editingActivity.listId,
        pallet_jack_id: editingActivity.palletJackId,
        forklift_id: editingActivity.forkliftId,
        produced_quantity: editingActivity.producedQuantity,
        items_quantity: editingActivity.itemsQuantity,
        notes: editingActivity.notes
      });

      if (!updated) throw new Error('O banco não confirmou a correção.');
      setActivitiesPage(current => ({
        ...current,
        items: current.items.map(item => item.id === updated.id ? updated : item)
      }));
      setNotice('Correção de atividade salva com auditoria.');
      setEditingActivity(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a correção.');
    } finally {
      setSaving(false);
    }
  };

  const saveStoppage = async () => {
    if (!editingStoppage) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await dbAdminCorrectStoppageHistory(editingStoppage.id, {
        notes: editingStoppage.notes,
        resolution_notes: editingStoppage.resolutionNotes
      });

      if (!updated) throw new Error('O banco não confirmou a correção.');
      setStoppagesPage(current => ({
        ...current,
        items: current.items.map(item => item.id === updated.id ? updated : item)
      }));
      setNotice('Correção de parada salva com auditoria.');
      setEditingStoppage(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a correção.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" id="history-sheets-view">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-800">Histórico de Movimentações</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Consulta paginada. A tabela permanece limitada à área da tela, mesmo com milhares de registros.
            </p>
          </div>
          <button
            onClick={() => void handleExport()}
            disabled={exporting || loading}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando...' : 'Exportar resultado'}
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                De
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </label>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Até
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </label>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Colaborador
                <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className="mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Todos</option>
                  {sortedCollaborators.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {activeSheetTab === 'ACTIVITIES' ? 'Atividade' : 'Motivo da parada'}
                <select value={codeFilter} onChange={e => setCodeFilter(e.target.value)} className="mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="ALL">Todos</option>
                  {codeOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button onClick={handleToday} className="h-10 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs">
                  Hoje
                </button>
                <button onClick={() => void queryHistory(0)} disabled={loading} className="h-10 flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" />
                  Consultar
                </button>
              </div>
            </div>
          </div>

          {(error || notice) && (
            <div className={`mt-3 rounded-lg px-4 py-3 text-xs font-semibold border ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              {error || notice}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1">
          <button onClick={() => handleTabChange('ACTIVITIES')} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeSheetTab === 'ACTIVITIES' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}>
            <Layers className="w-4 h-4" /> Atividades
          </button>
          <button onClick={() => handleTabChange('STOPPAGES')} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeSheetTab === 'STOPPAGES' ? 'bg-rose-50 text-rose-700' : 'text-slate-500'}`}>
            <PowerOff className="w-4 h-4" /> Paradas
          </button>
        </div>
        <span className="text-xs text-slate-500">{totalCount.toLocaleString('pt-BR')} registros</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-[46vh] min-h-[320px] flex items-center justify-center text-sm text-slate-400">
            Consultando o período no banco...
          </div>
        ) : currentItems.length === 0 ? (
          <div className="h-[46vh] min-h-[320px] flex items-center justify-center text-sm text-slate-400">
            Nenhum registro encontrado para os filtros.
          </div>
        ) : activeSheetTab === 'ACTIVITIES' ? (
          <div className="max-h-[52vh] overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center">Data</th>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3 text-center">Cód.</th>
                  <th className="py-3 px-3">Local</th>
                  <th className="py-3 px-3">Lista</th>
                  <th className="py-3 px-3 text-center">Início</th>
                  <th className="py-3 px-3 text-center">Fim</th>
                  <th className="py-3 px-3 text-center">Duração</th>
                  <th className="py-3 px-3 text-right">Pçs</th>
                  <th className="py-3 px-3 text-right">Itens</th>
                  {isAdmin && <th className="py-3 px-3 text-center">Corrigir</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activitiesPage.items.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-center whitespace-nowrap font-mono">{formatDateForDisplay(act.date)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">{act.operator}</td>
                    <td className="py-3 px-3 text-center font-mono">{act.activityCode}</td>
                    <td className="py-3 px-3 max-w-[13rem] truncate" title={act.local}>{act.local || '-'}</td>
                    <td className="py-3 px-3 max-w-[10rem] truncate" title={act.listId}>{act.listId || '-'}</td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap">{act.startTime}</td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap">{act.endTime || '-'}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{act.duration}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">{act.producedQuantity.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold">{act.itemsQuantity.toLocaleString('pt-BR')}</td>
                    {isAdmin && (
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => setEditingActivity({ ...act })} className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50" title="Corrigir lançamento">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center">Data</th>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3 text-center">Nº</th>
                  <th className="py-3 px-3 text-center">Início</th>
                  <th className="py-3 px-3 text-center">Fim</th>
                  <th className="py-3 px-3 text-center">Duração</th>
                  <th className="py-3 px-3">Observação</th>
                  {isAdmin && <th className="py-3 px-3 text-center">Corrigir</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stoppagesPage.items.map(stop => (
                  <tr key={stop.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-center whitespace-nowrap font-mono">{formatDateForDisplay(stop.date)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">{stop.operator}</td>
                    <td className="py-3 px-3 text-center font-mono">{stop.stoppageCode}</td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap">{stop.startTime}</td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap">{stop.endTime || '-'}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{stop.duration}</td>
                    <td className="py-3 px-3 max-w-[24rem] truncate" title={stop.notes || ''}>{stop.notes || '-'}</td>
                    {isAdmin && (
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => setEditingStoppage({ ...stop })} className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50" title="Corrigir lançamento">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500">Página {page + 1} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => void queryHistory(page - 1)} disabled={page === 0 || loading} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => void queryHistory(page + 1)} disabled={page + 1 >= totalPages || loading} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-2">
        <Filter className="w-3.5 h-3.5" />
        <Calendar className="w-3.5 h-3.5" />
        Consulta paginada diretamente no Supabase.
        {isAdmin ? ' Correções ficam registradas em auditoria.' : ' O acesso está restrito aos seus próprios registros.'}
      </div>

      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">Correção pontual</div>
                <h3 className="text-lg font-bold text-slate-900">Atividade {editingActivity.activityCode} • {editingActivity.operator}</h3>
                <p className="text-xs text-slate-500 mt-1">O registro original permanece identificado e a alteração gera auditoria.</p>
              </div>
              <button onClick={() => setEditingActivity(null)} className="p-2 rounded-lg border border-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-500 col-span-2">Local<input value={editingActivity.local} onChange={e => setEditingActivity(v => v ? { ...v, local: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-500">Lista<input value={editingActivity.listId || ''} onChange={e => setEditingActivity(v => v ? { ...v, listId: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-500">Peças<input type="number" min={0} value={editingActivity.producedQuantity} onChange={e => setEditingActivity(v => v ? { ...v, producedQuantity: Number(e.target.value) } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" /></label>
              <label className="text-xs font-semibold text-slate-500">Itens<input type="number" min={0} value={editingActivity.itemsQuantity} onChange={e => setEditingActivity(v => v ? { ...v, itemsQuantity: Number(e.target.value) } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" /></label>
              <label className="text-xs font-semibold text-slate-500">Paleteira<input value={editingActivity.palletJackId || ''} onChange={e => setEditingActivity(v => v ? { ...v, palletJackId: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-500">Empilhadeira<input value={editingActivity.forkliftId || ''} onChange={e => setEditingActivity(v => v ? { ...v, forkliftId: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-500 col-span-2">Observação<textarea rows={3} value={editingActivity.notes || ''} onChange={e => setEditingActivity(v => v ? { ...v, notes: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setEditingActivity(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm">Cancelar</button>
              <button onClick={() => void saveActivity()} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center gap-2"><Check className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar correção'}</button>
            </div>
          </div>
        </div>
      )}

      {editingStoppage && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-rose-600 font-bold">Correção pontual</div>
                <h3 className="text-lg font-bold text-slate-900">Parada {editingStoppage.stoppageCode} • {editingStoppage.operator}</h3>
              </div>
              <button onClick={() => setEditingStoppage(null)} className="p-2 rounded-lg border border-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <label className="text-xs font-semibold text-slate-500">Observação<textarea rows={3} value={editingStoppage.notes || ''} onChange={e => setEditingStoppage(v => v ? { ...v, notes: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold text-slate-500">Retomada<textarea rows={3} value={editingStoppage.resolutionNotes || ''} onChange={e => setEditingStoppage(v => v ? { ...v, resolutionNotes: e.target.value } : v)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></label>
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setEditingStoppage(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm">Cancelar</button>
              <button onClick={() => void saveStoppage()} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center gap-2"><Check className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar correção'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
