import React, { FormEvent, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';

export type ManagedUserRole =
  | 'administrador'
  | 'lideranca'
  | 'apoio'
  | 'producao'
  | 'visualizador';

export interface ManagedUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: ManagedUserRole;
}

export interface NewUserPayload {
  email: string;
  username: string;
  name: string;
  password: string;
  role: ManagedUserRole;
}

interface AdminUsersManagementProps {
  users: ManagedUser[];
  currentUserName: string;
  loading: boolean;
  onCreateUser: (payload: NewUserPayload) => Promise<boolean>;
  onDeleteUser: (user: ManagedUser) => Promise<boolean>;
}

const ROLE_LABELS: Record<ManagedUserRole, string> = {
  administrador: 'Administrador',
  lideranca: 'Liderança',
  apoio: 'Apoio',
  producao: 'Produção',
  visualizador: 'Visualizador',
};

const ROLE_BADGES: Record<ManagedUserRole, string> = {
  administrador: 'bg-purple-50 text-purple-700 border-purple-200',
  lideranca: 'bg-blue-50 text-blue-700 border-blue-200',
  apoio: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  producao: 'bg-amber-50 text-amber-700 border-amber-200',
  visualizador: 'bg-slate-50 text-slate-700 border-slate-200',
};

const ROLE_OPTIONS: ManagedUserRole[] = [
  'administrador',
  'lideranca',
  'apoio',
  'producao',
  'visualizador',
];

const normalizeRole = (role: string): ManagedUserRole => {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'liderança') return 'lideranca';
  if (normalized === 'produção') return 'producao';

  if (
    normalized === 'administrador' ||
    normalized === 'lideranca' ||
    normalized === 'apoio' ||
    normalized === 'producao' ||
    normalized === 'visualizador'
  ) {
    return normalized;
  }

  return 'visualizador';
};

const AdminUsersManagement: React.FC<AdminUsersManagementProps> = ({
  users,
  currentUserName,
  loading,
  onCreateUser,
  onDeleteUser,
}) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ManagedUserRole>('apoio');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail || !normalizedUsername || !normalizedName || !password) {
      alert('Preencha e-mail, login, nome e senha.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      alert('Informe um e-mail válido.');
      return;
    }

    if (password.length < 6) {
      alert('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (normalizedUsername === 'adm') {
      alert('O login "adm" é reservado para a conta administrativa principal.');
      return;
    }

    if (users.some(
      user => user.username.trim().toLowerCase() === normalizedUsername
    )) {
      alert('Este login de usuário já está cadastrado.');
      return;
    }

    if (users.some(
      user => user.email.trim().toLowerCase() === normalizedEmail
    )) {
      alert('Este e-mail já está cadastrado.');
      return;
    }

    setSaving(true);

    try {
      const success = await onCreateUser({
        email: normalizedEmail,
        username: normalizedUsername,
        name: normalizedName,
        password,
        role,
      });

      if (!success) return;

      setEmail('');
      setUsername('');
      setName('');
      setPassword('');
      setRole('apoio');

      alert(`Usuário "${normalizedName}" criado com sucesso.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="pb-4 border-b border-slate-100 mb-6">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Controle de Usuários e Permissões de Acesso
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Gerencie as contas autenticadas do sistema. As senhas pertencem ao Supabase Auth e não são armazenadas na tabela de perfis.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
        >
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            Novo usuário
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="usuario@empresa.com.br"
              autoComplete="off"
              className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Login
            </label>
            <input
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="usuario"
              autoComplete="off"
              className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Nome completo"
              autoComplete="off"
              className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Senha inicial
            </label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Mínimo de 6 caracteres"
              autoComplete="new-password"
              className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Usada somente para criar a conta Auth. Não é gravada em <code>profiles</code>.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Perfil / permissões
            </label>
            <select
              value={role}
              onChange={event => setRole(normalizeRole(event.target.value))}
              className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {ROLE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {saving ? 'Criando...' : 'Criar usuário'}
          </button>
        </form>

        <div className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Usuários cadastrados ({users.length})
              </h3>
              <p className="text-xs text-slate-400">
                Contas com acesso ao sistema vinculadas a <code>public.profiles</code>.
              </p>
            </div>
            {loading && (
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Carregando...
              </span>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Login</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Nome</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">E-mail</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Perfil</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => {
                    const isProtected = user.username === 'adm';
                    const isCurrent = user.name === currentUserName && user.username === 'adm';

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">{user.username}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{user.email || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-black uppercase ${ROLE_BADGES[user.role]}`}>
                            {user.role === 'administrador' && <ShieldCheck className="w-3 h-3" />}
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isProtected || isCurrent ? (
                            <span className="text-[10px] text-slate-400 italic">
                              Sistema protegido
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onDeleteUser(user)}
                              className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 rounded-md px-2.5 py-1.5 text-[10px] font-bold transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir acesso
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminUsersManagement;
