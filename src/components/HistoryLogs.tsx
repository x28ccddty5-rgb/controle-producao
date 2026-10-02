import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  PowerOff,
  Search
} from 'lucide-react';
import {
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
}

type SheetTab = 'ACTIVITIES' | 'STOPPAGES';

const PAGE_SIZE = 25;

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
  isAdmin
}: HistoryLogsProps) {
  const [activeSheetTab, setActiveSheetTab] = useState<SheetTab>('ACTIVITIES');
  const [startDate, setStartDate] = useState(getTodayIsoDate);
  const [endDate, setEndDate] = useState(getTodayIsoDate);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('ALL');
  const [page, setPage] = useState(0);

  const [activitiesPage, setActivitiesPage] = useState<HistoryPageResult<Activity>>({
    items: [],
    totalCount: 0
  });
  const [stoppagesPage, setStoppagesPage] = useState<HistoryPageResult<Stoppage>>({
    items: [],
    totalCount: 0
  });

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const selectedCode = codeFilter === 'ALL' ? undefined : Number(codeFilter);
  const currentItems = activeSheetTab === 'ACTIVITIES'
    ? activitiesPage.items
    : stoppagesPage.items;
  const totalCount = activeSheetTab === 'ACTIVITIES'
    ? activitiesPage.totalCount
    : stoppagesPage.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const codeOptions = useMemo(
    () => activeSheetTab === 'ACTIVITIES' ? ACTIVITY_OPTIONS : STOPPAGE_OPTIONS,
    [activeSheetTab]
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

    try {
      const offset = requestedPage * PAGE_SIZE;

      if (activeSheetTab === 'ACTIVITIES') {
        const result = await dbFetchActivityHistoryPage({
          startDate,
          endDate,
          operator: operatorSearch,
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
          operator: operatorSearch,
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
    // A aba inicia a consulta do período atual.
    // Filtros só são aplicados ao clicar em Consultar período.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetTab]);

  const handleToday = () => {
    const today = getTodayIsoDate();
    setStartDate(today);
    setEndDate(today);
    setPage(0);
  };

  const handleExport = async () => {
    if (!validatePeriod()) return;

    setExporting(true);
    setError('');

    try {
      if (activeSheetTab === 'ACTIVITIES') {
        const rows = await fetchAllActivities(startDate, endDate, operatorSearch, selectedCode);

        if (rows.length === 0) {
          setError('Nenhuma atividade encontrada para exportação.');
          return;
        }

        const headers = [
          'ID',
          'Data',
          'Colaborador',
          'Código Atividade',
          'Local',
          'Lista',
          'Inicial',
          'Final',
          'Duração',
          'Mov. Paleteira',
          'Mov. Empilhadeira',
          'Qtd Peças',
          'Qtd de Itens',
          'Observação',
          'Quem fez o lançamento',
          'Data de lançamento'
        ];

        const csv = [
          headers.join(';'),
          ...rows.map(act => [
            act.id,
            act.date,
            act.operator,
            act.activityCode,
            act.local,
            act.listId,
            act.startTime,
            act.endTime || '',
            act.duration,
            act.palletJackId || '',
            act.forkliftId || '',
            act.producedQuantity,
            act.itemsQuantity,
            act.notes || '',
            act.creator,
            act.createdAt
          ].map(escapeCsv).join(';'))
        ].join('\n');

        const blob = new Blob(
          [new Uint8Array([0xEF, 0xBB, 0xBF]), csv],
          { type: 'text/csv;charset=utf-8;' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `historico_atividades_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } else {
        const rows = await fetchAllStoppages(startDate, endDate, operatorSearch, selectedCode);

        if (rows.length === 0) {
          setError('Nenhuma parada encontrada para exportação.');
          return;
        }

        const headers = [
          'ID',
          'Data',
          'Colaborador',
          'Nº Parada',
          'Inicial',
          'Final',
          'Duração',
          'Observação',
          'Quem fez o lançamento',
          'Data de lançamento'
        ];

        const csv = [
          headers.join(';'),
          ...rows.map(stop => [
            stop.id,
            stop.date,
            stop.operator,
            stop.stoppageCode,
            stop.startTime,
            stop.endTime || '',
            stop.duration,
            stop.notes || '',
            stop.creator,
            stop.createdAt
          ].map(escapeCsv).join(';'))
        ].join('\n');

        const blob = new Blob(
          [new Uint8Array([0xEF, 0xBB, 0xBF]), csv],
          { type: 'text/csv;charset=utf-8;' }
        );
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

  const handleTabChange = (tab: SheetTab) => {
    setActiveSheetTab(tab);
    setCodeFilter('ALL');
    setPage(0);
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= totalPages || loading) return;
    void queryHistory(nextPage);
  };

  return (
    <div className="space-y-6" id="history-sheets-view">
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Histórico de Movimentações</h2>
            <p className="text-sm text-slate-400 mt-1">
              Consulte atividades e paradas por período sem carregar todo o histórico para o navegador.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando...' : 'Exportar Histórico'}
            </button>
          </div>
        </div>

        <div className="mt-5 bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                De
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Até
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleToday}
              className="h-10 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs"
            >
              Hoje
            </button>

            <button
              onClick={() => void queryHistory(0)}
              disabled={loading}
              className="h-10 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Consultando...' : 'Consultar Período'}
            </button>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Colaborador
              </label>
              <input
                type="text"
                value={operatorSearch}
                onChange={e => setOperatorSearch(e.target.value)}
                placeholder="Ex.: Luis"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                {activeSheetTab === 'ACTIVITIES' ? 'Código da Atividade' : 'Nº da Parada'}
              </label>
              <select
                value={codeFilter}
                onChange={e => setCodeFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="ALL">Todos</option>
                {codeOptions.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-end text-xs text-slate-400">
              <span>
                A consulta usa a data operacional do lançamento. Nenhuma conversão de fuso horário é aplicada à data histórica.
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-xs font-semibold">
            {error}
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 select-none">
        <button
          onClick={() => handleTabChange('ACTIVITIES')}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            activeSheetTab === 'ACTIVITIES'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Atividades
        </button>

        <button
          onClick={() => handleTabChange('STOPPAGES')}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            activeSheetTab === 'STOPPAGES'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PowerOff className="w-4 h-4" />
          Paradas
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-2">
          <div className="flex items-center gap-2">
            {activeSheetTab === 'ACTIVITIES'
              ? <ActivityIcon className="w-4 h-4 text-emerald-600" />
              : <PowerOff className="w-4 h-4 text-red-600" />}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {activeSheetTab === 'ACTIVITIES' ? 'Histórico de Atividades' : 'Histórico de Paradas'}
            </span>
          </div>

          <span className="text-xs font-mono text-slate-500">
            {totalCount.toLocaleString('pt-BR')} registros
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Consultando o período no banco de dados...
          </div>
        ) : currentItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : activeSheetTab === 'ACTIVITIES' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4 text-center">Data</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4 text-center">Cód.</th>
                  <th className="py-3 px-4">Local</th>
                  <th className="py-3 px-4">Lista</th>
                  <th className="py-3 px-4 text-center">Início</th>
                  <th className="py-3 px-4 text-center">Fim</th>
                  <th className="py-3 px-4 text-center">Duração</th>
                  <th className="py-3 px-4 text-right">Pçs</th>
                  <th className="py-3 px-4 text-right">Itens</th>
                  <th className="py-3 px-4">Lançador</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {activitiesPage.items.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-center whitespace-nowrap font-mono">{formatDateForDisplay(act.date)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{act.operator}</td>
                    <td className="py-3 px-4 text-center font-mono">{act.activityCode}</td>
                    <td className="py-3 px-4 font-mono">{act.local || '-'}</td>
                    <td className="py-3 px-4 font-mono">{act.listId || '-'}</td>
                    <td className="py-3 px-4 text-center font-mono">{act.startTime}</td>
                    <td className="py-3 px-4 text-center font-mono">{act.endTime || '-'}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold">{act.duration}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{act.producedQuantity.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{act.itemsQuantity.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4">{act.creator}</td>
                    {isAdmin && (
                      <td className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEditActivity?.(act)}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded-md"
                            title="Editar Registro"
                          >
                            <span className="text-[10px] font-bold">EDIT</span>
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Excluir este registro permanentemente de Atividades?')) {
                                onDeleteActivity?.(act.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-rose-50 rounded-md"
                            title="Excluir Registro"
                          >
                            <span className="text-[10px] font-bold">DEL</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4 text-center">Data</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4 text-center">Nº</th>
                  <th className="py-3 px-4 text-center">Início</th>
                  <th className="py-3 px-4 text-center">Fim</th>
                  <th className="py-3 px-4 text-center">Duração</th>
                  <th className="py-3 px-4">Observação</th>
                  <th className="py-3 px-4">Lançador</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {stoppagesPage.items.map(stop => (
                  <tr key={stop.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-center whitespace-nowrap font-mono">{formatDateForDisplay(stop.date)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{stop.operator}</td>
                    <td className="py-3 px-4 text-center font-mono">{stop.stoppageCode}</td>
                    <td className="py-3 px-4 text-center font-mono">{stop.startTime}</td>
                    <td className="py-3 px-4 text-center font-mono">{stop.endTime || '-'}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold">{stop.duration}</td>
                    <td className="py-3 px-4 max-w-sm truncate" title={stop.notes}>{stop.notes || '-'}</td>
                    <td className="py-3 px-4">{stop.creator}</td>
                    {isAdmin && (
                      <td className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEditStoppage?.(stop)}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded-md"
                            title="Editar Registro"
                          >
                            <span className="text-[10px] font-bold">EDIT</span>
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Excluir este registro permanentemente de Paradas?')) {
                                onDeleteStoppage?.(stop.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-rose-50 rounded-md"
                            title="Excluir Registro"
                          >
                            <span className="text-[10px] font-bold">DEL</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0 || loading}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page + 1 >= totalPages || loading}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-2">
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <Filter className="w-3.5 h-3.5" />
        <Calendar className="w-3.5 h-3.5" />
        Consulta paginada diretamente no Supabase. Exportação é feita somente quando solicitada.
      </div>
    </div>
  );
}
