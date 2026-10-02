import React, { useState } from 'react';
import {
  Users,
  Layers,
  PowerOff,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Database
} from 'lucide-react';
//import { motion } from 'motion/react';

interface AdminPanelProps {
  collaborators: string[];
  onAddCollaborator: (name: string) => Promise<boolean>;
  onDeactivateCollaborator: (name: string) => Promise<boolean>;
  
  activitiesList: { code: number; label: string }[];
  onUpdateActivitiesList: (newList: { code: number; label: string }[]) => void;
  
  stoppagesList: { code: number; name: string }[];
  onUpdateStoppagesList: (newList: { code: number; name: string }[]) => void;

  onCreateActivityType: (
  activityType: {
    code: number;
    label: string;
  }
) => Promise<void>;

onDeleteActivityType: (
  code: number
) => Promise<void>;

onCreateStoppageType: (
  stoppageType: {
    code: number;
    name: string;
  }
) => Promise<void>;

onDeleteStoppageType: (
  code: number
) => Promise<void>;
}

export default function AdminPanel({
  collaborators,
  onAddCollaborator,
  onDeactivateCollaborator,
  
  activitiesList,
  onUpdateActivitiesList,
  
  stoppagesList,
  onUpdateStoppagesList,
  
  onCreateActivityType,
  onDeleteActivityType,
  
  onCreateStoppageType,
  onDeleteStoppageType,
}: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'collab' | 'activity' | 'stoppage'>('collab');

  // Input states
  const [newCollabName, setNewCollabName] = useState('');
  const [newActivityCode, setNewActivityCode] = useState<number | ''>('');
  const [newActivityLabel, setNewActivityLabel] = useState('');
  const [newStoppageCode, setNewStoppageCode] = useState<number | ''>('');
  const [newStoppageName, setNewStoppageName] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // --- 1. Manage Collaborators ---
  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCollabName.trim();
    if (!name) {
      showNotification('Digite o nome do colaborador.', 'error');
      return;
    }
    if (collaborators.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      showNotification('Colaborador já cadastrado.', 'error');
      return;
    }

    const success = await onAddCollaborator(name);
    if (!success) {
      showNotification('Não foi possível salvar o colaborador no banco de dados.', 'error');
      return;
    }

    setNewCollabName('');
    showNotification(`Colaborador "${name}" adicionado com sucesso!`);
  };

  const handleDeleteCollaborator = async (name: string) => {
    if (confirm(`Tem certeza que deseja desativar o colaborador "${name}" do banco de dados?`)) {
      const success = await onDeactivateCollaborator(name);
      if (!success) {
        showNotification('Não foi possível desativar o colaborador no banco de dados.', 'error');
        return;
      }

      showNotification(`Colaborador "${name}" desativado.`);
    }
  };

  // --- 2. Manage Activities ---
  const handleAddActivity = async (
      e: React.FormEvent
    ) => {
    e.preventDefault();
    
    const code = Number(newActivityCode);
    const label = newActivityLabel.trim();

    if (!code || isNaN(code)) {
      showNotification('Digite um código numérico válido.', 'error');
      return;
    }
    if (!label) {
      showNotification('Digite a descrição da atividade.', 'error');
      return;
    }
    if (activitiesList.some(a => a.code === code)) {
      showNotification(`Atividade com código ${code} já existe.`, 'error');
      return;
    }

       await onCreateActivityType({
      code,
      label
    });
    
    setNewActivityCode('');
    setNewActivityLabel('');
    
    showNotification(`Atividade "${code} - ${label}" cadastrada com sucesso!`);
  };

    const handleDeleteActivity = async (
    code: number
  ) => {
  
    if (
      confirm(
        `Deseja remover a atividade de código ${code}?`
      )
    ) {
  
      await onDeleteActivityType(code);
  
      showNotification(
        `Atividade ${code} removida.`
      );
    }
  };

  // --- 3. Manage Stoppages ---
  const handleAddStoppage = async (
      e: React.FormEvent
    ) => {
    e.preventDefault();
    
    const code = Number(newStoppageCode);
    const name = newStoppageName.trim();

    if (!code || isNaN(code)) {
      showNotification('Digite um código numérico válido para a parada.', 'error');
      return;
    }
    if (!name) {
      showNotification('Digite o motivo da parada.', 'error');
      return;
    }
    if (stoppagesList.some(s => s.code === code)) {
      showNotification(`Parada com código ${code} já existe.`, 'error');
      return;
    }

    await onCreateStoppageType({
        code,
        name
      });
    
    setNewStoppageCode('');
    setNewStoppageName('');
    
    showNotification(`Parada "${code} - ${name}" cadastrada!`);
  };

  const handleDeleteStoppage = async (
    code: number
  ) => {
  
    if (
      confirm(
        `Deseja remover a parada de código ${code}?`
      )
    ) {
  
      await onDeleteStoppageType(code);
  
      showNotification(
        `Parada ${code} removida.`
      );
    }
  };
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm font-sans" id="admin-management-container">
      <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-4 mb-6">
        <div className="bg-blue-105 text-blue-600 p-2 rounded-xl">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
            Banco de Dados Oficial Porto Brasil
          </h2>
          <p className="text-[11px] text-slate-400 font-medium">
            Painel administrativo de colaboradores, atividades e tipos de paradas
          </p>
        </div>
      </div>

      {notification && (
        <div className={`p-4 mb-6 rounded-xl flex items-center space-x-2 text-xs font-semibold select-none ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-250'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ADMIN SUB TABS SELECTOR */}
      <div className="flex border-b border-slate-100 mb-6 shrink-0 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveSubTab('collab')}
          className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-extrabold uppercase tracking-wide border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'collab'
              ? 'border-blue-600 text-slate-800 font-black'
              : 'border-transparent text-slate-405 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Colaboradores ({collaborators.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('activity')}
          className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-extrabold uppercase tracking-wide border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'activity'
              ? 'border-blue-600 text-slate-800 font-black'
              : 'border-transparent text-slate-405 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Atividades ({activitiesList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('stoppage')}
          className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-extrabold uppercase tracking-wide border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'stoppage'
              ? 'border-blue-600 text-slate-800 font-black'
              : 'border-transparent text-slate-405 hover:text-slate-800'
          }`}
        >
          <PowerOff className="w-4 h-4" />
          <span>Tipos de Paradas ({stoppagesList.length})</span>
        </button>
      </div>

      {/* SUB PANELS CONTENT */}
      <div>
        {/* COLLABORATOR PANEL */}
        {activeSubTab === 'collab' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn">
            {/* Form */}
            <form onSubmit={handleAddCollaborator} className="md:col-span-5 bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="block font-bold text-slate-500 uppercase tracking-wide">Novo Colaborador</label>
                <input
                  type="text"
                  placeholder="Ex: Pedro de Carvalho..."
                  value={newCollabName}
                  onChange={(e) => setNewCollabName(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2.5 text-slate-700 font-sans outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">Nome completo ou crachá operacional do operador do pátio.</p>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Colaborador</span>
              </button>
            </form>

            {/* List */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex justify-between items-center">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Lista Cadastrada</span>
                  <span className="text-[10px] font-mono font-bold text-slate-650 bg-slate-150 px-2 py-0.5 rounded-full">{collaborators.length} funcionários</span>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto custom-scrollbar">
                  {collaborators.map((name) => (
                    <div key={name} className="px-5 py-3 flex justify-between items-center text-xs hover:bg-slate-50/50 transition">
                      <span className="font-bold text-slate-700">{name}</span>
                      <button
                        onClick={() => handleDeleteCollaborator(name)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                        title="Remover colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {collaborators.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">
                      Nenhum colaborador cadastrado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY PANEL */}
        {activeSubTab === 'activity' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn">
            {/* Form */}
            <form onSubmit={handleAddActivity} className="md:col-span-5 bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Código Numérico único (Nº)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Ex: 12"
                    value={newActivityCode}
                    onChange={(e) => setNewActivityCode(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2.5 text-slate-700 font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Nome / Descrição da Atividade</label>
                  <input
                    type="text"
                    placeholder="Ex: Conferência Especial..."
                    value={newActivityLabel}
                    onChange={(e) => setNewActivityLabel(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2.5 text-slate-700 font-sans outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Atividade</span>
              </button>
            </form>

            {/* List */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex justify-between items-center">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Tabela de Atividades do Setor</span>
                  <span className="text-[10px] font-mono font-bold text-slate-650 bg-slate-150 px-2 py-0.5 rounded-full">{activitiesList.length} ativas</span>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto custom-scrollbar">
                  {activitiesList.map((act) => (
                    <div key={act.code} className="px-5 py-3 flex justify-between items-center text-xs hover:bg-slate-50/50 transition">
                      <div className="flex items-center space-x-3 select-none">
                        <span className="font-mono font-black bg-slate-100 border border-slate-200 text-slate-650 px-2.5 py-0.5 rounded text-[10px]">{act.code}</span>
                        <span className="font-bold text-slate-700">{act.label}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteActivity(act.code)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                        title="Remover atividade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STOPPAGE PANEL */}
        {activeSubTab === 'stoppage' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn">
            {/* Form */}
            <form onSubmit={handleAddStoppage} className="md:col-span-5 bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Código numérico único (Nº)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Ex: 14"
                    value={newStoppageCode}
                    onChange={(e) => setNewStoppageCode(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2.5 text-slate-700 font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Motivo / Descrição da Parada</label>
                  <input
                    type="text"
                    placeholder="Ex: Espera de Empilhadeira..."
                    value={newStoppageName}
                    onChange={(e) => setNewStoppageName(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2.5 text-slate-700 font-sans outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Parada</span>
              </button>
            </form>

            {/* List */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex justify-between items-center">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Motivos de Parada Oficiais</span>
                  <span className="text-[10px] font-mono font-bold text-slate-655 bg-slate-150 px-2 py-0.5 rounded-full">{stoppagesList.length} motivos</span>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto custom-scrollbar">
                  {stoppagesList.map((st) => (
                    <div key={st.code} className="px-5 py-3 flex justify-between items-center text-xs hover:bg-slate-50/50 transition">
                      <div className="flex items-center space-x-3 select-none">
                        <span className="font-mono font-black bg-slate-100 border border-slate-200 text-slate-655 px-2.5 py-0.5 rounded text-[10px]">{st.code}</span>
                        <span className="font-bold text-slate-700">{st.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteStoppage(st.code)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                        title="Remover motivo de parada"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
