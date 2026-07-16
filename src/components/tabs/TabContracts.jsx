import { Handshake } from 'lucide-react';

export default function TabContracts({ project }) {
  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Contracts</h2>
          <p className="tab-page-sub">Manage and sign agreements for {project?.name || 'the project'}.</p>
        </div>
      </div>
      
      <div 
        className="tab-card" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '4rem 2rem',
          textAlign: 'center',
          background: 'white',
          border: '1px solid #e9eef3',
          borderRadius: '14px',
          marginTop: '1.5rem'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: '#ecfdf5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#10b981',
          marginBottom: '1.25rem'
        }}>
          <Handshake size={32} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0b3d27', marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
          Under Development
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '380px', lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
          The Contracts management module is currently under development. Please check back later.
        </p>
      </div>
    </div>
  );
}