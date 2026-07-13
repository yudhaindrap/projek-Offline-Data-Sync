const localDb = require('../edge/localDatabase');
const pool = require('../db');
const replayManager = require('../replay/replayManager');
const queueRepository = require('../edge/queueRepository');
const metricsService = require('./metricsService');
const networkSimulatorService = require('./networkSimulatorService');

class ResetService {
    async resetExperimentData() {
        const startMs = Date.now();
        const deletedCounts = {};

        // 1. Stop any running replay
        if (replayManager && replayManager.engine) {
            replayManager.stop();
        }

        // 2. Clear SQLite Database (Edge)
        const sqliteTables = [
            'sensor_data',
            'cv_results',
            'harvest_predictions',
            'notifications',
            'actuator_logs',
            'experiment_sessions',
            'sync_queue'
        ];

        let sqliteDeleted = 0;
        try {
            const clearEdge = localDb.transaction((tables) => {
                let total = 0;
                for (const table of tables) {
                    const info = localDb.prepare(`DELETE FROM ${table}`).run();
                    deletedCounts[`sqlite_${table}`] = info.changes;
                    total += info.changes;
                }
                return total;
            });
            sqliteDeleted = clearEdge(sqliteTables);
        } catch (e) {
            console.error("[ResetService] Error clearing SQLite:", e);
            throw new Error("Failed to clear Edge database");
        }

        // 3. Clear PostgreSQL Database (Cloud)
        const pgTables = [
            'sensor_data',
            'cv_results',
            'harvest_predictions',
            'notifications',
            'actuator_logs',
            'experiment_sessions',
            'sync_logs'
        ];

        let pgDeleted = 0;
        const pgClient = await pool.connect();
        try {
            await pgClient.query('BEGIN');
            for (const table of pgTables) {
                const res = await pgClient.query(`DELETE FROM ${table}`);
                deletedCounts[`pg_${table}`] = res.rowCount;
                pgDeleted += res.rowCount;
            }
            await pgClient.query('COMMIT');
        } catch (e) {
            await pgClient.query('ROLLBACK');
            console.error("[ResetService] Error clearing PostgreSQL:", e);
            throw new Error("Failed to clear Cloud database");
        } finally {
            pgClient.release();
        }

        // 4. Reset In-Memory Metrics & Queues
        metricsService.reset();
        networkSimulatorService.resetMetrics();
        
        const automationService = require('./automationService');
        if (automationService.stateCache) {
            automationService.stateCache = {}; // clear actuator cooldowns
        }

        const elapsedMs = Date.now() - startMs;
        
        return {
            status: "success",
            message: "Experiment data successfully reset.",
            details: {
                sqlite_deleted_rows: sqliteDeleted,
                pg_deleted_rows: pgDeleted,
                elapsed_ms: elapsedMs,
                breakdown: deletedCounts
            }
        };
    }
}

module.exports = new ResetService();
