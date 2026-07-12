const localDb = require('./localDatabase');

class QueueRepository {
    constructor(db) {
        this.db = db;
        this.maxQueue = 0;
    }

    addQueueItem(id, entityName, entityId, operation, payload) {
        const stmt = this.db.prepare(`
            INSERT INTO sync_queue (id, entity_name, entity_id, operation, payload)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, entityName, entityId, operation, payload);
        
        // Update maxQueue asynchronously or lazily
        const currentSize = this.db.prepare(`SELECT COUNT(*) as count FROM sync_queue`).get().count;
        this.maxQueue = Math.max(this.maxQueue, currentSize);
    }

    getBatch(limit = 100) {
        // Fetch up to 100 items that are either PENDING, or FAILED but past their exponential backoff retry window.
        // Backoff formula: wait retry_count * retry_count * 10 seconds.
        const stmt = this.db.prepare(`
            SELECT * FROM sync_queue 
            WHERE status = 'PENDING' 
               OR (status = 'FAILED' AND strftime('%s', 'now') - strftime('%s', last_retry) > retry_count * retry_count * 10)
            ORDER BY created_at ASC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    markSuccess(id, entityName, entityId) {
        // Atomic transaction: remove from queue and update source table
        const successTransaction = this.db.transaction(() => {
            const deleteStmt = this.db.prepare(`DELETE FROM sync_queue WHERE id = ?`);
            deleteStmt.run(id);

            // Update the source table to mark as synced
            // We use simple string concatenation for the table name because it's controlled internally (e.g., 'sensor_data').
            const updateStmt = this.db.prepare(`UPDATE ${entityName} SET is_synced = 1 WHERE id = ?`);
            updateStmt.run(entityId);
        });

        successTransaction();
    }

    markFailed(id) {
        const stmt = this.db.prepare(`
            UPDATE sync_queue 
            SET status = 'FAILED', 
                retry_count = retry_count + 1, 
                last_retry = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        stmt.run(id);
    }

    getQueueStats() {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) AS total FROM sync_queue`);
        const pendingStmt = this.db.prepare(`SELECT COUNT(*) AS pending FROM sync_queue WHERE status = 'PENDING'`);
        const failedStmt = this.db.prepare(`SELECT COUNT(*) AS failed, SUM(retry_count) AS retries FROM sync_queue WHERE status = 'FAILED'`);
        
        const total = totalStmt.get().total || 0;
        const pending = pendingStmt.get().pending || 0;
        const failedRow = failedStmt.get();
        const failed = failedRow.failed || 0;
        const retries = failedRow.retries || 0;

        this.maxQueue = Math.max(this.maxQueue, total);

        return {
            total: total,
            pending: pending,
            failed: failed,
            retries: retries,
            maxQueue: this.maxQueue
        };
    }
    
    deleteFailedItem(id) {
        const stmt = this.db.prepare(`DELETE FROM sync_queue WHERE id = ?`);
        stmt.run(id);
    }
}

module.exports = new QueueRepository(localDb);
