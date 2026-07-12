const { spawn } = require('child_process');
const path = require('path');
const pool = require('../db');
const experimentService = require('./experimentService');
const metricsService = require('./metricsService');

function runXGBoostInference(boxId) {
    return new Promise((resolve, reject) => {
        // Just pass boxId, python will connect to DB and fetch the full dataset itself
        const pythonProcess = spawn('python', [
            path.join(__dirname, '..', 'predict_xgb.py'),
            boxId.toString()
        ]);

        let result = '';
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python ML Error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            try {
                const lines = result.trim().split('\n');
                const lastLine = lines[lines.length - 1]; // Often python prints pandas warnings, just get the json
                const parsed = JSON.parse(lastLine);
                if (parsed.error) reject(parsed.error);
                else resolve(parsed.harvest_predictions);
            } catch (e) {
                console.error("Raw python output:", result);
                reject("Failed to parse ML output");
            }
        });
    });
}

function initMLPipeline(io, pool) {
    setInterval(async () => {
        try {
            // Fetch all active boxes dynamically
            const activeBoxesRes = await pool.query("SELECT id, tenant_id FROM boxes WHERE status = 'active'");

            for (const box of activeBoxesRes.rows) {
                const boxId = box.id;
                const tenantId = box.tenant_id;

                // Fetch the latest sensor data and cv result for this box
                const latestSensor = await pool.query(
                    "SELECT id, temperature, humidity_air, humidity_media FROM sensor_data WHERE box_id = $1 ORDER BY recorded_at DESC LIMIT 1",
                    [boxId]
                );

                const latestCv = await pool.query(
                    "SELECT id FROM cv_results WHERE box_id = $1 ORDER BY recorded_at DESC LIMIT 1",
                    [boxId]
                );

                const sData = latestSensor.rows[0];
                const cvData = latestCv.rows[0];

                if (!sData || !cvData) continue; // Skip if missing prereq data

                // Call python ML directly to retrain and predict using historical postgres data
                const predictionDays = await runXGBoostInference(boxId);

                const insertStart = Date.now();
                await pool.query(`
                    INSERT INTO harvest_predictions 
                    (id, tenant_id, box_id, sensor_data_id, cv_result_id, predicted_days, input_temperature, input_humidity_air, input_humidity_media, experiment_session_id, predicted_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                `, [
                    require('crypto').randomUUID(),
                    tenantId,
                    boxId,
                    sData.id,
                    cvData.id,
                    Math.round(predictionDays),
                    sData.temperature,
                    sData.humidity_air,
                    sData.humidity_media,
                    experimentService.getActiveExperimentId() || null
                ]);
                metricsService.record('pg_insert_time_ms', Date.now() - insertStart);

                io.emit("ml_harvest_update", {
                    box_id: boxId,
                    estimated_days: Math.round(predictionDays)
                });
            }
        } catch (err) {
            console.error("❌ Auto-Prediction Pipeline Error:", err);
        }
    }, 15000); // 15s interval
}

module.exports = { initMLPipeline };
