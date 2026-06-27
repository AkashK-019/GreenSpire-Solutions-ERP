import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Briefcase, Settings, LogOut,
  UserCheck, DollarSign, Leaf, Users, BarChart3,
  ChevronRight, FileText
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/projects',      label: 'Projects',      icon: Briefcase },
  { path: '/quotations',    label: 'Quotations',    icon: FileText },
  { path: '/finance',       label: 'Finance',       icon: DollarSign },
  { path: '/inventory',     label: 'Inventory',     icon: Leaf },
  { path: '/labour',        label: 'Team',          icon: Users },    
  { path: '/reports',       label: 'Reports',       icon: BarChart3 },  
  { path: '/settings',      label: 'Settings',      icon: Settings },
];

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  const closeMobile = () => {
    if (window.innerWidth <= 850) setIsOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const adminName    = profile?.full_name || 'Admin';
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <>
      <aside className={`gs-sidebar ${isOpen ? 'open' : ''}`}>
        {/* ── Brand ── */}
        <div className="gs-brand">
          <div className="gs-logo-ring">
            <img
              src="https://ik.imagekit.io/greenspire/images/logo.webp?updatedAt=1776152708262"
              alt="GreenSpire"
              className="gs-logo-img"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
            <span className="gs-logo-fallback">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 22c5-5 8-10 8-16a8 8 0 0 1 16 0c0 9-9 14-16 16z"/>
                <path d="M2 22L12 12"/>
              </svg>
            </span>
          </div>
          <div className="gs-brand-text">
            <span className="gs-brand-name">GreenSpire</span>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="gs-scroll">
          <p className="gs-section-label">Main Menu</p>

          <nav className="gs-nav">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                onClick={closeMobile}
                className={({ isActive }) => `gs-link ${isActive ? 'active' : ''}`}
              >
                <span className="gs-link-icon"><Icon size={15} /></span>
                <span className="gs-link-label">{label}</span>
                <ChevronRight size={12} className="gs-link-arrow" />
              </NavLink>
            ))}
          </nav>
        </div>

        {/* ── Footer ── */}
        <div className="gs-footer">
          <div className="gs-user">
            <div className="gs-avatar">{adminInitial}</div>
            <div className="gs-user-info">
              <span className="gs-user-name">{adminName}</span>
            </div>
          </div>
          <button className="gs-signout" onClick={handleLogout}>
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />
    </>
  );
}