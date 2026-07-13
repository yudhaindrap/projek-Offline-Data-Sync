const express = require('express');
const router = express.Router();
const connectivityService = require('../edge/connectivityService');
const syncController = require('../cloud/syncController');
const crypto = require('crypto');
const pool = require('../db');

// Cloud Health Check Endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Edge Connectivity Status Endpoint
router.get('/system/connectivity', (req, res) => {
    const status = connectivityService.getStatus();
    res.status(200).json(status);
});

// Sync Metrics Endpoint
router.get('/system/sync-metrics', async (req, res) => {
    try {
        const queueRepository = require('../edge/queueRepository');
        const pool = require('../db');
        
        // SQLite metrics
        const queueStats = queueRepository.getQueueStats();
        const avgRetry = queueStats.pending > 0 ? Math.round((queueStats.retries / queueStats.pending) * 10) / 10 : 0;
        
        // PG metrics
        const pgLogs = await pool.query(`
            SELECT 
                SUM(accepted) as total_accepted,
                SUM(failed) as total_failed,
                SUM(duplicates) as total_duplicates,
                AVG(batch_size) as avg_batch_size,
                MAX(batch_size) as max_batch_size,
                MIN(batch_size) as min_batch_size,
                AVG(sync_duration_ms) as avg_sync_time,
                MAX(sync_duration_ms) as max_sync_time,
                MIN(sync_duration_ms) as min_sync_time,
                COUNT(id) as total_batches
            FROM sync_logs
        `);
        const totals = pgLogs.rows[0];
        const accepted = parseInt(totals.total_accepted || 0);
        const failedLogs = parseInt(totals.total_failed || 0); // Cloud rejected count
        const duplicates = parseInt(totals.total_duplicates || 0);

        const avgBatchSize = parseFloat(totals.avg_batch_size || 0).toFixed(1);
        const maxBatchSize = parseInt(totals.max_batch_size || 0);
        const minBatchSize = parseInt(totals.min_batch_size || 0);

        const avgSyncTime = (parseFloat(totals.avg_sync_time || 0) / 1000).toFixed(2);
        const maxSyncTime = (parseInt(totals.max_sync_time || 0) / 1000).toFixed(2);
        const minSyncTime = (parseInt(totals.min_sync_time || 0) / 1000).toFixed(2);

        const historyQuery = await pool.query(`
            SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 20
        `);
        const history = historyQuery.rows;

        const totalProcessed = accepted + failedLogs + duplicates;
        const successRate = totalProcessed > 0 ? Math.round(((accepted + duplicates) / totalProcessed) * 100) : 100;
        const failureRate = totalProcessed > 0 ? Math.round((failedLogs / totalProcessed) * 100) : 0;
        
        // Data Loss Calculation: Generated - (Synced + Pending)
        // Note: Failed logs in Cloud usually mean formatting errors. Real data loss is records that never sync.
        const totalGenerated = queueStats.totalGenerated;
        let missingRecords = totalGenerated - (accepted + duplicates + queueStats.pending);
        if (missingRecords < 0) missingRecords = 0; // Prevent negative during restarts

        const dataLossPct = totalGenerated > 0 ? ((missingRecords / totalGenerated) * 100).toFixed(2) : "0.00";

        res.status(200).json({
            mode: connectivityService.getStatus().status,
            pendingQueue: queueStats.pending,
            totalRetries: queueStats.retries,
            oldestPendingRecord: queueStats.oldestPendingRecord,
            syncedRecords: accepted,
            failedRecords: failedLogs, 
            avgRetry,
            successRate,
            failureRate,
            avgSyncTime: `${avgSyncTime}s`,
            maxSyncTime: `${maxSyncTime}s`,
            minSyncTime: `${minSyncTime}s`,
            avgBatchSize,
            maxBatchSize,
            minBatchSize,
            maxQueueSize: queueStats.maxQueue,
            dataLoss: `${dataLossPct}%`,
            history
        });
    } catch (err) {
        console.error("Error fetching sync metrics:", err);
        res.status(500).json({ error: "Failed to fetch metrics" });
    }
});

// Cloud Sync Endpoint
router.post('/sync', syncController.handleSyncRequest);

// POST /api/metrics/latency
router.post('/metrics/latency', async (req, res) => {
    // Jalankan secara asynchronous tanpa menge-block thread UI
    const { type, latency_ms } = req.body;

    // Validasi sederhana tipe data
    if (!type || typeof latency_ms !== 'number') {
        return res.status(400).json({ error: 'Format payload tidak valid' });
    }

    try {
        const logId = crypto.randomUUID();

        if (type === 'websocket') {
            await pool.query(
                `INSERT INTO websocket_latency_logs (id, e2e_latency_ms, recorded_at) 
                 VALUES ($1, $2, NOW())`,
                [logId, Math.round(latency_ms)]
            );
        } else if (type === 'webrtc') {
            await pool.query(
                `INSERT INTO webrtc_latency_logs (id, latency_ms, recorded_at) 
                 VALUES ($1, $2, NOW())`,
                [logId, Math.round(latency_ms)]
            );
        } else {
            return res.status(400).json({ error: 'Tipe protokol tidak didukung' });
        }

        // Return secara instan
        return res.status(200).json({ message: 'Metrik latensi berhasil disimpan' });
    } catch (err) {
        console.error('Database Error (Latency Metrics):', err.message);
        return res.status(500).json({ error: 'Terjadi kesalahan sistem' });
    }
});

module.exports = router;
