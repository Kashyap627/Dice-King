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
          .select('balance')
          .eq('id', session.user.id)
          .maybeSingle();

        const u: StoredUser = {
          id: session.user.id,
          name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
          balance: profile?.balance || STARTING_BALANCE,
        };
        setUser(u);
        setScreen('lobby');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth event:', event, 'Session:', !!session);
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[App] User signed in. Waiting for session propagation...');
        
        // Wait a tiny bit for session to settle
        await new Promise(r => setTimeout(r, 500));

        try {
          console.log('[App] Fetching profile for ID:', session.user.id);
          
          // Race the profile fetch against a timeout
          const profilePromise = supabase
            .from('profiles')
            .select('balance')
            .eq('id', session.user.id)
            .maybeSingle();
            
          const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );

          const result = await Promise.race([profilePromise, timeout]) as any;
          const profile = result?.data;
          const error = result?.error;

          if (error) {
            console.error('[App] Profile fetch error:', error);
          }

          const u: StoredUser = {
            id: session.user.id,
            name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
            balance: profile?.balance ?? STARTING_BALANCE,
          };
          
          console.log('[App] Profile processing complete. Balance:', u.balance);
          setUser(u);
          setScreen('lobby');
        } catch (err) {
          console.error('[App] Catch block error during profile fetch:', err);
          // Fallback: Still let them in with default balance if we are sure they are signed in
          const u: StoredUser = {
            id: session.user.id,
            name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Player',
            balance: STARTING_BALANCE,
          };
          setUser(u);
          setScreen('lobby');
        }
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
