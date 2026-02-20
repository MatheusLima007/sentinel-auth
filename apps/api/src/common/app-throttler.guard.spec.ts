import { resolveThrottleTracker } from './app-throttler.guard';

describe('resolveThrottleTracker', () => {
  it('deve usar email como tracker no login', () => {
    const tracker = resolveThrottleTracker({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'Demo@Local.Dev ' },
      ip: '127.0.0.1',
    });

    expect(tracker).toBe('login-email:demo@local.dev');
  });

  it('deve usar ip quando login não tem email válido', () => {
    const tracker = resolveThrottleTracker({
      method: 'POST',
      path: '/auth/login',
      body: { email: '   ' },
      ip: '127.0.0.1',
    });

    expect(tracker).toBe('127.0.0.1');
  });

  it('deve usar ip fora da rota de login', () => {
    const tracker = resolveThrottleTracker({
      method: 'GET',
      path: '/me',
      body: { email: 'demo@local.dev' },
      ip: '10.0.0.1',
    });

    expect(tracker).toBe('10.0.0.1');
  });
});
