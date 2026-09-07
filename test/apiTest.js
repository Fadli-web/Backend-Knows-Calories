import app from '../src/app.js';

const server = app.listen(0, async () => {
  try {
    const port = server.address().port;
    console.log(`Testing /api/health on port ${port}...`);
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const health = await res.json();
    console.log('Health Response:', health);

    console.log('Testing Root / ...');
    const rootRes = await fetch(`http://127.0.0.1:${port}/`);
    const rootData = await rootRes.json();
    console.log('Root Service:', rootData.name);

    console.log('Testing Protected Route /api/auth/profile without token ...');
    const authRes = await fetch(`http://127.0.0.1:${port}/api/auth/profile`);
    const authData = await authRes.json();
    console.log('Protected Route Status:', authRes.status, authData);

    if (health.status === 'ok' && rootData.name === 'CalorieKnows Backend API' && authRes.status === 401) {
      console.log('✅ Express Server, Protected Routes & Auth Middleware Verified Successfully!');
    } else {
      throw new Error('API Health or Auth Check failed');
    }
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    server.close(() => {
      process.exit(0);
    });
  }
});
