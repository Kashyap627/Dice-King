import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import LobbyScreen from './components/LobbyScreen';
import GameTable from './components/GameTable';
import { loadUser, saveUser, type StoredUser, type TableTier } from './lib/game';

type AppScreen = 'login' | 'lobby' | 'game';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('login');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tableTier, setTableTier] = useState<TableTier>('bronze');

  useEffect(() => {
    const saved = loadUser();
    if (saved) {
      setUser(saved);
      setScreen('lobby');
    }
  }, []);

  function handleLogin(newUser: StoredUser) {
    setUser(newUser);
    saveUser(newUser);
    setScreen('lobby');
  }

  function handleJoinTable(tier: TableTier) {
    setTableTier(tier);
    setScreen('game');
  }

  function handleLeaveTable(finalBalance: number) {
    if (user) {
      const updated = { ...user, balance: finalBalance };
      setUser(updated);
      saveUser(updated);
    }
    setScreen('lobby');
  }

  if (screen === 'login' || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'lobby') {
    return <LobbyScreen user={user} onJoinTable={handleJoinTable} />;
  }

  return (
    <GameTable
      user={user}
      tableTier={tableTier}
      onLeave={handleLeaveTable}
    />
  );
}
