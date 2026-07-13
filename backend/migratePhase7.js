const pool = require('./db');
const localDb = require('./edge/localDatabase');

async function migrate() {
    try {
        console.log("Creating Phase 7 tables in PostgreSQL (Research Evaluation Engine)...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS experiment_metrics_log (
                id UUID PRIMARY KEY,
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE CASCADE,
                metric_type VARCHAR(50) NOT NULL, -- mqtt, ws, webrtc, sync, network
                payload JSONB NOT NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("PostgreSQL migration complete.");
    } catch (e) {
        console.error("PG Migration Error:", e);
    }
}

migrate().then(() => process.exit(0));
