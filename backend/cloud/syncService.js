const crypto = require('crypto');
const os = require('os');

function getCpuUsage() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (let cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }
    const total = user + nice + sys + idle + irq;
    return Math.round(((total - idle) / total) * 100);
}
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
                    sync_duration_ms INT DEFAULT 0,
                    payload_size_bytes INT DEFAULT 0,
                    cpu_usage_pct INT DEFAULT 0,
                    memory_usage_mb FLOAT DEFAULT 0,
                    throughput_rps FLOAT DEFAULT 0
                );
            `);
            // Seamlessly upgrade existing table if it was created before this phase
            await this.db.query(`
                ALTER TABLE sync_logs 
                ADD COLUMN IF NOT EXISTS sync_duration_ms INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS payload_size_bytes INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS cpu_usage_pct INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS memory_usage_mb FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS throughput_rps FLOAT DEFAULT 0;
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
        const startCpu = getCpuUsage();
        const startMem = process.memoryUsage().heapUsed;
        const payloadSizeBytes = Buffer.byteLength(JSON.stringify(edgeData));

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

                    // Baseline 2: No Idempotent UPSERT Simulation
                    let query = `
                        INSERT INTO ${entity_name} (${columns})
                        VALUES (${placeholders})
                        ON CONFLICT (id) DO NOTHING
                    `;

                    if (process.env.ENABLE_UPSERT === 'false') {
                        query = `
                            INSERT INTO ${entity_name} (${columns})
                            VALUES (${placeholders})
                        `;
                    }

                    const result = await client.query(query, values);
                    if (result.rowCount === 1) {
                        accepted++;
                    } else if (process.env.ENABLE_UPSERT !== 'false') {
                        duplicates++;
                    }
                    await client.query('RELEASE SAVEPOINT item_savepoint');
                } catch (itemErr) {
                    await client.query('ROLLBACK TO SAVEPOINT item_savepoint');
                    if (process.env.ENABLE_UPSERT === 'false' && (itemErr.code === '23505' || itemErr.message.includes('duplicate key'))) {
                        console.warn("⚠️ Duplicate error safely caught due to ENABLE_UPSERT=false");
                        duplicates++;
                    } else {
                        console.error("Error processing individual item in batch:", itemErr.message);
                        failed++;
                    }
                }
            }

            // If there were critical failures that prevent sync entirely, we might rollback.
            // But here, if individual items fail format checks, we count them as failed but commit the rest.
            // If we want total batch failure on any error, we'd throw here.
            // For resilience, we commit what succeeded.
            await client.query('COMMIT');

            const durationMs = Date.now() - startTime;
            const throughputRps = durationMs > 0 ? (edgeData.length / (durationMs / 1000)) : edgeData.length;
            const endCpu = getCpuUsage();
            const endMem = process.memoryUsage().heapUsed;
            const cpuSpike = Math.abs(endCpu - startCpu);
            const memSpikeMb = Math.abs((endMem - startMem) / 1024 / 1024);

            // Log the sync attempt
            await this.db.query(`
                INSERT INTO sync_logs (id, batch_size, accepted, duplicates, failed, sync_duration_ms, payload_size_bytes, cpu_usage_pct, memory_usage_mb, throughput_rps)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [crypto.randomUUID(), edgeData.length, accepted, duplicates, failed, durationMs, payloadSizeBytes, cpuSpike, memSpikeMb, throughputRps]);

            return { accepted, duplicates, failed };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Batch Transaction Error, rolled back:", error);
            // If the entire transaction failed, all items are considered failed
            failed = edgeData.length;
            accepted = 0;
            duplicates = 0;
            
            const durationMs = Date.now() - startTime;
            const throughputRps = durationMs > 0 ? (edgeData.length / (durationMs / 1000)) : edgeData.length;
            const endCpu = getCpuUsage();
            const endMem = process.memoryUsage().heapUsed;
            const cpuSpike = Math.abs(endCpu - startCpu);
            const memSpikeMb = Math.abs((endMem - startMem) / 1024 / 1024);

            await this.db.query(`
                INSERT INTO sync_logs (id, batch_size, accepted, duplicates, failed, sync_duration_ms, payload_size_bytes, cpu_usage_pct, memory_usage_mb, throughput_rps)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [crypto.randomUUID(), edgeData.length, accepted, duplicates, failed, durationMs, payloadSizeBytes, cpuSpike, memSpikeMb, throughputRps]);

            throw error; // Rethrow to inform controller of 500 error
        } finally {
            client.release();
        }
    }
}

module.exports = new SyncService(require('../db'));
