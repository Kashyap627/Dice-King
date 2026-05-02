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
  const [roomId, setRoomId] = useState<string>('');

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
      if (event === 'SIGNED_IN' && session?.user) {
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
      } else if (event === 'SIGNED_OUT') {
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
    setRoomId(`tier_${tier}_1`);
    setScreen('game');
  }

  function handleRoomFull(currentRoomId: string) {
    // Extract room number and increment it
    const parts = currentRoomId.split('_');
    const num = parseInt(parts[parts.length - 1]);
    const nextNum = num + 1;
    const nextRoomId = [...parts.slice(0, -1), nextNum].join('_');
    
    setRoomId(nextRoomId);
    // The GameTable will re-render and join the new room automatically
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
      roomId={roomId}
      onLeave={handleLeaveTable}
      onRoomFull={handleRoomFull}
      onUpdateBalance={handleUpdateBalance}
    />
  );
}
