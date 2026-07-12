const localDb = require('../edge/localDatabase');
const queueService = require('../edge/queueService');
const experimentService = require('../services/experimentService');

function simulateOfflineInsertion(tableName, data) {
    if (!localDb.db) {
        console.warn("[Simulator] Edge Database not initialized");
        return;
    }

    try {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        
        // Also inject experiment if applicable
        let finalColumns = columns;
        let finalPlaceholders = placeholders;
        const activeExpId = experimentService.getActiveExperimentId();
        
        if (activeExpId && !data.experiment_session_id) {
            finalColumns += ', experiment_session_id';
            finalPlaceholders += ', ?';
            values.push(activeExpId);
            data.experiment_session_id = activeExpId;
        }

        const stmt = localDb.db.prepare(`
            INSERT INTO ${tableName} (${finalColumns})
            VALUES (${finalPlaceholders})
        `);
        
        stmt.run(...values);
        
        // Enqueue for sync
        queueService.enqueueSync(tableName, data.id, 'INSERT', data);
        
    } catch (err) {
        console.error(`[Simulator] Error inserting into ${tableName}:`, err.message);
    }
}

module.exports = { simulateOfflineInsertion };
