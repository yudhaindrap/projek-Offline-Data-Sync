const pool = require('./db');

async function migrateMetrics() {
    try {
        console.log("Migrating PostgreSQL for performance metrics...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id UUID PRIMARY KEY,
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE CASCADE,
                mqtt_latency_ms REAL,
                ws_latency_ms REAL,
                sync_duration_ms REAL,
                sync_throughput_rps REAL,
                queue_size INT,
                cpu_usage_pct REAL,
                memory_usage_mb REAL,
                disk_usage_mb REAL,
                sqlite_size_kb REAL,
                pg_insert_time_ms REAL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("PostgreSQL Migration Complete.");
    } catch (e) {
        console.error("PG Migration Error:", e);
    }
}

migrateMetrics().then(() => process.exit(0));
