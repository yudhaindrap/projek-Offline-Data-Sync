const crypto = require('crypto');
const pool = require('../db');
const localDb = require('../edge/localDatabase');
const replayManager = require('../replay/replayManager');
const syncWorker = require('../edge/syncWorker');
const queueRepository = require('../edge/queueRepository');
const experimentService = require('../services/experimentService');
const datasetManager = require('./datasetManager');

class ExperimentManager {
    async createExperiment(payload) {
        const { experiment_name, description, dataset_id, network_mode, replay_speed, created_by } = payload;
        const id = crypto.randomUUID();
        const status = 'created';
        
        let dataset_name = null;
        if (dataset_id) {
            await datasetManager.selectDataset(dataset_id);
            const activeDs = await datasetManager.getCurrentDataset();
            if (activeDs) dataset_name = activeDs.name;
        }

        // Insert to PG
        await pool.query(
            `INSERT INTO experiment_sessions (id, experiment_name, description, network_mode, status, created_by, dataset_name, replay_speed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, experiment_name, description, network_mode, status, created_by, dataset_name, replay_speed || 1.0]
        );
        
        // Insert to SQLite
        localDb.prepare(`
            INSERT INTO experiment_sessions (id, experiment_name, description, network_mode, status, created_by, dataset_name, replay_speed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, experiment_name, description, network_mode, status, created_by, dataset_name, replay_speed || 1.0);

        return id;
    }

    async startExperiment(id) {
        const expRes = await pool.query(`SELECT * FROM experiment_sessions WHERE id = $1`, [id]);
        if (expRes.rows.length === 0) throw new Error("Experiment not found");
        const exp = expRes.rows[0];

        // Start Replay Engine
        await replayManager.start({ boxCount: 1, offlineMode: exp.network_mode === 'offline' });
        if (exp.replay_speed) {
            await replayManager.setSpeed(exp.replay_speed);
        }

        experimentService.setActiveExperimentId(id);

        await pool.query(`UPDATE experiment_sessions SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        localDb.prepare(`UPDATE experiment_sessions SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    }

    async pauseExperiment(id) {
        await replayManager.pause();
        await pool.query(`UPDATE experiment_sessions SET status = 'paused' WHERE id = $1`, [id]);
        localDb.prepare(`UPDATE experiment_sessions SET status = 'paused' WHERE id = ?`).run(id);
    }

    async resumeExperiment(id) {
        await replayManager.resume();
        await pool.query(`UPDATE experiment_sessions SET status = 'active' WHERE id = $1`, [id]);
        localDb.prepare(`UPDATE experiment_sessions SET status = 'active' WHERE id = ?`).run(id);
    }

    async finishExperiment(id) {
        await replayManager.stop();
        experimentService.clearActiveExperiment();

        const expRes = await pool.query(`SELECT * FROM experiment_sessions WHERE id = $1`, [id]);
        const exp = expRes.rows[0];
        
        const durationSeconds = exp.started_at ? (Date.now() - new Date(exp.started_at).getTime()) / 1000 : 0;
        
        const actuatorRes = await pool.query(`SELECT COUNT(*) as count, actuator_type FROM actuator_logs WHERE experiment_session_id = $1 GROUP BY actuator_type`, [id]);
        const actuatorEvents = actuatorRes.rows.reduce((acc, row) => ({ ...acc, [row.actuator_type]: parseInt(row.count) }), {});
        const totalActuators = actuatorRes.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

        let notificationCount = 0;
        if (exp.started_at) {
            const notifRes = await pool.query(`SELECT COUNT(*) FROM notifications WHERE created_at >= $1`, [exp.started_at]);
            notificationCount = parseInt(notifRes.rows[0].count);
        }

        const syncMetrics = syncWorker.getMetrics();
        const queueStats = queueRepository.getQueueStats();
        
        const perfRes = await pool.query(`
            SELECT AVG(mqtt_latency_ms) as avg_mqtt, AVG(ws_latency_ms) as avg_ws
            FROM performance_metrics WHERE experiment_session_id = $1
        `, [id]);
        const avgMqtt = perfRes.rows[0].avg_mqtt ? parseFloat(perfRes.rows[0].avg_mqtt).toFixed(2) : 0;
        const avgWs = perfRes.rows[0].avg_ws ? parseFloat(perfRes.rows[0].avg_ws).toFixed(2) : 0;

        const sensorRes = await pool.query(`
            SELECT AVG(temperature) as avg_temp, AVG(humidity_air) as avg_hum
            FROM sensor_data WHERE experiment_session_id = $1
        `, [id]);
        const avgTemp = sensorRes.rows[0].avg_temp ? parseFloat(sensorRes.rows[0].avg_temp).toFixed(2) : 0;
        const avgHum = sensorRes.rows[0].avg_hum ? parseFloat(sensorRes.rows[0].avg_hum).toFixed(2) : 0;

        const metricsPayload = {
            duration_seconds: durationSeconds,
            offline_duration_seconds: exp.network_mode === 'offline' ? durationSeconds : 0,
            synchronization_results: {
                success_rate: syncMetrics.successRate,
                average_sync_time_ms: syncMetrics.averageSyncTime,
                data_loss: syncMetrics.dataLoss,
                pending_queue: queueStats.pending,
                total_retries: queueStats.retries,
                oldest_pending_record: queueStats.oldestPendingRecord,
                maximum_queue: queueStats.maxQueue
            },
            mqtt_metrics: { average_latency_ms: avgMqtt },
            websocket_metrics: { average_latency_ms: avgWs },
            environment_metrics: {
                average_temperature: avgTemp,
                average_humidity: avgHum
            },
            threshold_events: totalActuators,
            actuator_events: actuatorEvents,
            notification_count: notificationCount,
            synchronization_logs: "Logs aggregated successfully.",
            status: "finished"
        };

        await pool.query(`UPDATE experiment_sessions SET status = 'finished', finished_at = CURRENT_TIMESTAMP, metrics = $1 WHERE id = $2`, [metricsPayload, id]);
        localDb.prepare(`UPDATE experiment_sessions SET status = 'finished', finished_at = CURRENT_TIMESTAMP, metrics = ? WHERE id = ?`).run(JSON.stringify(metricsPayload), id);
        
        return metricsPayload;
    }

    async archiveExperiment(id) {
        await pool.query(`UPDATE experiment_sessions SET status = 'archived' WHERE id = $1`, [id]);
        localDb.prepare(`UPDATE experiment_sessions SET status = 'archived' WHERE id = ?`).run(id);
    }
}

module.exports = new ExperimentManager();
