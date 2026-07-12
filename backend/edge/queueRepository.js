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
        // Fetch up to 100 items that are PENDING and past their backoff window.
        // Backoff formula: MIN(retry_count * retry_count * 10, 300) seconds. Max delay 5 mins.
        const stmt = this.db.prepare(`
            SELECT * FROM sync_queue 
            WHERE status = 'PENDING' 
              AND (last_retry IS NULL OR strftime('%s', 'now') - strftime('%s', last_retry) > MIN(retry_count * retry_count * 10, 300))
            ORDER BY created_at ASC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    markSuccess(id, entityName, entityId) {
        const successTransaction = this.db.transaction(() => {
            const deleteStmt = this.db.prepare(`DELETE FROM sync_queue WHERE id = ?`);
            deleteStmt.run(id);

            const updateStmt = this.db.prepare(`UPDATE ${entityName} SET is_synced = 1 WHERE id = ?`);
            updateStmt.run(entityId);
        });

        successTransaction();
    }

    markFailed(id) {
        // Keep status PENDING, just increment retry_count
        const stmt = this.db.prepare(`
            UPDATE sync_queue 
            SET status = 'PENDING', 
                retry_count = retry_count + 1, 
                last_retry = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        stmt.run(id);
    }

    getQueueStats() {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) AS total FROM sync_queue`);
        const pendingStmt = this.db.prepare(`SELECT COUNT(*) AS pending, SUM(retry_count) AS retries, MIN(created_at) as oldest FROM sync_queue WHERE status = 'PENDING'`);
        
        const total = totalStmt.get().total || 0;
        const pendingRow = pendingStmt.get();
        const pending = pendingRow.pending || 0;
        const retries = pendingRow.retries || 0;
        const oldest = pendingRow.oldest || null;

        this.maxQueue = Math.max(this.maxQueue, total);

        return {
            total: total,
            pending: pending,
            retries: retries,
            oldestPendingRecord: oldest,
            maxQueue: this.maxQueue
        };
    }
}

module.exports = new QueueRepository(localDb);
