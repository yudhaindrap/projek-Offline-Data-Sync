require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASS),
    port: process.env.DB_PORT,
});

function addNoise(val, range) {
    return val + (Math.random() * range * 2) - range;
}

// 1. STATISTICAL EXTRACTOR
async function analyzeCSV(filename) {
    const filePath = path.join(__dirname, 'research', 'datasets', 'raw', filename);
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const hourlyStats = {}; 
    for (let i = 0; i < 24; i++) {
        hourlyStats[i] = { temp: [], hum: [], heater: [], fan: [], media: [] };
    }

    let isFirst = true;
    let headers = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        if (isFirst) {
            headers = line.split(',').map(h => h.trim());
            isFirst = false;
            continue;
        }

        const parts = line.split(',');
        const record = {};
        headers.forEach((h, i) => record[h] = parts[i] ? parts[i].trim() : null);

        if (!record.recorded_at) continue;

        const ts = new Date(record.recorded_at);
        if (isNaN(ts.getTime())) continue;

        const hour = ts.getUTCHours(); // Normalize to UTC or Local depending on dataset
        
        const temp = parseFloat(record.temp_air_in);
        const hum = parseFloat(record.rh_in);
        const media = parseFloat(record.temp_media) || 28.0;
        const heater = record.heater_status === 'true' || record.heater_status === 'ON' ? 1 : 0;
        const fan = (parseInt(record.fan_intake_pwm) > 0) ? 1 : 0;

        if (!isNaN(temp)) hourlyStats[hour].temp.push(temp);
        if (!isNaN(hum)) hourlyStats[hour].hum.push(hum);
        if (!isNaN(media)) hourlyStats[hour].media.push(media);
        hourlyStats[hour].heater.push(heater);
        hourlyStats[hour].fan.push(fan);
    }

    // Calculate Means and Variances per hour
    const model = {};
    for (let i = 0; i < 24; i++) {
        const tArr = hourlyStats[i].temp;
        const hArr = hourlyStats[i].hum;
        const mArr = hourlyStats[i].media;
        const heaterArr = hourlyStats[i].heater;
        const fanArr = hourlyStats[i].fan;

        if (tArr.length === 0) continue; // Skip if no data for that hour

        const tMean = tArr.reduce((a, b) => a + b, 0) / tArr.length;
        const hMean = hArr.reduce((a, b) => a + b, 0) / hArr.length;
        const mMean = mArr.reduce((a, b) => a + b, 0) / mArr.length;
        
        // Variance estimation for realistic noise
        const tVar = tArr.reduce((a, b) => a + Math.pow(b - tMean, 2), 0) / tArr.length;
        const hVar = hArr.reduce((a, b) => a + Math.pow(b - hMean, 2), 0) / hArr.length;

        const heaterProb = heaterArr.reduce((a, b) => a + b, 0) / heaterArr.length;
        const fanProb = fanArr.reduce((a, b) => a + b, 0) / fanArr.length;

        model[i] = {
            tMean, tStd: Math.sqrt(tVar) || 0.5,
            hMean, hStd: Math.sqrt(hVar) || 1.0,
            mMean,
            heaterProb,
            fanProb
        };
    }
    return model;
}

// 2. SEED ENGINE
async function seedDatabase() {
    try {
        console.log('Menghubungkan ke database PostgreSQL...');
        await client.connect();
        
        console.log('Mengekstraksi model statistik dari Ground Truth CSV...');
        // We use 03_Data_Kontrol_Threshold_24_Jam.csv as the base model
        const statModel = await analyzeCSV('03_Data_Kontrol_Threshold_24_Jam.csv');
        console.log('Model Statistik berhasil diekstrak.');

        console.log('Membersihkan tabel (Cascade)...');
        await client.query(`
            DROP TABLE IF EXISTS cv_detections CASCADE;
            DROP TABLE IF EXISTS actuators CASCADE;
            DROP TABLE IF EXISTS thresholds CASCADE;
            DROP TABLE IF EXISTS notifications CASCADE;
            DROP TABLE IF EXISTS harvest_predictions CASCADE;
            DROP TABLE IF EXISTS cv_results CASCADE;
            DROP TABLE IF EXISTS actuator_logs CASCADE;
            DROP TABLE IF EXISTS sensor_data CASCADE;
            DROP TABLE IF EXISTS automation_thresholds CASCADE;
            DROP TABLE IF EXISTS box_locations CASCADE;
            DROP TABLE IF EXISTS boxes CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS tenants CASCADE;
            DROP TABLE IF EXISTS experiment_sessions CASCADE;
        `);

        console.log('Membangun ulang struktur tabel...');
        await client.query(`
            CREATE TABLE tenants (
                id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, tenant_code VARCHAR(100) UNIQUE,
                contact_person VARCHAR(255), phone VARCHAR(50), address TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE users (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, username VARCHAR(100),
                email VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(50), is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE experiment_sessions (
                id UUID PRIMARY KEY, experiment_name VARCHAR(255), description TEXT, network_mode VARCHAR(50),
                sampling_interval INT, started_at TIMESTAMP, finished_at TIMESTAMP, status VARCHAR(50), created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE boxes (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, box_code VARCHAR(100) UNIQUE,
                box_name VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'active', description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE box_locations (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                room_number INT, slot_number VARCHAR(50), start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, end_at TIMESTAMP,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE automation_thresholds (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, floor_level INT,
                temp_min NUMERIC(5, 2), temp_max NUMERIC(5, 2), air_hum_min NUMERIC(5, 2), air_hum_max NUMERIC(5, 2), media_hum_min NUMERIC(5, 2), media_hum_max NUMERIC(5, 2)
            );
            CREATE TABLE sensor_data (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                temperature NUMERIC(5, 2), humidity_air NUMERIC(5, 2), humidity_media NUMERIC(5, 2), source VARCHAR(100),
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE actuator_logs (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                threshold_id UUID REFERENCES automation_thresholds(id) ON DELETE SET NULL, actuator_type VARCHAR(50), action VARCHAR(50),
                trigger_source VARCHAR(100), notes TEXT, experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE cv_results (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                baby_larva_count INT DEFAULT 0, adult_larva_count INT DEFAULT 0, prepupa_count INT DEFAULT 0, pupa_count INT DEFAULT 0,
                dominant_phase VARCHAR(100), confidence NUMERIC(5, 2), image_path VARCHAR(255), experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE harvest_predictions (
                id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                sensor_data_id UUID REFERENCES sensor_data(id) ON DELETE SET NULL, cv_result_id UUID REFERENCES cv_results(id) ON DELETE SET NULL,
                predicted_days INT, input_temperature NUMERIC(5, 2), input_humidity_air NUMERIC(5, 2), input_humidity_media NUMERIC(5, 2),
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL, predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insert Master Data
        const tenantId = crypto.randomUUID();
        await client.query(`INSERT INTO tenants (id, name, tenant_code, contact_person) VALUES ($1, 'Bio Maggot Farm HQ', 'TENT-HQ', 'Lead Researcher')`, [tenantId]);

        const adminId = crypto.randomUUID();
        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash('admin123', salt);
        await client.query(`INSERT INTO users (id, tenant_id, username, email, password, role) VALUES ($1, $2, 'Admin Research', 'admin@admin.maggot', $3, 'admin')`, [adminId, tenantId, adminPassword]);

        const thresholdId = crypto.randomUUID();
        await client.query(`INSERT INTO automation_thresholds (id, tenant_id, floor_level, temp_min, temp_max, air_hum_min, air_hum_max, media_hum_min, media_hum_max) VALUES ($1, $2, 2, 24.0, 30.0, 60.0, 85.0, 60.0, 80.0)`, [thresholdId, tenantId]);

        const boxes = [
            { name: 'Box Alpha', ageOffset: 12, baseOffset: 0.0 },
            { name: 'Box Beta', ageOffset: 8, baseOffset: -0.5 },
            { name: 'Box Gamma', ageOffset: 18, baseOffset: +1.0 },
            { name: 'Box Delta', ageOffset: 4, baseOffset: +0.2 },
            { name: 'Box Epsilon', ageOffset: 25, baseOffset: -0.2 }
        ];

        const boxIds = {};
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            const bId = crypto.randomUUID();
            boxIds[b.name] = bId;
            await client.query(`INSERT INTO boxes (id, tenant_id, box_code, box_name) VALUES ($1, $2, $3, $4)`, [bId, tenantId, `BOX-00${i+1}`, b.name]);
            await client.query(`INSERT INTO box_locations (id, tenant_id, box_id, room_number, slot_number, created_by) VALUES ($1, $2, $3, 2, $4, $5)`, [crypto.randomUUID(), tenantId, bId, `S-${i+1}`, adminId]);
        }

        // GENERATE HISTORICAL DATA (30 DAYS, 10 min intervals) based on stat model
        console.log('Memulai generasi dataset (30 hari)... Ini akan memakan waktu sejenak.');
        const DAYS = 30;
        const INTERVAL_MIN = 10;
        const START_TIME = new Date();
        START_TIME.setDate(START_TIME.getDate() - DAYS);
        
        let totalRecords = 0;

        for (let b of boxes) {
            let bId = boxIds[b.name];
            let sensorBuffer = [];
            let actuatorBuffer = [];
            
            let currentTime = new Date(START_TIME);
            const endTime = new Date();
            
            // To simulate cause and effect, we track current states
            let isHeaterOn = false;
            let isFanOn = false;

            while (currentTime <= endTime) {
                const h = currentTime.getUTCHours();
                const model = statModel[h] || { tMean: 28, tStd: 1, hMean: 70, hStd: 2, mMean: 27, heaterProb: 0, fanProb: 0 };
                
                // Normal distribution approximation using Central Limit Theorem
                let tNoise = addNoise(0, model.tStd);
                let hNoise = addNoise(0, model.hStd);

                let currentTemp = model.tMean + b.baseOffset + tNoise;
                let currentHum = model.hMean - (b.baseOffset * 2) + hNoise;
                let currentMediaHum = model.mMean + addNoise(0, 0.5);

                // Actuator triggers based on real probabilities from dataset
                let triggerHeater = Math.random() < model.heaterProb;
                let triggerFan = Math.random() < model.fanProb;

                if (triggerHeater && !isHeaterOn) {
                    isHeaterOn = true;
                    actuatorBuffer.push(`('${crypto.randomUUID()}', '${tenantId}', '${bId}', '${thresholdId}', 'heater', 'ON', 'automation', '${currentTime.toISOString()}')`);
                } else if (!triggerHeater && isHeaterOn) {
                    isHeaterOn = false;
                    actuatorBuffer.push(`('${crypto.randomUUID()}', '${tenantId}', '${bId}', '${thresholdId}', 'heater', 'OFF', 'automation', '${currentTime.toISOString()}')`);
                }

                if (triggerFan && !isFanOn) {
                    isFanOn = true;
                    actuatorBuffer.push(`('${crypto.randomUUID()}', '${tenantId}', '${bId}', '${thresholdId}', 'fan_out', 'ON', 'automation', '${currentTime.toISOString()}')`);
                } else if (!triggerFan && isFanOn) {
                    isFanOn = false;
                    actuatorBuffer.push(`('${crypto.randomUUID()}', '${tenantId}', '${bId}', '${thresholdId}', 'fan_out', 'OFF', 'automation', '${currentTime.toISOString()}')`);
                }

                const sId = crypto.randomUUID();
                sensorBuffer.push(`('${sId}', '${tenantId}', '${bId}', ${currentTemp.toFixed(2)}, ${currentHum.toFixed(2)}, ${currentMediaHum.toFixed(2)}, 'device', '${currentTime.toISOString()}')`);
                totalRecords++;
                
                if (sensorBuffer.length >= 2000) {
                    await client.query(`INSERT INTO sensor_data (id, tenant_id, box_id, temperature, humidity_air, humidity_media, source, recorded_at) VALUES ${sensorBuffer.join(',')}`);
                    if (actuatorBuffer.length > 0) {
                        await client.query(`INSERT INTO actuator_logs (id, tenant_id, box_id, threshold_id, actuator_type, action, trigger_source, recorded_at) VALUES ${actuatorBuffer.join(',')}`);
                    }
                    sensorBuffer = []; actuatorBuffer = [];
                    process.stdout.write(`.`); 
                }

                currentTime.setMinutes(currentTime.getMinutes() + INTERVAL_MIN);
            }
            
            // Flush remaining
            if (sensorBuffer.length > 0) {
                await client.query(`INSERT INTO sensor_data (id, tenant_id, box_id, temperature, humidity_air, humidity_media, source, recorded_at) VALUES ${sensorBuffer.join(',')}`);
            }
            if (actuatorBuffer.length > 0) {
                await client.query(`INSERT INTO actuator_logs (id, tenant_id, box_id, threshold_id, actuator_type, action, trigger_source, recorded_at) VALUES ${actuatorBuffer.join(',')}`);
            }
            console.log(`\n✅ Box ${b.name} seeded successfully.`);
        }

        console.log(`\n🎉 SEEDING COMPLETE!`);
        console.log(`- Sensor Records Generated: ${totalRecords}`);
        
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat seeding:', error);
    } finally {
        await client.end();
        console.log('Koneksi database ditutup.');
    }
}

seedDatabase();
