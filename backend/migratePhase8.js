const pool = require('./db');

async function migrate() {
    try {
        console.log("Creating Phase 8 tables in PostgreSQL (IEEE Paper Real Measurements)...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mqtt_latency_logs (
                id UUID PRIMARY KEY,
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE CASCADE,
                msg_id VARCHAR(255) NOT NULL,
                sent_at BIGINT,
                broker_received_at BIGINT,
                backend_received_at BIGINT,
                latency_ms INTEGER,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS websocket_latency_logs (
                id UUID PRIMARY KEY,
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE CASCADE,
                server_send_at BIGINT,
                browser_receive_at BIGINT,
                browser_render_at BIGINT,
                broadcast_latency_ms INTEGER,
                render_latency_ms INTEGER,
                e2e_latency_ms INTEGER,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS webrtc_latency_logs (
                id UUID PRIMARY KEY,
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE CASCADE,
                frame_id VARCHAR(255),
                capture_time BIGINT,
                encode_time BIGINT,
                transmit_time BIGINT,
                decode_time BIGINT,
                display_time BIGINT,
                latency_ms INTEGER,
                fps NUMERIC(5,2),
                bitrate INTEGER,
                jitter NUMERIC(8,2),
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("PostgreSQL Phase 8 migration complete.");
    } catch (e) {
        console.error("PG Migration Phase 8 Error:", e);
    }
}

migrate().then(() => process.exit(0));
