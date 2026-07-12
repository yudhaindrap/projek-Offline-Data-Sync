const pool = require('./db');
const Database = require('better-sqlite3');
const path = require('path');

async function migrate() {
    // 1. PostgreSQL Migration
    try {
        console.log("Migrating PostgreSQL...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS experiment_sessions (
                id UUID PRIMARY KEY,
                experiment_name VARCHAR(255),
                description TEXT,
                network_mode VARCHAR(50),
                sampling_interval INT,
                started_at TIMESTAMP,
                finished_at TIMESTAMP,
                status VARCHAR(50),
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        const tables = ['sensor_data', 'actuator_logs', 'cv_results', 'harvest_predictions'];
        for (const table of tables) {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL`);
                console.log(`Added experiment_session_id to ${table} in PG`);
            } catch (err) {
                if (err.code !== '42701') { // 42701 is duplicate column error in PG
                    console.error(`Error adding column to ${table} in PG:`, err.message);
                }
            }
        }
        console.log("PostgreSQL Migration Complete.");
    } catch (e) {
        console.error("PG Migration Error:", e);
    }

    // 2. SQLite Migration
    try {
        console.log("Migrating SQLite...");
        const dbPath = path.resolve(__dirname, 'sense-maggot-edge.db');
        const db = new Database(dbPath);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS experiment_sessions (
                id TEXT PRIMARY KEY,
                experiment_name TEXT,
                description TEXT,
                network_mode TEXT,
                sampling_interval INTEGER,
                started_at TEXT,
                finished_at TEXT,
                status TEXT,
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_synced INTEGER DEFAULT 0,
                sync_attempt INTEGER DEFAULT 0,
                created_local_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_local_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const tables = ['sensor_data', 'actuator_logs', 'cv_results', 'harvest_predictions'];
        for (const table of tables) {
            try {
                db.exec(`ALTER TABLE ${table} ADD COLUMN experiment_session_id TEXT`);
                console.log(`Added experiment_session_id to ${table} in SQLite`);
            } catch (err) {
                if (!err.message.includes('duplicate column name')) {
                    console.error(`Error adding column to ${table} in SQLite:`, err.message);
                }
            }
        }
        console.log("SQLite Migration Complete.");
    } catch (e) {
        console.error("SQLite Migration Error:", e);
    }
}

migrate().then(() => process.exit(0));
