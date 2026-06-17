import { useState } from 'react';
import { APPOINTMENT_TEMPLATES } from '../../utils/templates';
import { formatCurrency } from '../../utils/helpers';
import { Printer, FileText } from 'lucide-react';

export default function TabContracts({ project }) {
  const [letterType,   setLetterType]   = useState('Landscape Consultancy');
  const [clientName,   setClientName]   = useState(project?.client_name || '');
  const [projectName,  setProjectName]  = useState(project?.name || '');
  const [fees,         setFees]         = useState(project?.budget ? Number(project.budget) * 0.05 : 150000);
  const [timeline,     setTimeline]     = useState('6 Months');

  const tpl      = APPOINTMENT_TEMPLATES[letterType] || { terms: [], schedule: [] };
  const terms    = tpl.terms;
  const schedule = tpl.schedule;

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Contract & Agreement</h2>
          <p className="tab-page-sub">Auto-generate legally drafted contracts based on project scope.</p>
        </div>
        <button className="btn-secondary" onClick={() => window.print()}>
          <Printer size={14} /> Print Agreement
        </button>
      </div>

      <div className="tab-split-280" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem' }}>

        {/* Config */}
        <div className="tab-card" style={{ height: 'fit-content' }}>
          <div className="tab-card-head"><span className="tab-card-title"><FileText size={14} /> Details</span></div>
          <div className="tab-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div className="form-group">
              <label>Agreement Type</label>
              <select value={letterType} onChange={e => setLetterType(e.target.value)} className="input-field">
                {Object.keys(APPOINTMENT_TEMPLATES).map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Client Name</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="input-field" />
            </div>
            <div className="form-group">
              <label>Project Name</label>
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="input-field" />
            </div>
            <div className="form-group">
              <label>Consolidated Fees (₹)</label>
              <input type="number" value={fees} onChange={e => setFees(Number(e.target.value))} className="input-field" />
            </div>
            <div className="form-group">
              <label>Timeline</label>
              <input type="text" value={timeline} onChange={e => setTimeline(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="document-preview-box">
          <div className="document-preview-title">{tpl.title}</div>
          <div style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>
            <p>This agreement is entered into this <strong>{new Date().toLocaleDateString('en-IN')}</strong> between <strong>{clientName}</strong> (the Client) and the principal consultants (the Designers) for the project <strong>{projectName}</strong>.</p>
            <br />
            <p><strong>1. SCOPE OF SERVICES:</strong> The consultants will deliver {letterType} services over a timeline of <strong>{timeline}</strong>.</p>
            <br />
            <p><strong>2. PROFESSIONAL FEES & PAYMENT SCHEDULE:</strong> Total agreed fees: <strong>{formatCurrency(fees)}</strong> (exclusive of taxes).</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', marginBottom: '1rem', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Milestone</th>
                  <th style={{ textAlign: 'right', padding: '4px' }}>%</th>
                  <th style={{ textAlign: 'right', padding: '4px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px' }}>{s.milestone}</td>
                    <td style={{ textAlign: 'right', padding: '4px' }}>{s.percent}%</td>
                    <td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency((fees * s.percent) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p><strong>3. TERMS & CONDITIONS:</strong></p>
            <ol style={{ marginLeft: '1.25rem', marginTop: '0.5rem' }}>
              {terms.map((t, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{t}</li>)}
            </ol>
          </div>
          <div className="document-signature-block">
            <div style={{ borderTop: '1px solid #333', width: '180px', textAlign: 'center', paddingTop: '6px', fontSize: '0.82rem' }}>Client Signature</div>
            <div style={{ borderTop: '1px solid #333', width: '180px', textAlign: 'center', paddingTop: '6px', fontSize: '0.82rem' }}>Consultant / Partner</div>
          </div>
        </div>
      </div>
    </div>
  );
}