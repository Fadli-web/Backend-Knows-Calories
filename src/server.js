import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 CalorieKnows Backend Server running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`=========================================`);
});
