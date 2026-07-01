import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Construction } from 'lucide-react';

export default function Settings() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Settings Console" />
        <main
          className="main-content animate-fade"
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="stat-card"
            style={{
              padding: '3rem 2.5rem',
              textAlign: 'center',
              maxWidth: '420px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                margin: '0 auto 1.25rem',
              }}
            >
              <Construction size={30} />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Under Development
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              The Settings console is currently being rebuilt. Check back soon.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}