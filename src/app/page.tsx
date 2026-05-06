"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import LoginScreen from '@/components/LoginScreen';
import LobbyScreen from '@/components/LobbyScreen';
import GameTable from '@/components/GameTable';
import { type StoredUser, type TableTier, STARTING_BALANCE } from '@/lib/game/game';

type AppScreen = 'login' | 'lobby' | 'game';

export default function DiceKingPage() {
  const [screen, setScreen] = useState<AppScreen>('login');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tableTier, setTableTier] = useState<TableTier>('bronze');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance, wins, losses')
          .eq('id', session.user.id)
          .maybeSingle();

        const u: StoredUser = {
          id: session.user.id,
          name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
          balance: profile?.balance || STARTING_BALANCE,
          wins: profile?.wins || 0,
          losses: profile?.losses || 0,
        };
        setUser(u);
        setScreen('lobby');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth event:', event, 'Session:', !!session);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[App] User identity confirmed. Transitioning to lobby immediately...');
        
        // ── STEP 1: Immediate Transition ──
        // We create a temporary user object so the UI can render right away
        const tempUser: StoredUser = {
          id: session.user.id,
          name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
          balance: STARTING_BALANCE, // Temporary balance
          wins: 0,
          losses: 0,
        };
        setUser(tempUser);
        setScreen('lobby');

        // ── STEP 2: Background Profile Load ──
        // We do this in a separate execution block so it doesn't block the UI
        (async () => {
          try {
            console.log('[App] Background profile fetch started...');
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('balance, wins, losses')
              .eq('id', session.user.id)
              .maybeSingle();

            if (error) {
              console.error('[App] Background profile fetch error:', error);
            }
            
            if (profile) {
              console.log('[App] Background profile load successful. Balance:', profile.balance);
              setUser(prev => prev ? { 
                ...prev, 
                balance: profile.balance || 0,
                wins: profile.wins || 0,
                losses: profile.losses || 0
              } : null);
            } else {
              console.log('[App] No profile found for this user yet.');
            }
          } catch (err) {
            console.error('[App] Background profile fetch failed:', err);
          }
        })();

      } else if (event === 'SIGNED_OUT') {
        console.log('[App] User signed out');
        setUser(null);
        setScreen('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleLogin(newUser: StoredUser) {
    setUser(newUser);
    setScreen('lobby');
  }

  function handleJoinTable(tier: TableTier) {
    setTableTier(tier);
    setScreen('game');
  }

  function handleLeaveTable(finalBalance: number) {
    if (user) {
      setUser({ ...user, balance: finalBalance });
    }
    setScreen('lobby');
  }

  function handleUpdateBalance(newBalance: number) {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  }

  if (screen === 'login' || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'lobby') {
    return (
      <LobbyScreen 
        user={user} 
        onJoinTable={handleJoinTable} 
        onUpdateBalance={handleUpdateBalance} 
      />
    );
  }

  return (
    <GameTable
      user={user}
      tableTier={tableTier}
      onLeave={handleLeaveTable}
      onUpdateBalance={handleUpdateBalance}
    />
  );
}
