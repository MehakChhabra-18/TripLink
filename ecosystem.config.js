# ─── TripLink PM2 Ecosystem Config ────────────────────────────────────────────
module.exports = {
  apps: [
    {
      name:          "triplink-api",
      script:        "./src/server.js",
      instances:     "max",        // Use all CPU cores
      exec_mode:     "cluster",    // Cluster mode for zero-downtime restarts
      watch:         false,
      max_memory_restart: "500M",

      env: {
        NODE_ENV: "development",
        PORT:     3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT:     3000,
      },

      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file:      "./logs/error.log",
      out_file:        "./logs/out.log",
      merge_logs:      true,

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime:   "5s",

      // Graceful shutdown
      kill_timeout:    5000,
      listen_timeout:  5000,
      shutdown_with_message: true,
    },
  ],
};
