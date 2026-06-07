import React, { useState, useMemo } from 'react';
import { Activity, Stoppage } from '../types';
import { Download, Search, FileSpreadsheet, Layers, PowerOff, Filter, Calendar, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface HistoryLogsProps {
  activities: Activity[];
  stoppages: Stoppage[];
  onClearLogs?: () => void;
  onDeleteActivity?: (id: string) => void;
  onDeleteStoppage?: (id: string) => void;
  isAdmin?: boolean;
}

export default function HistoryLogs({ 
  activities, 
  stoppages, 
  onClearLogs,
  onDeleteActivity,
  onDeleteStoppage,
  isAdmin
}: HistoryLogsProps) {
  const [activeSheetTab, setActiveSheetTab] = useState<'ACTIVITIES' | 'STOPPAGES'>('ACTIVITIES');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [dateSearch, setDateSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('ALL');

  // Unified list of unique operators across both datasets for easy dropdown selection if desired
  const uniqueOperators = useMemo(() => {
    const list = new Set<string>();
    activities.forEach(a => list.add(a.operator));
    stoppages.forEach(s => list.add(s.operator));
    return Array.from(list).filter(Boolean);
  }, [activities, stoppages]);

  // 1. Filtered Activities matching sheet_atividades.csv structure
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      const matchesOperator = act.operator.toLowerCase().includes(operatorSearch.toLowerCase());
      const matchesDate = !dateSearch || act.date.includes(dateSearch) || act.date.split('-').reverse().join('/').includes(dateSearch);
      const matchesCode = codeFilter === 'ALL' || act.activityCode.toString() === codeFilter;

      return matchesOperator && matchesDate && matchesCode;
    }).sort((a, b) => b.id.localeCompare(a.id)); // sort by ID (usually date based)
  }, [activities, operatorSearch, dateSearch, codeFilter]);

  // 2. Filtered Stoppages matching sheet_produção.csv structure
  const filteredStoppages = useMemo(() => {
    return stoppages.filter(stop => {
      const matchesOperator = stop.operator.toLowerCase().includes(operatorSearch.toLowerCase());
      const matchesDate = !dateSearch || stop.date.includes(dateSearch) || stop.date.split('-').reverse().join('/').includes(dateSearch);
      const matchesCode = codeFilter === 'ALL' || stop.stoppageCode.toString() === codeFilter;

      return matchesOperator && matchesDate && matchesCode;
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [stoppages, operatorSearch, dateSearch, codeFilter]);

  // 3. Export to CSV client-side utility for Activities
  const handleExportActivitiesCSV = () => {
    if (filteredActivities.length === 0) return;

    // Matches sheet_atividades.csv exactly:
    const headers = [
      'ID', 'Data', 'Colaborador', 'Código Atividade', 'Local', 'Lista', 
      'Inicial', 'Final', 'Duração', 'Paleteira', 'Empilhadeira', 
      'Qtd Peças', 'Qtd de Itens', 'Observação', 'Quem fez o lançamento:', 'Data de lançamento:'
    ];

    const rows = filteredActivities.map(act => [
      act.id,
      act.date,
      act.operator,
      act.activityCode,
      act.local || 'N/A',
      act.listId || 'N/A',
      act.startTime,
      act.endTime || '',
      act.duration || '',
      act.palletJackId || '',
      act.forkliftId || '',
      act.producedQuantity,
      act.itemsQuantity,
      act.notes || '',
      act.creator || 'Sara',
      act.createdAt || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sheet_atividades_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Export to CSV client-side utility for Stoppages
  const handleExportStoppagesCSV = () => {
    if (filteredStoppages.length === 0) return;

    // Matches sheet_produção.csv exactly:
    const headers = [
      'ID', 'Data', 'Colaborador', 'Nº parada', 'Inicial', 'Final', 'Duração', 'Observação', 'Quem fez o lançamento:', 'Data de lançamento:'
    ];

    const rows = filteredStoppages.map(stop => [
      stop.id,
      stop.date,
      stop.operator,
      stop.stoppageCode,
      stop.startTime,
      stop.endTime || '',
      stop.duration || '',
      stop.notes || '',
      stop.creator || 'Sara',
      stop.createdAt || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sheet_producao_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="history-sheets-view">
      {/* 1. Header with Sheet Toggles & CSV Export Options */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white border border-slate-200 p-6 rounded-xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Visualização de Planilhas Porto Brasil</h2>
          <p className="text-sm text-slate-400 mt-1">Veja seus lançamentos nos mesmos modelos das planilhas integradas e faça a exportação para o Excel</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeSheetTab === 'ACTIVITIES' ? (
            <button
              onClick={handleExportActivitiesCSV}
              disabled={filteredActivities.length === 0}
              id="export-activities-sheet-btn"
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold py-2 px-4 rounded-xl text-xs sm:text-sm transition flex items-center space-x-2 cursor-pointer shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Exportar Atividades ({filteredActivities.length})</span>
            </button>
          ) : (
            <button
              onClick={handleExportStoppagesCSV}
              disabled={filteredStoppages.length === 0}
              id="export-stoppages-sheet-btn"
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold py-2 px-4 rounded-xl text-xs sm:text-sm transition flex items-center space-x-2 cursor-pointer shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Exportar Paradas ({filteredStoppages.length})</span>
            </button>
          )}

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              id="clear-all-registers-btn"
              className="bg-slate-50 hover:bg-red-50 hover:text-red-600 font-semibold py-2 px-4 rounded-xl text-xs border border-slate-200 transition cursor-pointer"
              title="Limpar todos os registros e logs do terminal"
            >
              Limpar Lançamentos
            </button>
          )}
        </div>
      </div>

      {/* 2. Spreadsheet Selector Tabs */}
      <div className="flex border-b border-slate-200 select-none">
        <button
          onClick={() => {
            setActiveSheetTab('ACTIVITIES');
            setCodeFilter('ALL');
          }}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition cursor-pointer ${
            activeSheetTab === 'ACTIVITIES'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/10'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Planilha de Atividades (sheet_atividades)</span>
        </button>
        <button
          onClick={() => {
            setActiveSheetTab('STOPPAGES');
            setCodeFilter('ALL');
          }}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition cursor-pointer ${
            activeSheetTab === 'STOPPAGES'
              ? 'border-red-600 text-red-700 bg-red-50/10'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PowerOff className="w-4 h-4" />
          <span>Planilha de Paradas (sheet_producao)</span>
        </button>
      </div>

      {/* 3. High Performance Row Query Filters */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4" id="sheets-filter-box">
        {/* Operator Search Input */}
        <div className="space-y-1.5Col">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Colaborador / Operador</span>
          </label>
          <input
            type="text"
            placeholder="Pesquisar por nome do colaborador..."
            value={operatorSearch}
            onChange={(e) => setOperatorSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 text-sm focus:border-blue-500 outline-hidden"
          />
        </div>

        {/* Date Search Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Data</span>
          </label>
          <input
            type="text"
            placeholder="Ex: 06/06/2026..."
            value={dateSearch}
            onChange={(e) => setDateSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 text-sm focus:border-blue-500 outline-hidden font-mono"
          />
        </div>

        {/* Code Filter Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>{activeSheetTab === 'ACTIVITIES' ? 'Código Atividade' : 'Nº Parada'}</span>
          </label>
          <select
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 text-sm focus:border-blue-500 outline-hidden"
          >
            <option value="ALL">Mostrar Todos</option>
            {activeSheetTab === 'ACTIVITIES' ? (
              <>
                <option value="1">1 - Separação</option>
                <option value="2">2 - Armazenamento</option>
                <option value="3">3 - Remontar Picadeiras</option>
                <option value="4">4 - Outros</option>
              </>
            ) : (
              <>
                <option value="1">1 - Banheiro/Água</option>
                <option value="2">2 - Trabalhando em outro setor</option>
                <option value="3">3 - Treinamento</option>
                <option value="4">4 - Reunião</option>
                <option value="5">5 - Limpeza do setor</option>
                <option value="6">6 - Auxiliando externo</option>
                <option value="7">7 - Inventário Pontual</option>
                <option value="8">8 - Equipamento instável</option>
                <option value="9">9 - Procurando Pallet</option>
                <option value="10">10 - Checklist</option>
                <option value="11">11 - Descarte quebra</option>
                <option value="12">12 - Auditoria</option>
                <option value="13">13 - Outros</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* 4. Tabular Interactive Sheet Tables */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm overflow-hidden" id="sheet-table-box">
        {activeSheetTab === 'ACTIVITIES' ? (
          <div>
            <div className="flex justify-between items-center mb-4 select-none">
              <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-md uppercase">
                Planilha Atividades: {filteredActivities.length} linhas filtradas
              </span>
              <span className="text-xs text-slate-400 font-medium">Modelo: sheet_atividades.csv</span>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-sm">
                Nenhuma atividade encontrada com os filtros selecionados. Efetue novos lançamentos para visualizar aqui.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none bg-slate-50">
                      <th className="py-3 px-4 min-w-[130px]">ID</th>
                      <th className="py-3 px-4 text-center">Data</th>
                      <th className="py-3 px-4">Colaborador</th>
                      <th className="py-3 px-4 text-center">Cód Act</th>
                      <th className="py-3 px-4">Local</th>
                      <th className="py-3 px-4">Lista</th>
                      <th className="py-3 px-4 text-center">Início</th>
                      <th className="py-3 px-4 text-center">Fim</th>
                      <th className="py-3 px-4 text-center">Duração</th>
                      <th className="py-3 px-4 text-right">Qtd Pçs</th>
                      <th className="py-3 px-4 text-right">Qtd Itens</th>
                      <th className="py-3 px-4">Observação</th>
                      <th className="py-3 px-4">Lançador</th>
                      <th className="py-3 px-4">Data Lançamento</th>
                      {isAdmin && <th className="py-3 px-4 text-center w-16">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                    {filteredActivities.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50/60 font-medium">
                        <td className="py-3 px-4 font-mono text-slate-500 select-all font-bold whitespace-nowrap">{act.id}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap font-mono text-slate-600">{act.date}</td>
                        <td className="py-3 px-4 text-slate-900 font-bold">{act.operator}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold font-mono">
                            {act.activityCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{act.local || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{act.listId || 'N/A'}</td>
                        <td className="py-3 px-4 text-center font-mono">{act.startTime}</td>
                        <td className="py-3 px-4 text-center font-mono">{act.endTime || '-'}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 bg-slate-50/30 whitespace-nowrap">{act.duration}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-900 font-bold">{act.producedQuantity.toLocaleString('pt-BR')}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-900 font-bold">{act.itemsQuantity.toLocaleString('pt-BR')}</td>
                        <td className="py-3 px-4 text-slate-500 italic max-w-sm truncate" title={act.notes}>{act.notes || '-'}</td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{act.creator || 'Sara'}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">{act.createdAt || '-'}</td>
                        {isAdmin && (
                          <td className="py-2 px-4 text-center">
                            <button
                              onClick={() => {
                                if (window.confirm('Excluir este registro permanentemente de Atividades?')) {
                                  onDeleteActivity?.(act.id);
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-rose-50 rounded-md hover:text-red-700 transition cursor-pointer inline-flex items-center justify-center"
                              title="Excluir Registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4 select-none">
              <span className="text-xs font-bold font-mono text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-md uppercase">
                Planilha Paradas: {filteredStoppages.length} linhas filtradas
              </span>
              <span className="text-xs text-slate-400 font-medium">Modelo: sheet_producao.csv</span>
            </div>

            {filteredStoppages.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-sm">
                Nenhuma parada encontrada com os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none bg-slate-50">
                      <th className="py-3 px-4 min-w-[130px]">ID</th>
                      <th className="py-3 px-4 text-center">Data</th>
                      <th className="py-3 px-4">Colaborador</th>
                      <th className="py-3 px-4 text-center">Nº Parada</th>
                      <th className="py-3 px-4 text-center">Início</th>
                      <th className="py-3 px-4 text-center">Fim</th>
                      <th className="py-3 px-4 text-center">Duração</th>
                      <th className="py-3 px-4">Observação</th>
                      <th className="py-3 px-4">Lançador</th>
                      <th className="py-3 px-4">Data Lançamento</th>
                      {isAdmin && <th className="py-3 px-4 text-center w-16">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                    {filteredStoppages.map((stop) => (
                      <tr key={stop.id} className="hover:bg-slate-50/60 font-medium">
                        <td className="py-3 px-4 font-mono text-slate-500 select-all font-bold whitespace-nowrap">{stop.id}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap font-mono text-slate-600">{stop.date}</td>
                        <td className="py-3 px-4 text-slate-900 font-bold">{stop.operator}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold font-mono">
                            {stop.stoppageCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{stop.startTime}</td>
                        <td className="py-3 px-4 text-center font-mono">{stop.endTime || '-'}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 bg-slate-50/30 whitespace-nowrap">{stop.duration}</td>
                        <td className="py-3 px-4 text-slate-500 italic max-w-sm truncate" title={stop.notes}>{stop.notes || '-'}</td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{stop.creator || 'Sara'}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">{stop.createdAt || '-'}</td>
                        {isAdmin && (
                          <td className="py-2 px-4 text-center">
                            <button
                              onClick={() => {
                                if (window.confirm('Excluir este registro permanentemente de Paradas?')) {
                                  onDeleteStoppage?.(stop.id);
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-rose-50 rounded-md hover:text-red-700 transition cursor-pointer inline-flex items-center justify-center"
                              title="Excluir Registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
