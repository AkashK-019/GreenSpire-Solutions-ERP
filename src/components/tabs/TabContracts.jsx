import { FileSignature } from 'lucide-react';

export default function TabContracts({ project }) {
  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Contracts</h2>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 2rem',
        textAlign: 'center',
        gap: '1rem'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.5rem'
        }}>
          <FileSignature size={32} style={{ color: '#10b981' }} />
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0b3d27', margin: 0 }}>
          Contracts
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: '340px', lineHeight: 1.6, margin: 0 }}>
          Contract management is coming soon. You will be able to create, track and e-sign project contracts from here.
        </p>
      </div>
    </div>
  );
}