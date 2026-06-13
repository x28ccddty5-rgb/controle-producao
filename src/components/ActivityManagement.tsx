import React, { useState, useMemo, useEffect } from 'react';
import { Activity, ActivityStatus } from '../types';
import { CheckCircle2, ChevronDown, ChevronUp, FilePlus, AlertCircle, Calendar, Clock, Tag } from 'lucide-react';
//import { motion, AnimatePresence } from 'motion/react';

interface ActivityManagementProps {
  activities: Activity[];
  onAddActivity: (activity: any) => void;
  onUpdateActivityQuantity: (activityId: string, produced: number, items: number) => void;
  onUpdateActivityStatus: (activityId: string, status: ActivityStatus) => void;
  activeStagedOperators: string[];
  onDeleteActivity?: (id: string) => void;
  isAdmin?: boolean;
  collaboratorsList?: string[];
  activitiesList?: { code: number; label: string }[];

  editingActivity?: Activity | null;
  setEditingActivity?: (activity: Activity | null) => void;
}

const COLLABORATORS = ['Sara', 'Carlos', 'Marcos', 'João', 'Rafael', 'Luan', 'Karl', 'Luis', 'Daniel'];

const ACTIVITIES_LIST = [
  { code: 1, label: 'Separação' },
  { code: 2, label: 'Armazenamento' },
  { code: 3, label: 'Remontar Picadeiras' },
  { code: 4, label: 'Trocar Strechs dos Pallets' },
  { code: 5, label: 'Movimentação' },
  { code: 6, label: 'Atualizar Etiquetas' },
  { code: 7, label: 'Endereçamento' },
  { code: 8, label: 'Empilhamento' },
  { code: 9, label: 'Liberando peças do Forno' },
  { code: 10, label: 'Inventário Rotativo' },
  { code: 11, label: 'Outros' }
];

export default function ActivityManagement({
  activities,
  onAddActivity,
  onUpdateActivityQuantity,
  onUpdateActivityStatus,
  onDeleteActivity,
  isAdmin,
  collaboratorsList,
  activitiesList,

  editingActivity,
  setEditingActivity

}: ActivityManagementProps) {
  const collaboratorsToUse = collaboratorsList || COLLABORATORS;
  const activitiesToUse = activitiesList || ACTIVITIES_LIST;

  const [isFormOpen, setIsFormOpen] = useState(false);

  // 1. Core activity details pre-fill
  const [prodDate, setProdDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [operator, setOperator] = useState(() => collaboratorsToUse[0] || 'Sara');
  const [activityCode, setActivityCode] = useState(() => activitiesToUse[0]?.code || 1);
  const [local, setLocal] = useState('');
  const [listId, setListId] = useState('');
  
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    let h = now.getHours() - 1;
    if (h < 0) h += 24;
    return `${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [endTime, setEndTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [palletJackId, setPalletJackId] = useState('');
  const [forkliftId, setForkliftId] = useState('');
  const [producedQuantity, setProducedQuantity] = useState<number>(0);
  const [itemsQuantity, setItemsQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {

  if (!editingActivity) return;

  setProdDate(
    editingActivity.date.split('/').reverse().join('-')
  );

  setOperator(editingActivity.operator);

  setActivityCode(editingActivity.activityCode);

  setLocal(editingActivity.local);

  setListId(editingActivity.listId);

  setStartTime(editingActivity.startTime);

  setEndTime(editingActivity.endTime || '');

  setPalletJackId(editingActivity.palletJackId);

  setForkliftId(editingActivity.forkliftId);

  setProducedQuantity(editingActivity.producedQuantity);

  setItemsQuantity(editingActivity.itemsQuantity);

  setNotes(editingActivity.notes || '');

  setIsFormOpen(true);

}, [editingActivity]);
  

  const handleCalculateDuration = (start: string, end: string) => {
    try {
      const startParts = start.split(':').map(Number);
      const endParts = end.split(':').map(Number);
      if (startParts.length < 2 || endParts.length < 2) return '01:00';
      
      let startMins = startParts[0] * 60 + startParts[1];
      let endMins = endParts[0] * 60 + endParts[1];
      if (endMins < startMins) endMins += 24 * 60; // Rollover hours
      
      const diff = endMins - startMins;
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch {
      return '01:00';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // End time is strictly required for retroactive calculations
    if (!endTime) {
      setFormError('O horário final é obrigatório para calcular a duração e os indicadores de produtividade.');
      return;
    }

    // Time validation lock: block if calculated duration is greater than 12 hours (e.g. 17:00 start and 16:30 end)
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    if (startParts.length === 2 && endParts.length === 2) {
      let startMins = startParts[0] * 60 + startParts[1];
      let endMins = endParts[0] * 60 + endParts[1];
      if (endMins < startMins) {
        endMins += 24 * 60; // shift changeover
      }
      const totalMinutes = endMins - startMins;
      if (totalMinutes > 720) { // More than 12 hours
        setFormError('Atenção: O horário final não pode ser anterior ao horário de início (limite padrão de 12h, inclusive em viradas de turno). Verifique se digitou corretamente.');
        return;
      }
    }

    const selectedCode = Number(activityCode);

    // Dynamic validations for Porto Brasil rules:
    // Activities 1, 2, 3 must have Qtd Peças and Qtd Itens greater than 0
    if ([1, 2, 3].includes(selectedCode)) {
      if (!producedQuantity || producedQuantity <= 0 || !itemsQuantity || itemsQuantity <= 0) {
        setFormError('Para as atividades 1, 2 ou 3, é obrigatório preencher a Qtd. Peças e Qtd. de Itens (maiores que zero).');
        return;
      }
    }

    // Activity 1 (Separação) must have a non-empty List ID (Lista)
    if (selectedCode === 1) {
      const cleanList = listId.trim().toUpperCase();
      if (!cleanList || cleanList === 'N/A' || cleanList === '-') {
        setFormError('Para a atividade 1 (Separação), é obrigatória a inserção do número da Lista.');
        return;
      }
    }

    if (!local.trim()) {
      setFormError('Por favor, preencha o Local da atividade.');
      return;
    }

    // Format launch date representation (DD/MM/YYYY)
    let formattedDate = '';
    if (prodDate) {
      const parts = prodDate.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDate = prodDate;
      }
    } else {
      formattedDate = new Date().toLocaleDateString('pt-BR');
    }

    const calculatedDuration = handleCalculateDuration(startTime, endTime);

    onAddActivity({
      operator,
      activityCode: selectedCode,
      local: local.trim(),
      listId: listId.trim() || 'N/A',
      palletJackId: palletJackId.trim(),
      forkliftId: forkliftId.trim(),
      producedQuantity: Number(producedQuantity) || 0,
      itemsQuantity: Number(itemsQuantity) || 0,
      notes: notes.trim() ? notes : undefined,
      date: formattedDate,
      startTime: startTime,
      endTime: endTime,
      duration: calculatedDuration,
      isRetroactive: true
    });

    // Reset layout input states
    setLocal('');
    setListId('');
    setPalletJackId('');
    setForkliftId('');
    setNotes('');
    setStartTime(() => {
      const now = new Date();
      let h = now.getHours() - 1;
      if (h < 0) h += 24;
      return `${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    setEndTime(() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    setProducedQuantity(0);
    setItemsQuantity(0);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-8" id="activities-view">
      
      {/* 1. Header with Collapse Form Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lançamento de Atividade</h2>
          <p className="text-sm text-slate-400 mt-1">Efetue lançamentos retroativos de lotes e valide indicadores de produtividade por operador</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          id="toggle-activity-form-btn"
          className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl transition duration-150 flex items-center space-x-2 text-sm shadow-sm cursor-pointer"
        >
          {isFormOpen ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>Ocultar Painel</span>
            </>
          ) : (
            <>
              <FilePlus className="h-4 w-4" />
              <span>Efetuar Lançamento</span>
            </>
          )}
        </button>
      </div>

      {/* 2. New Activity Unified Paper-Style Form */}
      <>
        {isFormOpen && (
          <div
            className="overflow-hidden"
            id="new-activity-form-container"
          >
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 px-6 py-4 border-b border-slate-200">
                <span className="text-xs font-bold text-blue-700 tracking-wider uppercase block">Formulário Digital</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">Ficha de Controle de Produção • Porto Brasil</h3>
                {editingActivity && (
                  <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
                    Editando atividade de {editingActivity.operator}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                
                {/* Error Box */}
                {formError && (
                  <div className="md:col-span-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-xs md:text-sm flex items-center space-x-2 shadow-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Row 1: Production Date, Operator & Activity */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Data da Produção</label>
                  <input
                    type="date"
                    required
                    value={prodDate}
                    onChange={(e) => setProdDate(e.target.value)}
                    id="input-activity-date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-mono"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Colaborador / Operador</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    id="input-activity-operator"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-sans"
                  >
                    {collaboratorsToUse.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Atividade de (Nº)</label>
                  <select
                    value={activityCode}
                    onChange={(e) => setActivityCode(Number(e.target.value))}
                    id="input-activity-code"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden"
                  >
                    {activitiesToUse.map(act => (
                      <option key={act.code} value={act.code}>
                        {act.code} - {act.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Location, Work Item & Timers (Times are placed before warehouse transport machinery IDs) */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Local de Destino</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 2..."
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    id="input-activity-local"
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden"
                  />
                </div>

               {activityCode === 1 && (
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Nº Lista (Separação)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 21971..."
                      value={listId}
                      onChange={(e) => {
                        const newCode = Number(e.target.value);
                        setActivityCode(newCode);
                      
                        if (newCode !== 1) {
                          setListId('');
                        }
                      }}
                      id="input-activity-list"
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition font-mono outline-hidden"
                    />
                  </div>
                )}

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Horário Inicial</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Horário Final</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 text-sm transition outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Row 3: Movimentadores (Paleteira, Empilhadeira) & Quantities */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Mov. Paleteira</label>
                  <input
                    type="text"
                    placeholder="Ex: P-04..."
                    value={palletJackId}
                    onChange={(e) => setPalletJackId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Mov. Empilhadeira</label>
                  <input
                    type="text"
                    placeholder="Ex: E-12..."
                    value={forkliftId}
                    onChange={(e) => setForkliftId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1 font-mono">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-sans">QTD DE PEÇAS</label>
                  <input
                    type="number"
                    min={0}
                    value={producedQuantity || ''}
                    onChange={(e) => setProducedQuantity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1 font-mono">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-sans">Qtd. de Itens (SKUs)</label>
                  <input
                    type="number"
                    min={0}
                    value={itemsQuantity || ''}
                    onChange={(e) => setItemsQuantity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition font-mono outline-hidden"
                  />
                </div>

                {/* Row 4: Observações */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Observação</label>
                  <input
                    type="text"
                    placeholder="Insira detalhes adicionais do pallets, quebra ou reajuste ambiental..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm transition outline-hidden"
                  />
                </div>

                {/* Submit Action Block */}
                <div className="md:col-span-4 flex justify-end space-x-3 pt-3 border-t border-slate-100 mt-2 select-none">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="bg-slate-100 hover:bg-slate-250 text-slate-600 font-semibold py-2 px-4 rounded-xl text-xs sm:text-sm cursor-pointer transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-xl text-xs sm:text-sm cursor-pointer transition shadow-xs flex items-center space-x-2"
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

    </div>
  );
}
