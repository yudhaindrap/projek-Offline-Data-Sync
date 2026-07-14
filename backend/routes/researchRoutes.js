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

// Reset Experiment API
router.post('/reset', async (req, res) => {
    try {
        const resetService = require('../services/resetService');
        const result = await resetService.resetExperimentData();
        res.status(200).json(result);
    } catch (err) {
        console.error("Error resetting experiment data:", err);
        res.status(500).json({ error: err.message || "Failed to reset experiment data" });
    }
});

// Helper function to fetch and format sync logs
async function fetchSyncLogsExportData() {
    const pool = require('../db');
    const { rows } = await pool.query(`SELECT * FROM sync_logs ORDER BY created_at ASC`);
    
    // Map to the requested verbose export schema
    return rows.map(row => ({
        sync_id: row.id || "",
        batch_id: "",
        entity_type: "",
        entity_id: "",
        tenant_id: "",
        box_id: "",
        operation: "",
        status: "",
        attempt_number: "",
        retry_count: "",
        queue_status: "",
        created_at: row.created_at ? new Date(row.created_at).toISOString() : "",
        queued_at: "",
        sync_started_at: "",
        sync_finished_at: "",
        sync_duration_ms: row.sync_duration_ms !== undefined ? row.sync_duration_ms : "",
        payload_size_bytes: row.payload_size_bytes !== undefined ? row.payload_size_bytes : "",
        cpu_usage_pct: row.cpu_usage_pct !== undefined ? row.cpu_usage_pct : "",
        memory_usage_mb: row.memory_usage_mb !== undefined ? row.memory_usage_mb : "",
        throughput_rps: row.throughput_rps !== undefined ? row.throughput_rps : "",
        records_sent: row.batch_size || 0,
        records_accepted: row.accepted || 0,
        records_failed: row.failed || 0,
        duplicates: row.duplicates || 0,
        http_status: "",
        response_message: "",
        error_message: "",
        network_mode: "",
        connectivity_status: "",
        device_id: "",
        worker_name: "",
        experiment_id: "",
        dataset_name: "",
        mqtt_latency_ms: "",
        websocket_latency_ms: "",
        synchronization_source: "",
        created_by: ""
    }));
}

// Export Sync Logs JSON
router.get('/export/sync/json', async (req, res) => {
    try {
        const syncLogs = await fetchSyncLogsExportData();
        const exportData = {
            exported_at: new Date().toISOString(),
            total_records: syncLogs.length,
            experiment: "",
            dataset: "",
            sync_logs: syncLogs
        };
        
        res.setHeader('Content-disposition', `attachment; filename=sync_logs_${Date.now()}.json`);
        res.setHeader('Content-type', 'application/json');
        res.status(200).send(JSON.stringify(exportData, null, 4));
    } catch (err) {
        console.error("Error exporting sync logs to JSON:", err);
        res.status(500).json({ error: "Failed to export JSON" });
    }
});

// Export Sync Logs CSV
router.get('/export/sync/csv', async (req, res) => {
    try {
        const syncLogs = await fetchSyncLogsExportData();
        
        if (syncLogs.length === 0) {
            return res.status(200).send("No data available");
        }

        const headers = Object.keys(syncLogs[0]);
        let csvContent = headers.join(',') + '\n';
        
        syncLogs.forEach(log => {
            const row = headers.map(header => {
                let cell = log[header] !== null && log[header] !== undefined ? String(log[header]) : '';
                // Escape quotes and wrap in quotes if there's a comma or quote
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            });
            csvContent += row.join(',') + '\n';
        });

        res.setHeader('Content-disposition', `attachment; filename=sync_logs_${Date.now()}.csv`);
        res.setHeader('Content-type', 'text/csv; charset=utf-8');
        res.status(200).send(csvContent);
    } catch (err) {
        console.error("Error exporting sync logs to CSV:", err);
        res.status(500).json({ error: "Failed to export CSV" });
    }
});

module.exports = router;
