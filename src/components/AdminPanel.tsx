import React, { useState } from 'react';
import { CustomUser } from '../types';
import { 
  Users, 
  Layers, 
  PowerOff, 
  Lock, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  Eye
} from 'lucide-react';
//import { motion } from 'motion/react';

interface AdminPanelProps {
  collaborators: string[];
  onUpdateCollaborators: (newCollabs: string[]) => void;
  activitiesList: { code: number; label: string }[];
  onUpdateActivitiesList: (newList: { code: number; label: string }[]) => void;
  stoppagesList: { code: number; name: string }[];
  onUpdateStoppagesList: (newList: { code: number; name: string }[]) => void;
  usersList: CustomUser[];
  onUpdateUsersList: (newList: CustomUser[]) => void;
}

export default function AdminPanel({
  collaborators,
  onUpdateCollaborators,
  activitiesList,
  onUpdateActivitiesList,
  stoppagesList,
  onUpdateStoppagesList,
  usersList,
  onUpdateUsersList
}: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'collab' | 'activity' | 'stoppage' | 'users'>('collab');

  // Input states
  const [newCollabName, setNewCollabName] = useState('');
  const [newActivityCode, setNewActivityCode] = useState<number | ''>('');
  const [newActivityLabel, setNewActivityLabel] = useState('');
  const [newStoppageCode, setNewStoppageCode] = useState<number | ''>('');
  const [newStoppageName, setNewStoppageName] = useState('');

  // User input states
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'producao' | 'supervisor' | 'visualizador'>('producao');

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // --- 1. Manage Collaborators ---
  const handleAddCollaborator = (e: React.FormEvent) => {
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

    const updated = [...collaborators, name];
    onUpdateCollaborators(updated);
    setNewCollabName('');
    showNotification(`Colaborador "${name}" adicionado com sucesso!`);
  };

  const handleDeleteCollaborator = (name: string) => {
    if (confirm(`Tem certeza que deseja desativar o colaborador "${name}" do banco de dados?`)) {
      const updated = collaborators.filter(c => c !== name);
      onUpdateCollaborators(updated);
      showNotification(`Colaborador "${name}" removido.`);
    }
  };

  // --- 2. Manage Activities ---
  const handleAddActivity = (e: React.FormEvent) => {
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

    const updated = [...activitiesList, { code, label }].sort((a, b) => a.code - b.code);
    onUpdateActivitiesList(updated);
    setNewActivityCode('');
    setNewActivityLabel('');
    showNotification(`Atividade "${code} - ${label}" cadastrada com sucesso!`);
  };

  const handleDeleteActivity = (code: number) => {
    if (confirm(`Deseja remover a atividade de código ${code}?`)) {
      const updated = activitiesList.filter(a => a.code !== code);
      onUpdateActivitiesList(updated);
      showNotification(`Atividade ${code} removida.`);
    }
  };

  // --- 3. Manage Stoppages ---
  const handleAddStoppage = (e: React.FormEvent) => {
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

    const updated = [...stoppagesList, { code, name }].sort((a, b) => a.code - b.code);
    onUpdateStoppagesList(updated);
    setNewStoppageCode('');
    setNewStoppageName('');
    showNotification(`Parada "${code} - ${name}" cadastrada!`);
  };

  const handleDeleteStoppage = (code: number) => {
    if (confirm(`Deseja remover a parada de código ${code}?`)) {
      const updated = stoppagesList.filter(s => s.code !== code);
      onUpdateStoppagesList(updated);
      showNotification(`Parada ${code} removida.`);
    }
  };

  // --- 4. Manage Users ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUserName.trim();
    const username = newUserUsername.trim().toLowerCase();
    const password = newUserPassword.trim();

    if (!name) {
      showNotification('Digite o nome do usuário.', 'error');
      return;
    }
    if (!username || username.length < 3) {
      showNotification('Usuário precisa ter 3 ou mais caracteres.', 'error');
      return;
    }
    if (!password || password.length < 3) {
      showNotification('Senha precisa ter 3 ou mais caracteres.', 'error');
      return;
    }
    if (usersList.some(u => u.username.toLowerCase() === username)) {
      showNotification(`O usuário de acesso "${username}" já está cadastrado.`, 'error');
      return;
    }

    const newUser: CustomUser = {
      username,
      name,
      password,
      role: newUserRole
    };

    const updated = [...usersList, newUser];
    onUpdateUsersList(updated);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPassword('');
    showNotification(`Usuário "${name}" cadastrado!`);
  };

  const handleDeleteUser = (username: string) => {
    const isSpecial = ['producao', 'lideranca', 'adm', 'visualizar'].includes(username.toLowerCase());
    if (isSpecial) {
      showNotification('Os usuários predefinidos (Produção, Jonas, Matheus, Visualizador) não podem ser excluídos.', 'error');
      return;
    }

    if (confirm(`Excluir o usuário de acesso "${username}"?`)) {
      const updated = usersList.filter(u => u.username !== username);
      onUpdateUsersList(updated);
      showNotification(`Usuário "${username}" excluído.`);
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
            Painel administrativo secreto de gestão de referências, operadores, atividades e usuários autorizados
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

        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-extrabold uppercase tracking-wide border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'users'
              ? 'border-blue-600 text-slate-800 font-black'
              : 'border-transparent text-slate-405 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Usuários e Perfis ({usersList.length})</span>
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

        {/* ACCESSIBILITY PROFILES PANEL (USERS) */}
        {activeSubTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn font-sans">
            {/* Form */}
            <form onSubmit={handleAddUser} className="md:col-span-5 bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col justify-between space-y-3">
              <div className="space-y-3.5 text-xs">
                <p className="text-[10px] tracking-wide text-slate-450 uppercase font-bold select-none border-b border-slate-200 pb-1.5 mb-2">Novo Perfil de Acesso</p>
                
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Nome por Extenso</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo..."
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2 text-slate-705 outline-hidden"
                  />
                </div>

                <div className="space-y-1.55">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Login / Usuário (username)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: carl..."
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2 text-slate-705 font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.55">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Senha de login</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 555"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2 text-slate-705 font-mono outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase tracking-wide">Nível de Acesso (Cargo)</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full bg-white border border-slate-205 rounded-xl px-4 py-2 text-slate-705 cursor-pointer outline-hidden"
                  >
                    <option value="producao">Sara - Produção (Lança tarefas / paradas / vê histórico)</option>
                    <option value="supervisor">Supervisor / Gerência (Pode apagar dados / ver dashboard)</option>
                    <option value="visualizador">Somente Dashboard (Não acessa outras guias)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2 shadow-xs transition pt-2.5"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Usuário</span>
              </button>
            </form>

            {/* List */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex justify-between items-center">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Perfis de Logon Ativos</span>
                  <span className="text-[10px] font-mono font-bold text-slate-655 bg-slate-150 px-2 py-0.5 rounded-full">{usersList.length} credenciais</span>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto custom-scrollbar">
                  {usersList.map((u) => {
                    const isProtected = ['producao', 'lideranca', 'adm', 'visualizar'].includes(u.username.toLowerCase());
                    return (
                      <div key={u.username} className="px-5 py-3 flex justify-between items-center text-xs hover:bg-slate-50/50 transition">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2 select-none">
                            <span className="font-bold text-slate-700">{u.name}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              u.role === 'supervisor' ? 'bg-blue-50 text-blue-700' :
                              u.role === 'visualizador' ? 'bg-amber-50 text-amber-705' : 'bg-slate-100 text-slate-650'
                            }`}>
                              {u.role === 'supervisor' ? 'ADM/LIDER' :
                               u.role === 'visualizador' ? 'VISUALIZADOR' : 'OPERAÇÃO'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 font-mono text-[10px] text-slate-450">
                            <span>User: <strong className="text-slate-600">{u.username}</strong></span>
                            <span>Senha: <strong className="text-slate-600">{u.password}</strong></span>
                          </div>
                        </div>

                        {!isProtected && (
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                            title="Remover credenciais de acesso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
