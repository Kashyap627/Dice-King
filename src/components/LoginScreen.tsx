import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type StoredUser, STARTING_BALANCE } from '../lib/game/game';

interface LoginScreenProps {
  onLogin: (user: StoredUser) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [particles, setParticles] = useState<{ id: number; left: number; dur: number; delay: number }[]>([]);

  // Generate particles
  useEffect(() => {
    const pts = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      dur: 3 + Math.random() * 4,
      delay: Math.random() * 5,
    }));
    setParticles(pts);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setMessage('Password reset link sent! Check your email.');
        return;
      }

      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() }
          }
        });
        if (signupError) throw signupError;
        if (data.user) {
          const user: StoredUser = {
            id: data.user.id,
            name: name.trim(),
            balance: STARTING_BALANCE,
          };
          onLogin(user);
        }
      } else {
        const { data, error: signinError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signinError) throw signinError;
        if (data.user) {
          // Check profile balance
          const { data: profile } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', data.user.id)
            .maybeSingle();

          const user: StoredUser = {
            id: data.user.id,
            name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || 'Player',
            balance: profile?.balance || STARTING_BALANCE,
          };
          onLogin(user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const getTitle = () => {
    if (mode === 'signup') return 'Create Account';
    if (mode === 'forgot') return 'Reset Password';
    return 'Welcome';
  };

  const getSubTitle = () => {
    if (mode === 'signup') return 'Join the luxury tables';
    if (mode === 'forgot') return 'Enter your email to receive a recovery link';
    return 'Enter your credentials to access the table';
  };

  return (
    <div className="screen active" id="screen-login">
      {/* Particles */}
      <div className="login-particles" id="login-particles">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.left}%`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="login-ornament"></div>

      <div className="login-box">
        <div className="logo">
          <span className="logo-crown">♛</span>
          <span className="logo-title">ROLLRAJA</span>
          <div className="logo-sub">Premium Dice Experience</div>
          <div className="logo-divider"></div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <h2>{getTitle()}</h2>
          <p>{getSubTitle()}</p>

          {mode === 'signup' && (
            <div className="field">
              <label>Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="player@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              suppressHydrationWarning
            />
          </div>

          {mode !== 'forgot' && (
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="link-btn"
                    style={{ fontSize: '10px', textDecoration: 'none', color: '#b8a880', marginBottom: '7px' }}
                    onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                suppressHydrationWarning
              />
            </div>
          )}

          {error && (
            <div style={{ color: '#ff8a80', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{ color: '#6fcf97', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
              {message}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Processing...' : (mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Enter the Table')}
          </button>

          <div style={{ marginTop: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="link-btn"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}
            >
              {mode === 'signin' ? "New player? Create an account" : (mode === 'forgot' ? "← Back to Login" : "← Back to Login")}
            </button>
            
            {/* Rescue button for stuck users */}
            <button 
              type="button" 
              className="link-btn" 
              style={{ fontSize: '11px', opacity: 0.6 }}
              onClick={() => window.location.reload()}
            >
              Page not loading? Refresh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
