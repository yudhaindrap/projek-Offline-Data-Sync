const Database = require('better-sqlite3');
const path = require('path');

// Initialize the database in the root of the backend directory
const dbPath = path.resolve(__dirname, '../sense-maggot-edge.db');
const db = new Database(dbPath);

// Enable WAL mode
db.pragma('journal_mode = WAL');

// Initialize schemas
const initSchemas = () => {
    // Experiment Sessions Table
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

    // Sensor Data Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sensor_data (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            box_id TEXT,
            temperature REAL,
            humidity_air REAL,
            humidity_media REAL,
            source TEXT,
            experiment_session_id TEXT,
            recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 0,
            sync_attempt INTEGER DEFAULT 0,
            created_local_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_local_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Actuator Logs Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS actuator_logs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            box_id TEXT,
            threshold_id TEXT,
            actuator_type TEXT,
            action TEXT,
            trigger_source TEXT,
            notes TEXT,
            experiment_session_id TEXT,
            recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 0,
            sync_attempt INTEGER DEFAULT 0,
            created_local_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_local_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // CV Results Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS cv_results (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            box_id TEXT,
            baby_larva_count INTEGER DEFAULT 0,
            adult_larva_count INTEGER DEFAULT 0,
            prepupa_count INTEGER DEFAULT 0,
            pupa_count INTEGER DEFAULT 0,
            dominant_phase TEXT,
            confidence REAL,
            image_path TEXT,
            experiment_session_id TEXT,
            recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 0,
            sync_attempt INTEGER DEFAULT 0,
            created_local_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_local_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Harvest Predictions Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS harvest_predictions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            box_id TEXT,
            sensor_data_id TEXT,
            cv_result_id TEXT,
            predicted_days INTEGER,
            input_temperature REAL,
            input_humidity_air REAL,
            input_humidity_media REAL,
            experiment_session_id TEXT,
            predicted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 0,
            sync_attempt INTEGER DEFAULT 0,
            created_local_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_local_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Notifications Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            box_id TEXT,
            category TEXT,
            severity TEXT,
            title TEXT,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 0,
            sync_attempt INTEGER DEFAULT 0,
            created_local_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_local_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);
    // Sync Queue Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            entity_name TEXT,
            entity_id TEXT,
            operation TEXT,
            payload TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'PENDING',
            retry_count INTEGER DEFAULT 0,
            last_retry TEXT
        );
    `);
};

initSchemas();

module.exports = db;
