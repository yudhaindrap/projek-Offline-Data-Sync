const pool = require('./db');
const localDb = require('./edge/localDatabase');

async function migrate() {
    try {
        console.log("Adding Phase 6 columns to PostgreSQL...");
        await pool.query(`ALTER TABLE experiment_sessions ADD COLUMN IF NOT EXISTS dataset_name VARCHAR(255);`);
        await pool.query(`ALTER TABLE experiment_sessions ADD COLUMN IF NOT EXISTS replay_speed NUMERIC(5,2);`);
        await pool.query(`ALTER TABLE experiment_sessions ADD COLUMN IF NOT EXISTS metrics JSONB;`);
        console.log("PostgreSQL migration complete.");
    } catch (e) {
        console.error("PG Migration Error:", e);
    }

    try {
        console.log("Adding Phase 6 columns to SQLite...");
        const columns = [
            { name: 'dataset_name', type: 'TEXT' },
            { name: 'replay_speed', type: 'REAL' },
            { name: 'metrics', type: 'TEXT' }
        ];

        for (const col of columns) {
            try {
                localDb.prepare(`ALTER TABLE experiment_sessions ADD COLUMN ${col.name} ${col.type}`).run();
                console.log(`Added ${col.name} to SQLite`);
            } catch (err) {
                if (!err.message.includes('duplicate column name')) {
                    console.error(`Error adding ${col.name}:`, err);
                }
            }
        }
        console.log("SQLite migration complete.");
    } catch (e) {
        console.error("SQLite Migration Error:", e);
    }
}

migrate().then(() => process.exit(0));
