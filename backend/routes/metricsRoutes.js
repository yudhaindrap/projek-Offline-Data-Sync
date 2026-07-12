const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:experiment_id', async (req, res) => {
    try {
        const { experiment_id } = req.params;

        // Fetch recent timeseries data
        const tsRes = await pool.query(`
            SELECT * FROM performance_metrics 
            WHERE experiment_session_id = $1 
            ORDER BY recorded_at ASC
        `, [experiment_id]);

        // Fetch aggregated statistics
        // We calculate avg, max, min, percentile_cont(0.5) for median, and stddev
        const metricsList = [
            'mqtt_latency_ms', 'ws_latency_ms', 'sync_duration_ms', 'sync_throughput_rps', 
            'queue_size', 'cpu_usage_pct', 'memory_usage_mb', 'disk_usage_mb', 
            'sqlite_size_kb', 'pg_insert_time_ms'
        ];

        let selectParts = [];
        metricsList.forEach(m => {
            selectParts.push(`ROUND(AVG(${m})::numeric, 2) as avg_${m}`);
            selectParts.push(`ROUND(MAX(${m})::numeric, 2) as max_${m}`);
            selectParts.push(`ROUND(MIN(${m})::numeric, 2) as min_${m}`);
            selectParts.push(`ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${m})::numeric, 2) as median_${m}`);
            selectParts.push(`ROUND(STDDEV(${m})::numeric, 2) as stddev_${m}`);
        });

        const statRes = await pool.query(`
            SELECT ${selectParts.join(', ')}
            FROM performance_metrics
            WHERE experiment_session_id = $1
        `, [experiment_id]);

        res.json({
            timeseries: tsRes.rows,
            statistics: statRes.rows[0]
        });

    } catch (err) {
        console.error("Error fetching metrics:", err);
        res.status(500).json({ error: "Failed to fetch metrics" });
    }
});

module.exports = router;
