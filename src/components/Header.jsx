import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Menu, Loader2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import { supabase } from '../supabase';

export default function Header({ title }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const lastFetch = sessionStorage.getItem('alerts_last_fetch');
    const cached    = sessionStorage.getItem('alerts_cache');
    const fiveMin   = 5 * 60 * 1000;

    if (cached && lastFetch && Date.now() - Number(lastFetch) < fiveMin) {
      setAlerts(JSON.parse(cached));
      setLoadingAlerts(false);
      return;
    }
    fetchRealtimeAlerts();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchRealtimeAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const activeAlerts = [];

      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_number, due_date')
        .in('status', ['Unpaid', 'Overdue'])
        .lt('due_date', todayStr);

      (invoices || []).forEach(inv => {
        activeAlerts.push({
          id: `invoice-${inv.invoice_number}`,
          text: `Invoice #${inv.invoice_number} is overdue (due ${inv.due_date})`,
          type: 'danger',
          to: '/finance'
        });
      });

      const { data: drawings } = await supabase
        .from('site_drawings')
        .select('drawing_number, name')
        .in('status', ['Draft', 'Under Review']);

      (drawings || []).forEach(dwg => {
        activeAlerts.push({
          id: `drawing-${dwg.drawing_number}`,
          text: `Drawing ${dwg.drawing_number} — ${dwg.name} needs review`,
          type: 'warning',
          to: '/projects'
        });
      });

      const { data: plants } = await supabase
        .from('plants_inventory')
        .select('name, quantity_available, low_stock_threshold');

      (plants || []).forEach(p => {
        if (Number(p.quantity_available) < Number(p.low_stock_threshold)) {
          activeAlerts.push({
            id: `plant-${p.name}`,
            text: `Low stock: "${p.name}" (${p.quantity_available} left)`,
            type: 'warning',
            to: '/inventory'
          });
        }
      });

      const { data: materials } = await supabase
        .from('materials_inventory')
        .select('item_name, quantity_available, low_stock_threshold');

      (materials || []).forEach(m => {
        if (Number(m.quantity_available) < Number(m.low_stock_threshold)) {
          activeAlerts.push({
            id: `material-${m.item_name}`,
            text: `Low stock: "${m.item_name}" (${m.quantity_available} left)`,
            type: 'warning',
            to: '/inventory'
          });
        }
      });

      const { data: tasks } = await supabase
        .from('tasks')
        .select('name, deadline')
        .in('status', ['Pending', 'In Progress'])
        .lt('deadline', todayStr);

      (tasks || []).forEach(t => {
        activeAlerts.push({
          id: `task-${t.name}`,
          text: `Overdue task: "${t.name}" (was ${t.deadline})`,
          type: 'danger',
          to: '/projects'
        });
      });

      // Save to session cache
      sessionStorage.setItem('alerts_cache', JSON.stringify(activeAlerts));
      sessionStorage.setItem('alerts_last_fetch', Date.now().toString());

      setAlerts(activeAlerts);
    } catch (err) {
      console.error('Failed to query header alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleAlertClick = (to) => {
    setShowNotifications(false);
    navigate(to);
  };

  const dangerCount  = alerts.filter(a => a.type === 'danger').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <header className="gs-header">

      {/* Left — hamburger + title */}
      <div className="gs-header-left">
        <button
          className="gs-hamburger"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
          title="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <div className="gs-header-title-wrap">
          <h1 className="gs-header-title">{title || 'Management Console'}</h1>
        </div>
      </div>

      {/* Right — date + bell */}
      <div className="gs-header-right">

        {/* Date pill */}
        <div className="gs-date-pill">
          <Calendar size={13} />
          <span>{formatDate(new Date())}</span>
        </div>

        {/* Notification bell */}
        <div className="gs-notif-wrap" ref={dropdownRef}>
          <button
            className="gs-bell-btn"
            onClick={() => setShowNotifications(v => !v)}
            title="Alerts"
          >
            <Bell size={16} />
            {alerts.length > 0 && (
              <span className={`gs-bell-dot ${dangerCount > 0 ? 'danger' : 'warning'}`} />
            )}
          </button>

          {showNotifications && (
            <div className="gs-notif-dropdown">
              {/* Dropdown header */}
              <div className="gs-notif-head">
                <div className="gs-notif-head-left">
                  <span className="gs-notif-title">System Alerts</span>
                  {alerts.length > 0 && (
                    <span className="gs-notif-count">{alerts.length}</span>
                  )}
                </div>
                <div className="gs-notif-head-right">
                  {alerts.length > 0 && (
                    <button className="gs-notif-clear" onClick={() => {
                      setAlerts([]);
                      sessionStorage.removeItem('alerts_cache');
                      sessionStorage.removeItem('alerts_last_fetch');
                    }}>
                      Clear all
                    </button>
                  )}
                  <button className="gs-notif-close" onClick={() => setShowNotifications(false)}>
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Summary pills */}
              {alerts.length > 0 && (
                <div className="gs-notif-summary">
                  {dangerCount > 0 && (
                    <span className="gs-notif-pill danger">{dangerCount} critical</span>
                  )}
                  {warningCount > 0 && (
                    <span className="gs-notif-pill warning">{warningCount} warning</span>
                  )}
                </div>
              )}

              {/* Alert list */}
              <div className="gs-notif-list">
                {loadingAlerts && (
                  <div className="gs-notif-loading">
                    <Loader2 size={15} className="db-spin" />
                    <span>Checking alerts…</span>
                  </div>
                )}

                {!loadingAlerts && alerts.length === 0 && (
                  <div className="gs-notif-empty">
                    <span className="gs-notif-empty-icon">✓</span>
                    <span>All systems normal</span>
                  </div>
                )}

                {!loadingAlerts && alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`gs-alert-item ${alert.type}`}
                    onClick={() => handleAlertClick(alert.to)}
                  >
                    <div className="gs-alert-bar" />
                    <span className="gs-alert-text">{alert.text}</span>
                    <ArrowRight size={11} className="gs-alert-arrow" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}