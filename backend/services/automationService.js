const crypto = require('crypto');
const pool = require('../db');
const localDb = require('../edge/localDatabase');
const queueService = require('../edge/queueService');
const experimentService = require('./experimentService');
const { performance } = require('perf_hooks');

class AutomationService {
    constructor() {
        // Cache actuator states and timestamps to simulate cooldown/hysteresis
        this.stateCache = {};
        // Cooldown in dataset time (milliseconds) -> 5 minutes = 300,000 ms
        this.COOLDOWN_MS = 5 * 60 * 1000; 
    }
    
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
        
        const cacheKey = `${sensorData.tenant_id}_${sensorData.box_id}`;
        if (!this.stateCache[cacheKey]) {
            this.stateCache[cacheKey] = {
                fan_in: { state: false, lastChanged: 0 },
                pump: { state: false, lastChanged: 0 },
                heater: { state: false, lastChanged: 0 }
            };
        }
        const cache = this.stateCache[cacheKey];
        const currentTs = sensorData.timestamp || Date.now();

        try {
            // 1. Fetch Threshold for this floor/room
            const thresholdQuery = await pool.query(`
                SELECT * FROM automation_thresholds 
                WHERE tenant_id = $1 AND floor_level = $2
                LIMIT 1
            `, [sensorData.tenant_id, roomNumber]);

            let targetFan = false;
            let targetPump = false;
            let targetHeater = false;

            if (thresholdQuery.rows.length > 0) {
                const threshold = thresholdQuery.rows[0];
                thresholdId = threshold.id;

                // Evaluate Temperature (Heater, Fan)
                if (sensorData.temperature > parseFloat(threshold.temp_max)) {
                    targetFan = true;
                } else if (sensorData.temperature < parseFloat(threshold.temp_min)) {
                    targetHeater = true;
                }

                // Evaluate Humidity Media (Pump)
                if (sensorData.humidity_media < parseFloat(threshold.media_hum_min)) {
                    targetPump = true;
                }
            } else {
                // Fallback to simple hardcoded if no threshold exists in DB
                targetFan = sensorData.temperature > 28;
                targetPump = sensorData.humidity_media < 40;
                targetHeater = sensorData.temperature < 25;
            }

            // Apply Cooldown / Hysteresis
            const applyCooldown = (actName, targetState, titleOn, msgOn, titleOff, msgOff) => {
                const stateObj = cache[actName];
                const timeSinceLastChange = currentTs - stateObj.lastChanged;
                
                // If we want to change state, check cooldown
                if (targetState !== stateObj.state) {
                    // Always allow turning ON immediately, but enforce cooldown when turning OFF
                    // OR enforce cooldown for both. Let's enforce for both to prevent rapid oscillation.
                    if (timeSinceLastChange > this.COOLDOWN_MS) {
                        stateObj.state = targetState;
                        stateObj.lastChanged = currentTs;
                        actuators[actName] = targetState;
                        
                        if (targetState && titleOn) {
                            notifications.push({ title: titleOn, message: msgOn });
                        } else if (!targetState && titleOff) {
                            notifications.push({ title: titleOff, message: msgOff });
                        }
                    } else {
                        // Cooldown active, keep previous state
                        actuators[actName] = stateObj.state;
                    }
                } else {
                    // No change desired
                    actuators[actName] = stateObj.state;
                }
            };

            applyCooldown('fan_in', targetFan, 
                "Suhu Tinggi", `Suhu kandang ${sensorData.temperature.toFixed(2)}°C melebihi batas. Kipas diaktifkan.`,
                "Suhu Normal", `Suhu kandang ${sensorData.temperature.toFixed(2)}°C normal. Kipas dimatikan.`
            );
            
            applyCooldown('heater', targetHeater, 
                "Suhu Rendah", `Suhu kandang ${sensorData.temperature.toFixed(2)}°C di bawah batas. Pemanas diaktifkan.`,
                "Suhu Normal", `Suhu kandang ${sensorData.temperature.toFixed(2)}°C normal. Pemanas dimatikan.`
            );
            
            applyCooldown('pump', targetPump, 
                "Media Kering", `Kelembapan media ${sensorData.humidity_media.toFixed(2)}% di bawah batas. Pompa diaktifkan.`,
                "Media Normal", `Kelembapan media ${sensorData.humidity_media.toFixed(2)}% normal. Pompa dimatikan.`
            );

            // Log state changes to Actuator Logs (only if it just changed)
            // We can detect changes by checking if current actuators[key] is different from the target we evaluated,
            // wait, we just pushed notifications if it changed. Let's track actual changes.
            const newlyChangedActuators = [];
            for (const key of ['fan_in', 'pump', 'heater']) {
                if (cache[key].lastChanged === currentTs) {
                    newlyChangedActuators.push({ name: key, state: cache[key].state });
                }
            }

            // 2. Transaction: Insert Logs and Notifications + Sync Queue
            if (newlyChangedActuators.length > 0 || notifications.length > 0) {
                const automationTransaction = localDb.transaction((changedActs, notifs) => {
                    const expId = experimentService.getActiveExperimentId() || null;
                    
                    // Log Actuators
                    for (const act of changedActs) {
                        const actId = crypto.randomUUID();
                        const actLog = {
                            id: actId,
                            tenant_id: sensorData.tenant_id,
                            box_id: sensorData.box_id,
                            threshold_id: thresholdId,
                            actuator_type: act.name,
                            action: act.state ? 'ON' : 'OFF',
                            trigger_source: sensorData.source === 'dataset' ? 'replay_automation' : 'automation',
                            notes: `Triggered by Temp: ${sensorData.temperature.toFixed(2)}, Media Hum: ${sensorData.humidity_media.toFixed(2)}`,
                            experiment_session_id: expId,
                            recorded_at: new Date(currentTs).toISOString()
                        };
                        
                        localDb.prepare(`
                            INSERT INTO actuator_logs 
                            (id, tenant_id, box_id, threshold_id, actuator_type, action, trigger_source, notes, experiment_session_id, recorded_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(actLog.id, actLog.tenant_id, actLog.box_id, actLog.threshold_id, actLog.actuator_type, actLog.action, actLog.trigger_source, actLog.notes, actLog.experiment_session_id, actLog.recorded_at);
                        
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
                            is_read: 0,
                            created_at: new Date(currentTs).toISOString()
                        };
                        
                        localDb.prepare(`
                            INSERT INTO notifications 
                            (id, tenant_id, box_id, category, severity, title, message, is_read, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(notifRecord.id, notifRecord.tenant_id, notifRecord.box_id, notifRecord.category, notifRecord.severity, notifRecord.title, notifRecord.message, notifRecord.is_read, notifRecord.created_at);

                        queueService.enqueueSync('notifications', notifId, 'INSERT', notifRecord);
                    }
                });

                automationTransaction(newlyChangedActuators, notifications);
            }

            const end = performance.now();
            const durationMs = end - start;
            
            // Only log if something changed
            if (newlyChangedActuators.length > 0) {
                console.log(`[Automation] Evaluated Box ${sensorData.box_id} in ${durationMs.toFixed(2)}ms. State changes: ${newlyChangedActuators.map(a => `${a.name}=${a.state ? 'ON' : 'OFF'}`).join(', ')}`);
            }

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
