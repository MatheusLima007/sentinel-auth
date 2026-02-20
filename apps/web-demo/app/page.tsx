'use client';

import { LoginResponse } from '@sentinel-auth/shared';
import { FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function HomePage() {
  const [email, setEmail] = useState('demo@local.dev');
  const [password, setPassword] = useState('Demo@12345');
  const [status, setStatus] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [me, setMe] = useState<unknown>(null);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('Autenticando...');

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, appId: 'demo-web' }),
    });

    if (!response.ok) {
      setStatus(`Falha no login (${response.status})`);
      return;
    }

    const data = (await response.json()) as LoginResponse;
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setStatus('Login realizado.');
  };

  const fetchMe = async () => {
    if (!accessToken) {
      setStatus('Faça login primeiro.');
      return;
    }

    const response = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401 && refreshToken) {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      if (!refreshResponse.ok) {
        setStatus(`Refresh falhou (${refreshResponse.status})`);
        return;
      }

      const refreshData = (await refreshResponse.json()) as {
        accessToken: string;
        refreshToken: string;
      };

      setAccessToken(refreshData.accessToken);
      setRefreshToken(refreshData.refreshToken);

      const retryResponse = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${refreshData.accessToken}` },
      });

      const retryData = await retryResponse.json();
      setMe(retryData);
      setStatus('Dados carregados após refresh.');
      return;
    }

    const meData = await response.json();
    setMe(meData);
    setStatus('Dados carregados.');
  };

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 16 }}>
      <h1>Sentinel Auth - Web Demo</h1>

      <form onSubmit={login} style={{ display: 'grid', gap: 8 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
        />
        <button type="submit">Login</button>
      </form>

      <button onClick={fetchMe}>Buscar /me</button>
      <p>{status}</p>

      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, overflow: 'auto' }}>
        {me ? JSON.stringify(me, null, 2) : 'Sem dados'}
      </pre>
    </main>
  );
}
