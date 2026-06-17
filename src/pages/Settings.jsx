import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Key } from 'lucide-react';

export default function Settings() {
  const { profile, user } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Settings Console" />
        
        <main className="main-content animate-fade">
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Account Configurations</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>View your profile authorizations and setup connections.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} /> User Profile Information
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Full Name</span>
                  <strong>{profile?.full_name || 'Akash Admin'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Email Address</span>
                  <strong>{user?.email || 'admin@greenspire.com'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>System Authorization Role</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem' }}>
                    <Shield size={16} />
                    <span>{profile?.role || 'Admin'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.05rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} /> Credentials Setup
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <p>To hook up real-time notifications or database writes, populate your <strong>.env</strong> file at the root with Supabase endpoints.</p>
                <code style={{ display: 'block', backgroundColor: 'var(--bg)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
                  VITE_SUPABASE_URL=...<br />
                  VITE_SUPABASE_ANON_KEY=...
                </code>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
