import React, { useState } from 'react';
import { generateOtp, generateUserId, getAvatarInitials, saveUser, type StoredUser } from '../lib/game';

interface LoginScreenProps {
  onLogin: (user: StoredUser) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [error, setError] = useState('');

  function handleSendOtp() {
    if (!phone || phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    if (!name || name.trim().length < 2) { setError('Enter your name (min 2 characters)'); return; }
    const o = generateOtp();
    setGeneratedOtp(o);
    setOtp(o);
    setError('');
    setStep('otp');
  }

  function handleVerifyOtp() {
    if (inputOtp === generatedOtp) {
      const user: StoredUser = {
        id: generateUserId(),
        name: name.trim(),
        phone,
        balance: 500,
      };
      saveUser(user);
      onLogin(user);
    } else {
      setError('Invalid OTP. Please try again.');
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card fade-in">
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
            <span style={{ color: '#c9a84c' }}>Roll</span>
            <span style={{ color: '#f5f0e8' }}>Raja</span>
          </div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: '0.3em', color: 'rgba(201,168,76,0.7)', marginTop: 4 }}>
            LUXURY DICE • EST. 2024
          </div>
        </div>

        <div className="gold-divider" />

        {step === 'phone' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <label style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(201,168,76,0.8)', display: 'block', marginBottom: 6 }}>
                YOUR NAME
              </label>
              <input
                className="luxury-input"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(201,168,76,0.8)', display: 'block', marginBottom: 6 }}>
                MOBILE NUMBER
              </label>
              <input
                className="luxury-input"
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            {error && (
              <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 12, color: '#e74c3c', textAlign: 'center' }}>{error}</div>
            )}
            <button className="btn-gold" style={{ marginTop: 6 }} onClick={handleSendOtp}>
              Send OTP
            </button>
            <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 11, color: 'rgba(240,230,208,0.4)', textAlign: 'center' }}>
              New players receive ₹500 welcome bonus
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: 'rgba(201,168,76,0.8)', textAlign: 'center', letterSpacing: '0.1em' }}>
              OTP SENT TO +91 {phone}
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(201,168,76,0.5)', display: 'block', marginBottom: 6 }}>
                YOUR OTP (DEMO — SHOWN BELOW)
              </label>
              <div className="otp-display">{otp}</div>
            </div>

            <div>
              <label style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(201,168,76,0.8)', display: 'block', marginBottom: 6 }}>
                ENTER OTP
              </label>
              <input
                className="luxury-input"
                type="text"
                placeholder="6-digit OTP"
                value={inputOtp}
                onChange={e => setInputOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                autoFocus
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: '0.2em' }}
              />
            </div>

            {error && (
              <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 12, color: '#e74c3c', textAlign: 'center' }}>{error}</div>
            )}
            <button className="btn-gold" onClick={handleVerifyOtp}>
              Verify & Enter
            </button>
            <button
              className="btn-ivory"
              style={{ fontSize: 11 }}
              onClick={() => { setStep('phone'); setError(''); setInputOtp(''); }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
