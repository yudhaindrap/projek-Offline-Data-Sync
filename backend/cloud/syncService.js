const crypto = require('crypto');

class SyncService {
    constructor(db) {
        this.db = db; // Cloud PostgreSQL DB Pool
        this.initTable();
    }

    async initTable() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS sync_logs (
                    id UUID PRIMARY KEY,
                    batch_size INT,
                    accepted INT,
                    duplicates INT,
                    failed INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sync_duration_ms INT DEFAULT 0
                );
            `);
            // Seamlessly upgrade existing table if it was created before this phase
            await this.db.query(`
                ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS sync_duration_ms INT DEFAULT 0;
            `);
        } catch (error) {
            console.error("Failed to initialize sync_logs table:", error);
        }
    }

    async processSyncData(edgeData) {
        if (!Array.isArray(edgeData) || edgeData.length === 0) {
            return { accepted: 0, duplicates: 0, failed: 0 };
        }

        const client = await this.db.connect();
        let accepted = 0;
        let duplicates = 0;
        let failed = 0;
        const startTime = Date.now();

        try {
            await client.query('BEGIN');

            for (const item of edgeData) {
                try {
                    await client.query('SAVEPOINT item_savepoint');
                    const { entity_name, payload } = item;
                    // Payload arrives as string from Edge SQLite, need to parse
                    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
                    
                    const keys = Object.keys(data);
                    const values = Object.values(data);
                    
                    // Create parameterized query placeholders ($1, $2, ...)
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    const columns = keys.join(', ');

                    // Valid tables allowed for sync
                    const allowedTables = ['sensor_data', 'cv_results', 'notifications', 'harvest_predictions', 'actuator_logs'];
                    if (!allowedTables.includes(entity_name)) {
                        console.warn(`⚠️ Skipped unknown entity: ${entity_name}`);
                        failed++;
                        await client.query('ROLLBACK TO SAVEPOINT item_savepoint');
                        continue;
                    }

                    // Perform UPSERT: ON CONFLICT (id) DO NOTHING guarantees idempotency
                    const query = `
                        INSERT INTO ${entity_name} (${columns})
                        VALUES (${placeholders})
                        ON CONFLICT (id) DO NOTHING
                    `;

                    const result = await client.query(query, values);
                    if (result.rowCount === 1) {
                        accepted++;
                    } else {
                        duplicates++;
                    }
                    await client.query('RELEASE SAVEPOINT item_savepoint');
                } catch (itemErr) {
                    await client.query('ROLLBACK TO SAVEPOINT item_savepoint');
                    console.error("Error processing individual item in batch:", itemErr.message);
                    failed++;
                }
            }

            // If there were critical failures that prevent sync entirely, we might rollback.
            // But here, if individual items fail format checks, we count them as failed but commit the rest.
            // If we want total batch failure on any error, we'd throw here.
            // For resilience, we commit what succeeded.
            await client.query('COMMIT');

            const durationMs = Date.now() - startTime;

            // Log the sync attempt
            await this.db.query(`
                INSERT INTO sync_logs (id, batch_size, accepted, duplicates, failed, sync_duration_ms)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [crypto.randomUUID(), edgeData.length, accepted, duplicates, failed, durationMs]);

            return { accepted, duplicates, failed };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Batch Transaction Error, rolled back:", error);
            // If the entire transaction failed, all items are considered failed
            failed = edgeData.length;
            accepted = 0;
            duplicates = 0;
            
            const durationMs = Date.now() - startTime;

            await this.db.query(`
                INSERT INTO sync_logs (id, batch_size, accepted, duplicates, failed, sync_duration_ms)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [crypto.randomUUID(), edgeData.length, accepted, duplicates, failed, durationMs]);

            throw error; // Rethrow to inform controller of 500 error
        } finally {
            client.release();
        }
    }
}

module.exports = new SyncService(require('../db'));
