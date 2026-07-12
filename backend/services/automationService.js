const crypto = require('crypto');
const pool = require('../db');
const localDb = require('../edge/localDatabase');
const queueService = require('../edge/queueService');
const experimentService = require('./experimentService');
const { performance } = require('perf_hooks');

class AutomationService {
    
    /**
     * Evaluates sensor data against thresholds and triggers automation.
     * Returns an object containing actuators state, notifications, and execution time.
     */
    async evaluate(sensorData, roomNumber) {
        const start = performance.now();
        
        const actuators = {
            fan_in: false,
            pump: false,
            heater: false
        };
        
        let thresholdId = null;
        const notifications = [];

        try {
            // 1. Fetch Threshold for this floor/room
            const thresholdQuery = await pool.query(`
                SELECT * FROM automation_thresholds 
                WHERE tenant_id = $1 AND floor_level = $2
                LIMIT 1
            `, [sensorData.tenant_id, roomNumber]);

            if (thresholdQuery.rows.length > 0) {
                const threshold = thresholdQuery.rows[0];
                thresholdId = threshold.id;

                // Evaluate Temperature (Heater, Fan)
                if (sensorData.temperature > parseFloat(threshold.temp_max)) {
                    actuators.fan_in = true;
                    notifications.push({
                        title: "Suhu Tinggi",
                        message: `Suhu kandang ${sensorData.temperature}°C melebihi batas maksimal ${threshold.temp_max}°C. Kipas (fan_in) diaktifkan.`
                    });
                } else if (sensorData.temperature < parseFloat(threshold.temp_min)) {
                    actuators.heater = true;
                    notifications.push({
                        title: "Suhu Rendah",
                        message: `Suhu kandang ${sensorData.temperature}°C di bawah batas minimal ${threshold.temp_min}°C. Pemanas (heater) diaktifkan.`
                    });
                }

                // Evaluate Humidity Media (Pump)
                if (sensorData.humidity_media < parseFloat(threshold.media_hum_min)) {
                    actuators.pump = true;
                    notifications.push({
                        title: "Media Kering",
                        message: `Kelembapan media ${sensorData.humidity_media}% di bawah batas minimal ${threshold.media_hum_min}%. Pompa air diaktifkan.`
                    });
                }
            } else {
                // Fallback to simple hardcoded if no threshold exists in DB
                actuators.fan_in = sensorData.temperature > 28;
                actuators.pump = sensorData.humidity_media < 40;
                actuators.heater = sensorData.temperature < 25;
            }

            const activeActuators = Object.keys(actuators).filter(key => actuators[key]);

            // 2. Transaction: Insert Logs and Notifications + Sync Queue
            if (activeActuators.length > 0 || notifications.length > 0) {
                const automationTransaction = localDb.transaction((acts, notifs) => {
                    const expId = experimentService.getActiveExperimentId() || null;
                    
                    // Log Actuators
                    for (const act of acts) {
                        const actId = crypto.randomUUID();
                        const actLog = {
                            id: actId,
                            tenant_id: sensorData.tenant_id,
                            box_id: sensorData.box_id,
                            threshold_id: thresholdId,
                            actuator_type: act,
                            action: 'ON',
                            trigger_source: sensorData.source === 'dataset' ? 'replay_automation' : 'automation',
                            notes: `Triggered by Temp: ${sensorData.temperature}, Media Hum: ${sensorData.humidity_media}`,
                            experiment_session_id: expId
                        };
                        
                        localDb.prepare(`
                            INSERT INTO actuator_logs 
                            (id, tenant_id, box_id, threshold_id, actuator_type, action, trigger_source, notes, experiment_session_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(actLog.id, actLog.tenant_id, actLog.box_id, actLog.threshold_id, actLog.actuator_type, actLog.action, actLog.trigger_source, actLog.notes, actLog.experiment_session_id);
                        
                        queueService.enqueueSync('actuator_logs', actId, 'INSERT', actLog);
                    }

                    // Log Notifications
                    for (const notif of notifs) {
                        const notifId = crypto.randomUUID();
                        const notifRecord = {
                            id: notifId,
                            tenant_id: sensorData.tenant_id,
                            box_id: sensorData.box_id,
                            category: 'alert',
                            severity: 'warning',
                            title: notif.title,
                            message: notif.message,
                            is_read: 0
                        };
                        
                        localDb.prepare(`
                            INSERT INTO notifications 
                            (id, tenant_id, box_id, category, severity, title, message, is_read)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(notifRecord.id, notifRecord.tenant_id, notifRecord.box_id, notifRecord.category, notifRecord.severity, notifRecord.title, notifRecord.message, notifRecord.is_read);

                        queueService.enqueueSync('notifications', notifId, 'INSERT', notifRecord);
                    }
                });

                automationTransaction(activeActuators, notifications);
            }

            const end = performance.now();
            const durationMs = end - start;
            console.log(`[Automation] Evaluated Box ${sensorData.box_id} in ${durationMs.toFixed(2)}ms. Triggers: ${activeActuators.join(', ') || 'None'}`);

            return {
                actuators,
                durationMs
            };

        } catch (error) {
            console.error("[Automation] Evaluation error:", error);
            // Return safe default to not break pipeline
            return {
                actuators: { fan_in: false, pump: false, heater: false },
                durationMs: performance.now() - start
            };
        }
    }
}

module.exports = new AutomationService();
