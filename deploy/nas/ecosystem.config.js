module.exports = {
  apps: [
    {
      name: 'training-assistant',
      script: 'pnpm',
      args: 'start',
      cwd: '/volume1/web/training-assistant',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: 'postgresql://training_user:your_password@localhost:5432/training_db',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/training-assistant/error.log',
      out_file: '/var/log/training-assistant/out.log',
      log_file: '/var/log/training-assistant/combined.log',
      time: true,
    },
  ],
};
