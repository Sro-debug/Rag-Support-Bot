import { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Shield, User } from "lucide-react";
import { api } from "../lib/api";

interface UserRecord {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.auth.users().then(setUsers).catch(console.error); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await api.auth.register(email, password, role);
      setSuccess(`User ${email} created`);
      setEmail(""); setPassword("");
      const updated = await api.auth.users();
      setUsers(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto">
      <header className="border-b border-ink-100 px-6 py-4 bg-white flex items-center gap-4 shrink-0">
        <button onClick={() => navigate("/chat")} className="btn-ghost px-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display font-semibold text-base">User Management</h1>
          <p className="text-xs text-ink-400">Manage team access</p>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Create user form */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-ink-900 mb-4 flex items-center gap-2">
            <UserPlus size={14} />
            Add new user
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="input-base col-span-2"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              className="input-base"
              minLength={8}
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-base"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>

            {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
            {success && <p className="col-span-2 text-xs text-green-600">{success}</p>}

            <button type="submit" className="btn-primary col-span-2" disabled={loading}>
              {loading ? "Creating…" : "Create user"}
            </button>
          </form>
        </div>

        {/* User list */}
        <div>
          <h2 className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-3">
            All Users ({users.length})
          </h2>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="card px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                  ${u.role === "admin" ? "bg-amber-100" : "bg-ink-100"}`}>
                  {u.role === "admin"
                    ? <Shield size={14} className="text-amber-600" />
                    : <User size={14} className="text-ink-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{u.email}</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {u.role} · joined {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${u.role === "admin"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-ink-100 text-ink-600"}`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
