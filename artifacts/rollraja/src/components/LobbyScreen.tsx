import React from 'react';
import { TABLE_BETS, TABLE_NAMES, type TableTier, STARTING_BALANCE } from '../lib/game';
import type { StoredUser } from '../lib/game';

interface LobbyScreenProps {
  user: StoredUser;
  onJoinTable: (tier: TableTier) => void;
}

const TABLE_TIERS: TableTier[] = ['bronze', 'silver', 'gold', 'vip'];

const TABLE_COLORS: Record<TableTier, { from: string; to: string; accent: string; icon: string }> = {
  bronze: { from: '#5c3a1e', to: '#3d2410', accent: '#cd7f32', icon: '⚔️' },
  silver: { from: '#4a5568', to: '#2d3748', accent: '#c0c0c0', icon: '🌙' },
  gold: { from: '#4a3820', to: '#2d2010', accent: '#ffd700', icon: '♛' },
  vip: { from: '#3b0764', to: '#1e0432', accent: '#c77dff', icon: '♚' },
};

const TABLE_DESC: Record<TableTier, string> = {
  bronze: 'A fine beginning. Entry stakes, high drama.',
  silver: 'Where seasoned players sharpen their edge.',
  gold: 'Only the bold dare enter these gilded halls.',
  vip: 'Exclusive. Invite the reckless and the regal.',
};

export default function LobbyScreen({ user, onJoinTable }: LobbyScreenProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 40%, #1a3a1a, #0a1a0a, #050a05)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 42, fontWeight: 900, lineHeight: 1, marginBottom: 8 }}>
          <span style={{ color: '#c9a84c' }}>Roll</span>
          <span style={{ color: '#f5f0e8' }}>Raja</span>
        </div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: '0.35em', color: 'rgba(201,168,76,0.6)' }}>
          THE LUXURY DICE SALON
        </div>

        <div className="gold-divider" style={{ margin: '16px auto', width: 300 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center' }}>
          <div style={{
            background: 'rgba(74,28,10,0.7)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 8,
            padding: '8px 20px',
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: 2 }}>
              BALANCE
            </div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, fontWeight: 700, color: '#c9a84c' }}>
              ₹{user.balance.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, color: '#f0e6d0' }}>
              Welcome, <span style={{ color: '#c9a84c' }}>{user.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rules banner */}
      <div style={{
        background: 'rgba(15,45,28,0.6)',
        border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: 8,
        padding: '12px 24px',
        marginBottom: 32,
        maxWidth: 600,
        width: '100%',
      }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.8)', marginBottom: 8, textAlign: 'center' }}>
          THE RULES OF ROLL RAJA
        </div>
        <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 12, color: 'rgba(240,230,208,0.7)', lineHeight: 1.7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
          <div>• Dice show only 1, 3, 4, 6</div>
          <div>• Double 1 or 3 → Roller loses</div>
          <div>• Double 4 or 6 → Roller wins</div>
          <div>• No double → Players swap turn</div>
          <div>• Loser sits out; winner stays on</div>
          <div>• 6 no-doubles → Roller wins by default</div>
          <div>• Spectators may place side bets</div>
          <div>• Min 3 players to start a round</div>
        </div>
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 600, width: '100%' }}>
        {TABLE_TIERS.map(tier => {
          const { from, to, accent, icon } = TABLE_COLORS[tier];
          const bet = TABLE_BETS[tier];
          const canAfford = user.balance >= bet * 2;
          return (
            <div
              key={tier}
              className="lobby-card"
              onClick={() => canAfford && onJoinTable(tier)}
              style={{
                background: `linear-gradient(160deg, ${from}, ${to})`,
                border: `2px solid ${canAfford ? accent : 'rgba(100,80,60,0.4)'}`,
                opacity: canAfford ? 1 : 0.5,
                cursor: canAfford ? 'pointer' : 'not-allowed',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, fontWeight: 700, color: accent, letterSpacing: '0.05em', marginBottom: 2 }}>
                {TABLE_NAMES[tier]}
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, color: 'rgba(240,230,208,0.8)', marginBottom: 8 }}>
                ₹{bet} per bet
              </div>
              <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 11, color: 'rgba(200,180,140,0.6)', lineHeight: 1.4 }}>
                {TABLE_DESC[tier]}
              </div>
              {!canAfford && (
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, color: '#e74c3c', marginTop: 6, letterSpacing: '0.1em' }}>
                  INSUFFICIENT FUNDS
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, fontFamily: 'Lato, sans-serif', fontSize: 11, color: 'rgba(200,160,80,0.4)', letterSpacing: '0.1em' }}>
        PLAY RESPONSIBLY • MINIMUM 3 PLAYERS PER TABLE
      </div>
    </div>
  );
}
