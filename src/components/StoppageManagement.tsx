import React, { useState, useMemo } from 'react';
import { Stoppage } from '../types';
import { 
  ShieldAlert,
  PowerOff, 
  ChevronUp, 
  Clock, 
  Info, 
  Calendar,
  CheckCircle2, 
  Search,
  HardHat,
  Trash2
} from 'lucide-react';
//import { motion, AnimatePresence } from 'motion/react';

interface StoppageManagementProps {
  stoppages: Stoppage[];
  onAddStoppage: (stoppage: any) => void;
  onResolveStoppage: (stoppageId: string, resolutionNotes?: string) => void;
  onDeleteStoppage?: (stoppageId: string) => void;
  isAdmin?: boolean;
  collaboratorsList?: string[];
  stoppagesList?: { code: number; name: string }[];
}

const COLLABORATORS = ['Sara', 'Carlos', 'Marcos', 'João', 'Rafael', 'Luan', 'Karl', 'Luis', 'Daniel'];

const STOPPAGES_LIST = [
  { code: 1, name: 'Banheiro/Água' },
  { code: 2, name: 'Trabalhando em outro setor' },
  { code: 3, name: 'Treinamento' },
  { code: 4, name: 'Reunião' },
  { code: 5, name: 'Limpeza do setor' },
  { code: 6, name: 'Auxiliando funcionário de outro setor' },
  { code: 7, name: 'Inventário Pontual' },
  { code: 8, name: 'Equipamento com problema' },
  { code: 9, name: 'Procurando Pallet não encontrado' },
  { code: 10, name: 'Checklist do setor' },
  { code: 11, name: 'Descarte de quebra' },
  { code: 12, name: 'Auditoria' },
  { code: 13, name: 'Outros' }
];

export default function StoppageManagement({ 
  stoppages, 
  onAddStoppage, 
  onResolveStoppage, 
  onDeleteStoppage, 
  isAdmin,
  collaboratorsList,
  stoppagesList
}: StoppageManagementProps) {
  const collaboratorsToUse = collaboratorsList || COLLABORATORS;
  const stoppagesToUse = stoppagesList || STOPPAGES_LIST;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState('');

  // 1. Core Stoppage Form Inputs
  const [stoppageDate, setStoppageDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  const [operator, setOperator] = useState(() => collaboratorsToUse[0] || 'Sara');
  const [stoppageCode, setStoppageCode] = useState(() => stoppagesToUse[0]?.code || 1);
  
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    let mins = now.getMinutes() - 15;
    let hrs = now.getHours();
    if (mins < 0) {
      mins += 60;
      hrs -= 1;
      if (hrs < 0) hrs += 24;
    }
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  });

  const [endTime, setEndTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const pastStoppages = stoppages.filter(s => s.status === 'RESOLVIDA');

  // Filter completed stoppages locally on operador search query
  const filteredPastStoppages = useMemo(() => {
    if (!operatorSearch.trim()) return pastStoppages;
    return pastStoppages.filter(stop => 
      stop.operator.toLowerCase().includes(operatorSearch.toLowerCase())
    );
  }, [pastStoppages, operatorSearch]);

  const handleCalculateDuration = (start: string, end: string) => {
    try {
      const startParts = start.split(':').map(Number);
      const endParts = end.split(':').map(Number);
      if (startParts.length < 2 || endParts.length < 2) return '00:15';
      
      let startMins = startParts[0] * 60 + startParts[1];
      let endMins = endParts[0] * 60 + endParts[1];
      if (endMins < startMins) endMins += 24 * 60; // Rollover hours
      
      const diff = endMins - startMins;
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch {
      return '00:15';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!endTime) {
      setFormError('O horário final é obrigatório para calcular a duração e os indicadores setoriais da parada.');
      return;
    }

    // Time validation lock: prevent final times before starting times, allowing a maximum 12-hour rollover margin for night shift 
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    if (startParts.length === 2 && endParts.length === 2) {
      let startMins = startParts[0] * 60 + startParts[1];
      let endMins = endParts[0] * 60 + endParts[1];
      if (endMins < startMins) {
        endMins += 24 * 60; // turn shift rollover
      }
      const totalMinutes = endMins - startMins;
      if (totalMinutes > 720) { // More than 12 hours
        setFormError('Atenção: O horário final não pode ser anterior ao horário de início (limite padrão de 12h, inclusive em viradas de turno). Verifique se digitou corretamente.');
        return;
      }
    }

    // Format localized date representation (DD/MM/YYYY)
    let formattedDate = '';
    if (stoppageDate) {
      const parts = stoppageDate.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDate = stoppageDate;
      }
    } else {
      formattedDate = new Date().toLocaleDateString('pt-BR');
    }

    const durationStr = handleCalculateDuration(startTime, endTime);

    onAddStoppage({
      operator,
      stoppageCode: Number(stoppageCode),
      notes: notes.trim() ? notes : undefined,
      date: formattedDate,
      startTime: startTime,
      endTime: endTime,
      duration: durationStr,
      isRetroactive: true
    });

    // Reset layout input states except operator/date
    setNotes('');
    setStartTime(() => {
      const now = new Date();
      let mins = now.getMinutes() - 15;
      let hrs = now.getHours();
      if (mins < 0) {
        mins += 60;
        hrs -= 1;
        if (hrs < 0) hrs += 24;
      }
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    });
    setEndTime(() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    setIsFormOpen(false);
  };

  const formatTimeLabel = (timeStr: string) => {
    if (!timeStr) return '-';
    if (timeStr.includes(':') && timeStr.length <= 5) {
      return timeStr;
    }
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {}
    return timeStr;
  };

  return (
    <div className="space-y-8" id="stoppages-view">
      
      {/* 1. Header & Quick Controller */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Controles de Parada</h2>
          <p className="text-sm text-slate-400 mt-1 font-sans">Gira motivos de paradas regulamentares, reuniões de equipe ou intervalos operacionais</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          id="toggle-stoppage-form-btn"
          className="mt-4 sm:mt-0 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl transition duration-150 flex items-center space-x-2 text-sm shadow-sm cursor-pointer"
        >
          {isFormOpen ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>Ocultar Painel</span>
            </>
          ) : (
            <>
              <PowerOff className="h-4 w-4" />
              <span>Efetuar Lançamento</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Paper-Style Unified Stoppage Form */}
      <>
        {isFormOpen && (
          <div
            className="overflow-hidden mb-6"
            id="stoppage-form-container"
          >
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-red-50 to-rose-50/50 px-6 py-4 border-b border-slate-200">
                <span className="text-xs font-bold text-red-700 tracking-wider uppercase block">Formulário Digital</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">CON-372 - ESTOQUE DE CHACOTE • Controle de Parada</h3>
              </div>

              <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                
                {formError && (
                  <div className="md:col-span-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-xs md:text-sm flex items-center space-x-2 shadow-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Col 1: Data */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Data da Parada</label>
                  <input
                    type="date"
                    required
                    value={stoppageDate}
                    onChange={(e) => setStoppageDate(e.target.value)}
                    id="input-stoppage-date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-mono"
                  />
                </div>

                {/* Col 2: Colaborador */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Colaborador / Operador</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    id="input-stoppage-operator"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-705 text-sm transition outline-hidden font-sans"
                  >
                    {collaboratorsToUse.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Col 3: Parada (nº) */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Parada (Nº e Descrição)</label>
                  <select
                    value={stoppageCode}
                    onChange={(e) => setStoppageCode(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden"
                  >
                    {stoppagesToUse.map(st => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Col 4: Horário Inicial */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Horário Inicial</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Col 5: Horário Final */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Horário Final</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Col 6: Observações */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Observação</label>
                  <input
                    type="text"
                    placeholder="Ex: Reunião SIPAT realizada na sala geral..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden"
                  />
                </div>

                {/* Buttons Row */}
                <div className="md:col-span-4 flex justify-end space-x-3 pt-3 border-t border-slate-100 font-sans select-none">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="bg-slate-100 hover:bg-slate-250 text-slate-600 font-semibold py-2 px-4 rounded-xl text-xs sm:text-sm cursor-pointer transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-5 rounded-xl text-xs sm:text-sm cursor-pointer transition shadow-xs flex items-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Gravar Lançamento</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>

      {/* 4. Resolved stoppages tracker table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm font-sans" id="resolved-stoppages-container">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Ocorrência de Paradas Lançadas ({filteredPastStoppages.length})</h3>
            <p className="text-xs text-slate-400 mt-0.5">Histórico completo de intervalos e tempos ociosos lançados</p>
          </div>
          <div className="relative w-full md:w-72 shrink-0 select-none">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por nome do colaborador..."
              value={operatorSearch}
              onChange={(e) => setOperatorSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-700 outline-hidden transition"
            />
          </div>
        </div>

        {filteredPastStoppages.length === 0 ? (
          <div className="py-12 border border-dashed border-slate-200/65 rounded-xl text-center text-slate-400 text-sm">
            Nenhum registro de parada encontrado para esta busca.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse" id="resolved-stoppages-table font-medium">
              <thead>
                <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none bg-slate-50/50">
                  <th className="py-3 px-4">Parada (Nº)</th>
                  <th className="py-3 px-4">Motivo Lançado</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4 text-center">Data</th>
                  <th className="py-3 px-4 text-center">Início</th>
                  <th className="py-3 px-4 text-center">Término</th>
                  <th className="py-3 px-4 text-center">Duração</th>
                  <th className="py-3 px-4">Ação / Notas</th>
                  <th className="py-3 px-4">Lançador</th>
                  {isAdmin && <th className="py-3 px-4 text-center w-16">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPastStoppages.slice(0, 40).map((stop) => {
                  return (
                    <tr key={stop.id} className="hover:bg-slate-50/45 font-medium" id={`resolved-stoppage-row-${stop.id}`}>
                      <td className="py-3 px-4 font-mono select-none">
                        <span className="bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-600 text-[11px] font-mono">
                          {stop.stoppageCode || 13}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{stop.stoppageName}</td>
                      <td className="py-3 px-4 text-slate-900 font-bold flex items-center gap-1.5">
                        <span className="p-1 px-1.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0 uppercase">
                          <HardHat className="w-3 h-3 text-slate-400" />
                        </span>
                        <span>{stop.operator}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500 whitespace-nowrap">{stop.date}</td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {formatTimeLabel(stop.startTime)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {stop.endTime ? formatTimeLabel(stop.endTime) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 whitespace-nowrap bg-slate-50/50 rounded-sm">
                        {handleCalculateDuration(stop.startTime, stop.endTime || '')}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500 italic max-w-[250px] truncate" title={stop.notes}>
                        <div className="flex flex-col">
                          <span>{stop.notes || '-'}</span>
                          {stop.resolutionNotes && <span className="text-[10px] text-emerald-600 font-bold mt-1">Solução: {stop.resolutionNotes}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-semibold">{stop.creator || 'Sara'}</td>
                      {isAdmin && (
                        <td className="py-2 px-4 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm('Deseja realmente excluir este lançamento de parada de forma irrevogável?')) {
                                onDeleteStoppage?.(stop.id);
                              }
                            }}
                            className="p-1.5 text-red-500 hover:bg-rose-50 rounded-lg hover:text-red-700 transition cursor-pointer inline-flex items-center justify-center"
                            title="Excluir Parada"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
