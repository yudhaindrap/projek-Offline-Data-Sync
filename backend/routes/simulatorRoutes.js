const express = require('express');
const router = express.Router();
const replayManager = require('../replay/replayManager');
const networkSimulatorService = require('../services/networkSimulatorService');
const syncWorker = require('../edge/syncWorker');
const queueRepository = require('../edge/queueRepository');

// GET status
router.get('/status', async (req, res) => {
    try {
        const status = await replayManager.getStatus();
        res.json(status);
    } catch (err) {
        console.error("Error getting status:", err);
        res.status(500).json({ error: "Failed to get simulator status" });
    }
});

// POST start
router.post('/start', async (req, res) => {
    // Note: frontend sends intervalMs, but ReplayEngine uses dataset chronology
    const { boxCount, offlineMode } = req.body;
    try {
        const status = await replayManager.start({ boxCount, offlineMode });
        res.json({ message: "Replay Engine started", status });
    } catch (err) {
        console.error("Error starting replay:", err);
        res.status(500).json({ error: err.message || "Failed to start replay" });
    }
});

// POST stop
router.post('/stop', async (req, res) => {
    try {
        const status = await replayManager.stop();
        res.json({ message: "Replay Engine stopped", status });
    } catch (err) {
        res.status(500).json({ error: "Failed to stop replay" });
    }
});

// POST pause
router.post('/pause', async (req, res) => {
    try {
        const status = await replayManager.pause();
        res.json({ message: "Replay Engine paused", status });
    } catch (err) {
        res.status(500).json({ error: "Failed to pause replay" });
    }
});

// POST resume
router.post('/resume', async (req, res) => {
    try {
        const status = await replayManager.resume();
        res.json({ message: "Replay Engine resumed", status });
    } catch (err) {
        res.status(500).json({ error: "Failed to resume replay" });
    }
});

// POST reset
router.post('/reset', async (req, res) => {
    try {
        const status = await replayManager.reset();
        res.json({ message: "Replay Engine reset", status });
    } catch (err) {
        res.status(500).json({ error: "Failed to reset replay" });
    }
});

// POST speed
router.post('/speed', async (req, res) => {
    const { speed } = req.body;
    if (!speed || isNaN(speed)) {
        return res.status(400).json({ error: "Invalid speed parameter" });
    }
    try {
        const status = await replayManager.setSpeed(parseFloat(speed));
        res.json({ message: `Replay speed set to ${speed}x`, status });
    } catch (err) {
        res.status(500).json({ error: "Failed to set replay speed" });
    }
});

// --- Network Emulation Routes (Unchanged logic) ---

// GET network status
router.get('/network', async (req, res) => {
    try {
        const config = networkSimulatorService.getConfig();
        const queueStats = queueRepository.getQueueStats();
        const syncMetrics = syncWorker.getMetrics();
        const replayStatus = await replayManager.getStatus();

        res.json({
            ...config,
            ...replayStatus, // Spread all replay engine metrics
            
            queueSize: queueStats.total, // For backward compatibility
            retryCount: queueStats.retries, // Backward compatibility
            
            // Phase 4 Metrics
            pendingQueue: queueStats.pending,
            failedQueue: queueStats.failed,
            maximumQueue: queueStats.maxQueue,
            successRate: syncMetrics.successRate,
            averageSyncTime: syncMetrics.averageSyncTime,
            dataLoss: syncMetrics.dataLoss,
            totalSuccess: syncMetrics.totalSuccess,
            totalFailed: syncMetrics.totalFailed
        });
    } catch (err) {
        console.error("Error getting network metrics:", err);
        res.status(500).json({ error: "Failed to get network metrics" });
    }
});

// POST update network config
router.post('/network', (req, res) => {
    const { status, packetDelay, packetLoss } = req.body;
    networkSimulatorService.updateConfig({ status, packetDelay, packetLoss });
    res.json({ message: "Network config updated", config: networkSimulatorService.getConfig() });
});

// POST reconnect instantly
router.post('/network/reconnect', (req, res) => {
    networkSimulatorService.updateConfig({ status: 'online' });
    syncWorker.triggerSyncNow();
    res.json({ message: "Network reconnected and sync triggered" });
});

module.exports = router;
