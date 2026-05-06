import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TABLE_BETS, TABLE_NAMES, type TableTier } from '../lib/game/game';
import type { StoredUser } from '../lib/game/game';

interface LobbyScreenProps {
  user: StoredUser;
  onJoinTable: (tier: TableTier) => void;
  onUpdateBalance: (newBalance: number) => void;
}

const TABLE_TIERS: TableTier[] = ['bronze', 'silver', 'gold', 'vip'];

const TABLE_ICONS: Record<TableTier, string> = {
  bronze: '⚔️',
  silver: '🌙',
  gold: '♛',
  vip: '♚',
};

const TABLE_DESC: Record<TableTier, string> = {
  bronze: 'Entry stakes, high drama.',
  silver: 'Where seasoned players sharpen their edge.',
  gold: 'Only the bold dare enter these gilded halls.',
  vip: 'Exclusive. Invite the reckless and the regal.',
};

export default function LobbyScreen({ user, onJoinTable, onUpdateBalance }: LobbyScreenProps) {
  const [activeTab, setActiveTab] = useState<'lobby' | 'account'>('lobby');
  const [addAmount, setAddAmount] = useState('');
  const [withAmount, setWithAmount] = useState('');
  const [stats, setStats] = useState({ wins: 0, losses: 0, games: 0, earned: 0 });
  const [txns, setTxns] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'account') {
      loadAccountData();
    }
  }, [activeTab]);

  async function loadAccountData() {
    try {
      // Load stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('wins, losses, games_played, total_earned')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setStats({
          wins: profile.wins || 0,
          losses: profile.losses || 0,
          games: profile.games_played || 0,
          earned: Number(profile.total_earned || 0)
        });
      }
    } catch (err) {
      console.error('[Lobby] Error loading account data:', err);
    }

    try {
      // Load txns
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (transactions) {
        setTxns(transactions);
      }
    } catch (err) {
      console.error('[Lobby] Error loading transactions:', err);
    }
  }

  async function handleAddFunds() {
    const amt = parseInt(addAmount);
    if (!amt || amt <= 0) return;
    const { data, error } = await supabase.rpc('credit_balance', {
      p_user_id: user.id,
      p_amount: amt,
      p_label: 'Added Funds',
    });
    if (!error && data !== null) {
      onUpdateBalance(Number(data));
      setAddAmount('');
      loadAccountData();
    }
  }

  async function handleWithdraw() {
    const amt = parseInt(withAmount);
    if (!amt || amt <= 0) return;
    if (amt > user.balance) {
      alert("Insufficient balance");
      return;
    }
    const { data, error } = await supabase.rpc('deduct_balance', {
      p_user_id: user.id,
      p_amount: amt,
      p_label: 'Withdrawal',
    });
    if (!error && data !== null) {
      onUpdateBalance(Number(data));
      setWithAmount('');
      loadAccountData();
    }
  }

  return (
    <div className="screen active" id="screen-app" style={{ display: 'flex' }}>
      <div className="topbar">
        <div className="topbar-logo">♛ ROLLRAJA</div>
        <div className="topbar-right">
          <div className="balance-chip">₹<span id="topbar-balance">{user.balance.toLocaleString()}</span></div>
          <div 
            className="avatar" 
            onClick={() => setActiveTab('account')}
          >
            {user.name.slice(0,2).toUpperCase()}
          </div>
          <button 
            onClick={() => supabase.auth.signOut()}
            style={{
              background: 'none', border: '1px solid rgba(212,168,67,0.4)', borderRadius: 4,
              color: 'rgba(212,168,67,0.8)', fontFamily: 'Cinzel, serif', fontSize: 9,
              padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.1em'
            }}
          >
            SIGN OUT
          </button>
        </div>
      </div>

      <div className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'lobby' ? 'active' : ''}`} 
          onClick={() => setActiveTab('lobby')}
        >
          🎲 Tables
        </button>
        <button 
          className={`nav-tab ${activeTab === 'account' ? 'active' : ''}`} 
          onClick={() => setActiveTab('account')}
        >
          ♛ Account
        </button>
      </div>

      {activeTab === 'lobby' && (
        <div className="page active" id="page-lobby">
          <div className="page-title">The Tables</div>
          <div className="page-sub">Choose your stakes. Minimum 2 players to begin a round.</div>
          <div className="page-divider"></div>
          <div className="tables-grid">
            {TABLE_TIERS.map(tier => {
              const bet = TABLE_BETS[tier];
              const canAfford = user.balance >= bet;
              return (
                <div key={tier} className="table-card" onClick={() => canAfford && onJoinTable(tier)}>
                  <span className="table-card-icon">{TABLE_ICONS[tier]}</span>
                  <div className="table-card-header">
                    <span className="table-name">{TABLE_NAMES[tier]}</span>
                    <span className={`table-badge ${canAfford ? 'badge-open' : 'badge-waiting'}`}>
                      {canAfford ? 'OPEN' : 'LOCKED'}
                    </span>
                  </div>
                  <div className="table-divider"></div>
                  <div className="table-info">
                    <div className="table-stat">
                      <span className="table-stat-label">Entry Bet</span>
                      <span className="table-stat-val">₹{bet}</span>
                    </div>
                    <div className="table-stat">
                      <span className="table-stat-label">Description</span>
                      <span className="table-stat-val" style={{ fontSize: 11, textAlign: 'right', maxWidth: '60%' }}>
                        {TABLE_DESC[tier]}
                      </span>
                    </div>
                  </div>
                  <button className="btn-join" disabled={!canAfford}>
                    {canAfford ? 'ENTER TABLE' : 'INSUFFICIENT FUNDS'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="page active" id="page-account">
          <div className="page-title">My Account</div>
          <div className="page-sub">Welcome back, {user.name}.</div>
          <div className="page-divider"></div>
          
          <div className="account-grid">
            <div className="acc-card">
              <h3>💰 Balance</h3>
              <div className="balance-big">₹{user.balance.toLocaleString()}</div>
              <div className="balance-label">Indian Rupees</div>
              <div className="stats-grid">
                <div className="stat-box"><div className="stat-val" style={{ color: '#6fcf97' }}>{stats.wins}</div><div className="stat-lbl">Wins</div></div>
                <div className="stat-box"><div className="stat-val" style={{ color: '#ff8a80' }}>{stats.losses}</div><div className="stat-lbl">Losses</div></div>
                <div className="stat-box"><div className="stat-val">{stats.games}</div><div className="stat-lbl">Rounds</div></div>
                <div className="stat-box"><div className="stat-val" style={{ color: 'var(--gold2)' }}>₹{stats.earned.toLocaleString()}</div><div className="stat-lbl">Earned</div></div>
              </div>
            </div>

            <div className="acc-card">
              <h3>➕ Add Funds</h3>
              <div className="money-form">
                <input 
                  type="number" 
                  placeholder="Amount (₹)" 
                  value={addAmount} 
                  onChange={e => setAddAmount(e.target.value)} 
                />
                <div className="quick-amts">
                  {[100, 500, 1000, 5000].map(amt => (
                    <button key={amt} className="quick-amt" onClick={() => setAddAmount(amt.toString())}>
                      ₹{amt >= 1000 ? amt/1000 + 'K' : amt}
                    </button>
                  ))}
                </div>
                <button className="btn-green" onClick={handleAddFunds}>Add Funds</button>
              </div>
            </div>

            <div className="acc-card" style={{ gridColumn: 1 }}>
              <h3>💸 Withdraw</h3>
              <div className="money-form">
                <input 
                  type="number" 
                  placeholder="Amount (₹)" 
                  value={withAmount} 
                  onChange={e => setWithAmount(e.target.value)} 
                />
                <div className="quick-amts">
                  {[100, 500, 1000].map(amt => (
                    <button key={amt} className="quick-amt" onClick={() => setWithAmount(amt.toString())}>
                      ₹{amt >= 1000 ? amt/1000 + 'K' : amt}
                    </button>
                  ))}
                </div>
                <button className="btn-red-outline" onClick={handleWithdraw}>Withdraw</button>
              </div>
            </div>

            <div className="acc-card" style={{ gridColumn: 2, gridRow: '2/4' }}>
              <h3>📋 Transactions</h3>
              <div className="txn-list">
                {txns.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: 20 }}>
                    No recent transactions
                  </div>
                ) : (
                  txns.map(t => (
                    <div key={t.id} className="txn-item">
                      <div>
                        <div className="txn-name">{t.label}</div>
                        <div className="txn-date">{new Date(t.created_at).toLocaleString()}</div>
                      </div>
                      <div className={`txn-amt ${t.type === 'credit' ? 'txn-pos' : 'txn-neg'}`}>
                        {t.type === 'credit' ? '+' : '-'}₹{t.amount}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
