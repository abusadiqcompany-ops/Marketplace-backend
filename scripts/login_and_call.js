(async () => {
  try {
    const loginRes = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'developer@marketconnect.dev', password: 'MarketConnectDev2026!' })
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed:', loginJson);
      process.exit(1);
    }
    const token = loginJson.accessToken || loginJson.access_token || (loginJson.tokens && loginJson.tokens.accessToken);
    console.log('ACCESS_TOKEN:', token);

    const headers = { Authorization: `Bearer ${token}` };

    const statsRes = await fetch('http://localhost:3002/api/profile/stats', { headers });
    console.log('profile/stats status:', statsRes.status);
    console.log('profile/stats body:', await statsRes.text());

    const txRes = await fetch('http://localhost:3002/api/wallet/1/transactions', { headers });
    console.log('wallet/1/transactions status:', txRes.status);
    console.log('wallet/1/transactions body:', await txRes.text());
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
