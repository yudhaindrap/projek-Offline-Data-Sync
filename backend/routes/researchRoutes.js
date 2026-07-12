const express = require('express');
const router = express.Router();
const os = require('os');
const connectivityService = require('../edge/connectivityService');
const datasetManager = require('../research/datasetManager');

// Dataset Management Routes
router.get('/datasets', async (req, res) => {
    try {
        const datasets = await datasetManager.getDatasets();
        res.status(200).json(datasets);
    } catch (err) {
        console.error("Error fetching datasets:", err);
        res.status(500).json({ error: "Failed to retrieve datasets" });
    }
});

router.get('/datasets/current', async (req, res) => {
    try {
        const dataset = await datasetManager.getCurrentDataset();
        if (!dataset) {
            return res.status(404).json({ error: "No dataset currently selected" });
        }
        res.status(200).json(dataset);
    } catch (err) {
        console.error("Error fetching current dataset:", err);
        res.status(500).json({ error: "Failed to retrieve current dataset" });
    }
});

router.get('/datasets/:id', async (req, res) => {
    try {
        const dataset = await datasetManager.getDatasetById(req.params.id);
        if (!dataset) {
            return res.status(404).json({ error: "Dataset not found" });
        }
        res.status(200).json(dataset);
    } catch (err) {
        console.error("Error fetching dataset:", err);
        res.status(500).json({ error: "Failed to retrieve dataset" });
    }
});

router.post('/datasets/select/:id', async (req, res) => {
    try {
        const dataset = await datasetManager.selectDataset(req.params.id);
        res.status(200).json({ message: "Dataset selected successfully", dataset });
    } catch (err) {
        console.error("Error selecting dataset:", err);
        res.status(400).json({ error: err.message });
    }
});

// Helper for CPU average
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

router.get('/system-status', async (req, res) => {
    try {
        const queueRepository = require('../edge/queueRepository');
        const pool = require('../db');

        // SQLite metrics
        let sqliteStatus = 'Disconnected';
        let pendingQueue = 0;
        try {
            if (queueRepository.db && queueRepository.db.open) {
                sqliteStatus = 'Active';
                const countRes = queueRepository.db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'`).get();
                pendingQueue = countRes ? countRes.count : 0;
            }
        } catch (e) {
            console.error("SQLite error:", e);
        }

        // PostgreSQL metrics
        let pgStatus = 'Disconnected';
        let syncedRecords = 0;
        let failedRecords = 0;
        try {
            const pgLogs = await pool.query(`SELECT SUM(accepted) as total_accepted, SUM(failed) as total_failed FROM sync_logs`);
            if (pgLogs && pgLogs.rows && pgLogs.rows.length > 0) {
                pgStatus = 'Active';
                syncedRecords = parseInt(pgLogs.rows[0].total_accepted || 0);
                failedRecords = parseInt(pgLogs.rows[0].total_failed || 0);
            }
        } catch (e) {
            console.error("PG error:", e);
        }

        const modeStatus = connectivityService.getStatus().status; // 'offline' or 'online'

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = Math.round((usedMem / totalMem) * 100);

        res.status(200).json({
            systemStatus: modeStatus === 'online' ? 'Connected to Cloud' : 'Running Offline',
            cloudStatus: modeStatus === 'online' ? 'Active' : 'Unreachable',
            edgeStatus: 'Active',
            mqttStatus: modeStatus === 'online' ? 'Connected' : 'Offline',
            sqliteStatus: sqliteStatus,
            pgStatus: pgStatus,
            queueStatus: `${pendingQueue} Pending`,
            syncStatus: modeStatus === 'online' ? `Synced: ${syncedRecords} | Failed: ${failedRecords}` : 'Paused',
            cpuUsage: `${getCpuUsage()}%`,
            memoryUsage: `${memoryUsage}%`,
            diskUsage: `N/A (OS Native)`,
            nodeVersion: process.version,
            databaseStatus: (sqliteStatus === 'Active' || pgStatus === 'Active') ? 'Healthy' : 'Degraded'
        });
    } catch (err) {
        console.error("Error in research system status:", err);
        res.status(500).json({ error: "Failed to retrieve system status" });
    }
});

module.exports = router;
