import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function App() {
  const [email, setEmail] = useState('demo@local.dev');
  const [password, setPassword] = useState('Demo@12345');
  const [status, setStatus] = useState('');
  const [me, setMe] = useState('Sem dados');

  const login = async () => {
    setStatus('Autenticando...');

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, appId: 'demo-mobile' }),
    });

    if (!response.ok) {
      setStatus(`Falha no login (${response.status})`);
      return;
    }

    const data = await response.json();

    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);

    setStatus('Login realizado.');
  };

  const loadMe = async () => {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    const refreshToken = await SecureStore.getItemAsync('refreshToken');

    if (!accessToken || !refreshToken) {
      setStatus('Faça login primeiro.');
      return;
    }

    const response = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      if (!refreshResponse.ok) {
        setStatus(`Refresh falhou (${refreshResponse.status})`);
        return;
      }

      const refreshData = await refreshResponse.json();
      await SecureStore.setItemAsync('accessToken', refreshData.accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshData.refreshToken);

      const retryResponse = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${refreshData.accessToken}` },
      });
      const retryData = await retryResponse.json();
      setMe(JSON.stringify(retryData, null, 2));
      setStatus('Dados carregados após refresh.');
      return;
    }

    const meData = await response.json();
    setMe(JSON.stringify(meData, null, 2));
    setStatus('Dados carregados.');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>Sentinel Auth Mobile Demo</Text>

        <View style={{ gap: 8 }}>
          <Text>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text>Senha</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          />
        </View>

        <Button title="Login" onPress={login} />
        <Button title="Buscar /me" onPress={loadMe} />

        <Text>{status}</Text>
        <Text selectable style={{ fontFamily: 'monospace' }}>
          {me}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
