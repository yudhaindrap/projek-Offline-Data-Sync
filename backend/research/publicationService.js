const pool = require('../db');

class PublicationService {
    
    /**
     * Calculates robust academic statistics for a given column.
     * Uses 95% Confidence Interval multiplier (1.96).
     */
    async getStatistics(experimentId, table, column) {
        const query = `
            SELECT 
                COUNT(${column}) as n,
                MIN(${column}) as min_val,
                MAX(${column}) as max_val,
                AVG(${column}) as avg_val,
                STDDEV_SAMP(${column}) as std_dev
            FROM ${table} 
            WHERE experiment_session_id = $1 AND ${column} IS NOT NULL
        `;
        const res = await pool.query(query, [experimentId]);
        const data = res.rows[0];
        
        const n = parseInt(data.n) || 0;
        const avg = parseFloat(data.avg_val) || 0;
        const stdDev = parseFloat(data.std_dev) || 0;
        
        // 95% CI
        const marginOfError = n > 0 ? (1.96 * (stdDev / Math.sqrt(n))) : 0;
        
        return {
            n,
            min: parseFloat(data.min_val) || 0,
            max: parseFloat(data.max_val) || 0,
            average: avg,
            std_dev: stdDev,
            ci_95: marginOfError,
            lower_bound: avg - marginOfError,
            upper_bound: avg + marginOfError
        };
    }

    async generateReport(experimentId) {
        // 1. Fetch Experiment Info
        const expRes = await pool.query(`SELECT * FROM experiment_sessions WHERE id = $1`, [experimentId]);
        if (expRes.rows.length === 0) throw new Error("Experiment not found");
        const exp = expRes.rows[0];

        // 2. Fetch Performance Metrics Statistics
        const mqttStats = await this.getStatistics(experimentId, 'performance_metrics', 'mqtt_latency_ms');
        const wsStats = await this.getStatistics(experimentId, 'performance_metrics', 'ws_latency_ms');
        const syncStats = await this.getStatistics(experimentId, 'performance_metrics', 'sync_duration_ms');
        const throughputStats = await this.getStatistics(experimentId, 'performance_metrics', 'sync_throughput_rps');
        const queueStats = await this.getStatistics(experimentId, 'performance_metrics', 'queue_size');

        // 3. Fetch Sensor Stats
        const tempStats = await this.getStatistics(experimentId, 'sensor_data', 'temperature');
        const humStats = await this.getStatistics(experimentId, 'sensor_data', 'humidity_air');

        // 4. Fetch Actuator / Threshold Metrics
        const actRes = await pool.query(`
            SELECT actuator_type, action, COUNT(*) as frequency 
            FROM actuator_logs 
            WHERE experiment_session_id = $1 
            GROUP BY actuator_type, action
        `, [experimentId]);
        const actuatorStats = actRes.rows;

        // 5. Build Summary Payload
        return {
            experiment: {
                id: exp.id,
                name: exp.experiment_name,
                dataset: exp.dataset_name,
                speed: exp.replay_speed,
                network_mode: exp.network_mode,
                duration_seconds: exp.metrics ? exp.metrics.duration_seconds : 0
            },
            performance: {
                mqtt_latency: mqttStats,
                ws_latency: wsStats,
                sync_duration: syncStats,
                sync_throughput: throughputStats,
                queue_growth: queueStats
            },
            environment: {
                temperature: tempStats,
                humidity: humStats
            },
            actuators: actuatorStats,
            general: exp.metrics || {}
        };
    }
}

module.exports = new PublicationService();
