import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../supabase';
import '../styles/login.css';

const BACKGROUND_IMAGE = 'https://ik.imagekit.io/greenspire/GreenDesk/login2.jpg?updatedAt=1781199271169';
const LOGO_URL         = 'https://ik.imagekit.io/greenspire/images/logo.webp?updatedAt=1776152708262';

export default function Login() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass]     = useState(false);

  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setErrorMsg('Invalid credentials. Please check your email and password.');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="lp-root">

      {/* ── Background ── */}
      <div className="lp-bg-slideshow">
        <img
          className="lp-bg-image"
          src={BACKGROUND_IMAGE}
          alt="GreenSpire Landscaping"
        />
        <div className="lp-bg-overlay" />
      </div>

      {/* ── Glass Card ── */}
      <div className="lp-glass-card animate-fade">

        {/* Brand */}
        <div className="lp-brand">
          <div className="lp-logo-wrap">
            <img
              src={LOGO_URL}
              alt="GreenSpire Solutions Logo"
              className="lp-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <span className="lp-logo-fallback" style={{ display: 'none' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 22c5-5 8-10 8-16a8 8 0 0 1 16 0c0 9-9 14-16 16z"/>
                <path d="M2 22L12 12"/>
              </svg>
            </span>
          </div>
          <div className="lp-brand-text">
            <div className="lp-brand-name">GreenSpire Solutions</div>
          </div>
        </div>

        {/* Heading */}
        <div className="lp-heading">
          <h1>Welcome Back</h1>
          <p>Sign in to manage your operations</p>
        </div>

        {/* Supabase warning */}
        {!isSupabaseConfigured && (
          <div className="lp-warn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Add your Supabase URL &amp; Anon Key to the{' '}
            <code>.env</code> file, then restart.
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="lp-error animate-fade">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="lp-form">

          <div className="lp-field">
            <label htmlFor="lp-email">Email Address</label>
            <div className="lp-input-wrap">
              <span className="lp-iicon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input
                id="lp-email"
                className="lp-input"
                type="email"
                required
                autoComplete="email"
                placeholder="you@greenspire.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="lp-field">
            <label htmlFor="lp-password">Password</label>
            <div className="lp-input-wrap">
              <span className="lp-iicon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="lp-password"
                className="lp-input lp-input-pass"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="lp-eye-btn"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="lp-btn" id="login-submit-btn" disabled={submitting}>
            {submitting ? (
              <><span className="lp-spinner" /> Signing in…</>
            ) : (
              <>
                Sign In
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </>
            )}
          </button>
        </form>


      </div>
    </div>
  );
}