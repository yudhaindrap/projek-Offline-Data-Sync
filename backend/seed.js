// backend/seed.js
require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASS),
    port: process.env.DB_PORT,
});

async function seedDatabase() {
    try {
        console.log('Menghubungkan ke database...');
        await client.connect();
        console.log('Koneksi berhasil. Memulai proses seeding...\n');

        console.log('Membuat tabel baru jika belum ada...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS tenants (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                tenant_code VARCHAR(100) UNIQUE,
                contact_person VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                username VARCHAR(100),
                email VARCHAR(255) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS experiment_sessions (
                id UUID PRIMARY KEY,
                experiment_name VARCHAR(255),
                description TEXT,
                network_mode VARCHAR(50),
                sampling_interval INT,
                started_at TIMESTAMP,
                finished_at TIMESTAMP,
                status VARCHAR(50),
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS boxes (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_code VARCHAR(100) UNIQUE,
                box_name VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS box_locations (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                room_number INT,
                slot_number VARCHAR(50),
                start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_at TIMESTAMP,
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS automation_thresholds (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                floor_level INT,
                temp_min NUMERIC(5, 2),
                temp_max NUMERIC(5, 2),
                air_hum_min NUMERIC(5, 2),
                air_hum_max NUMERIC(5, 2),
                media_hum_min NUMERIC(5, 2),
                media_hum_max NUMERIC(5, 2)
            );

            CREATE TABLE IF NOT EXISTS sensor_data (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                temperature NUMERIC(5, 2),
                humidity_air NUMERIC(5, 2),
                humidity_media NUMERIC(5, 2),
                source VARCHAR(100),
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS actuator_logs (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                threshold_id UUID REFERENCES automation_thresholds(id) ON DELETE SET NULL,
                actuator_type VARCHAR(50),
                action VARCHAR(50),
                trigger_source VARCHAR(100),
                notes TEXT,
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cv_results (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                baby_larva_count INT DEFAULT 0,
                adult_larva_count INT DEFAULT 0,
                prepupa_count INT DEFAULT 0,
                pupa_count INT DEFAULT 0,
                dominant_phase VARCHAR(100),
                confidence NUMERIC(5, 2),
                image_path VARCHAR(255),
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS harvest_predictions (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                sensor_data_id UUID REFERENCES sensor_data(id) ON DELETE SET NULL,
                cv_result_id UUID REFERENCES cv_results(id) ON DELETE SET NULL,
                predicted_days INT,
                input_temperature NUMERIC(5, 2),
                input_humidity_air NUMERIC(5, 2),
                input_humidity_media NUMERIC(5, 2),
                experiment_session_id UUID REFERENCES experiment_sessions(id) ON DELETE SET NULL,
                predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
                category VARCHAR(100),
                severity VARCHAR(50),
                title VARCHAR(255),
                message TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Memeriksa atau menambahkan data seed...');

        // 1. Tenant
        let tenantId;
        const tenantRes = await client.query("SELECT id FROM tenants WHERE tenant_code = 'TENT-A'");
        if (tenantRes.rows.length > 0) {
            tenantId = tenantRes.rows[0].id;
            console.log('Tenant sudah ada.');
        } else {
            tenantId = crypto.randomUUID();
            await client.query(`
                INSERT INTO tenants (id, name, tenant_code, contact_person, phone, address, is_active) VALUES 
                ($1, 'Tenant A', 'TENT-A', 'Budi Santoso', '08123456789', 'Jl. Peternakan No. 12', true)
            `, [tenantId]);
            console.log('Tenant baru ditambahkan.');
        }

        // 2. Users
        let adminId;
        const adminRes = await client.query("SELECT id FROM users WHERE email = 'admin@admin.maggot'");
        if (adminRes.rows.length > 0) {
            adminId = adminRes.rows[0].id;
            console.log('User admin sudah ada.');
        } else {
            adminId = crypto.randomUUID();
            const salt = await bcrypt.genSalt(10);
            const adminPassword = await bcrypt.hash('admin123', salt);
            await client.query(`
                INSERT INTO users (id, tenant_id, username, email, password, role) VALUES 
                ($1, NULL, 'Admin', 'admin@admin.maggot', $2, 'admin')
            `, [adminId, adminPassword]);
            console.log('User admin baru ditambahkan.');
        }

        let operatorId;
        const opRes = await client.query("SELECT id FROM users WHERE email = 'Pembudidaya@maggot.com'");
        if (opRes.rows.length > 0) {
            operatorId = opRes.rows[0].id;
            console.log('User pembudidaya sudah ada.');
        } else {
            operatorId = crypto.randomUUID();
            const salt = await bcrypt.genSalt(10);
            const operatorPassword = await bcrypt.hash('pembudidaya123', salt);
            await client.query(`
                INSERT INTO users (id, tenant_id, username, email, password, role) VALUES 
                ($1, $2, 'Pembudidaya', 'Pembudidaya@maggot.com', $3, 'pembudidaya')
            `, [operatorId, tenantId, operatorPassword]);
            console.log('User pembudidaya baru ditambahkan.');
        }

        // 3. Boxes
        const boxCodes = ['BOX-001', 'BOX-002', 'BOX-003'];
        const boxNames = ['Box 1', 'Box 2', 'Box 3'];
        const boxIds = [];

        for (let i = 0; i < boxCodes.length; i++) {
            const boxRes = await client.query("SELECT id FROM boxes WHERE box_code = $1", [boxCodes[i]]);
            if (boxRes.rows.length > 0) {
                boxIds.push(boxRes.rows[0].id);
            } else {
                const newBoxId = crypto.randomUUID();
                await client.query(`
                    INSERT INTO boxes (id, tenant_id, box_code, box_name, status) VALUES 
                    ($1, $2, $3, $4, 'active')
                `, [newBoxId, tenantId, boxCodes[i], boxNames[i]]);
                
                await client.query(`
                    INSERT INTO box_locations (id, tenant_id, box_id, room_number, slot_number, start_at, created_by) VALUES 
                    ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
                `, [crypto.randomUUID(), tenantId, newBoxId, (i === 2 ? 3 : 2), `A${i+1}`, adminId]);
                
                boxIds.push(newBoxId);
            }
        }
        console.log('Box selesai disiapkan.');

        // 4. Threshold & Dummy Data (Sensor, Actuator, CV, dll.)
        const thresholdRes = await client.query("SELECT id FROM automation_thresholds WHERE tenant_id = $1 LIMIT 1", [tenantId]);
        if (thresholdRes.rows.length === 0) {
            console.log('Menambahkan data dummy sensor dan hasil CV...');
            const thresholdId = crypto.randomUUID();
            await client.query(`
                INSERT INTO automation_thresholds (id, tenant_id, floor_level, temp_min, temp_max, air_hum_min, air_hum_max, media_hum_min, media_hum_max) VALUES 
                ($1, $2, 2, 24.0, 28.0, 80.0, 95.0, 60.0, 80.0)
            `, [thresholdId, tenantId]);

            for (const bId of boxIds) {
                const sd1Id = crypto.randomUUID();
                const sd2Id = crypto.randomUUID();
                const sd3Id = crypto.randomUUID();

                await client.query(`
                    INSERT INTO sensor_data (id, tenant_id, box_id, temperature, humidity_air, humidity_media, source) VALUES 
                    ($1, $5, $4, 26.5, 85.0, 70.5, 'device'),
                    ($2, $5, $4, 26.8, 84.5, 69.8, 'device'),
                    ($3, $5, $4, 27.1, 83.0, 68.0, 'device')
                `, [sd1Id, sd2Id, sd3Id, bId, tenantId]);

                const actuators = ['heater', 'fan_in', 'fan_out', 'solenoid', 'servo', 'pump'];
                for (const type of actuators) {
                    const action = Math.random() > 0.5 ? 'ON' : 'OFF';
                    await client.query(`
                        INSERT INTO actuator_logs (id, tenant_id, box_id, threshold_id, actuator_type, action, trigger_source) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [crypto.randomUUID(), tenantId, bId, thresholdId, type, action, 'automation']);
                }

                const cvId = crypto.randomUUID();
                const imgPath = '/mock-images/box' + bId + '_latest.jpg';
                await client.query(`
                    INSERT INTO cv_results (id, tenant_id, box_id, baby_larva_count, adult_larva_count, prepupa_count, pupa_count, dominant_phase, confidence, image_path) VALUES 
                    ($1, $2, $3, 15, 40, 2, 0, 'Primordia', 92.5, $4)
                `, [cvId, tenantId, bId, imgPath]);

                const estDays = Math.floor(Math.random() * 10) + 1;
                await client.query(`
                    INSERT INTO harvest_predictions (id, tenant_id, box_id, sensor_data_id, cv_result_id, predicted_days, input_temperature, input_humidity_air, input_humidity_media) VALUES 
                    ($1, $2, $3, $4, $5, $6, 27.1, 83.0, 68.0)
                `, [crypto.randomUUID(), tenantId, bId, sd3Id, cvId, estDays]);
            }

            await client.query(`
                INSERT INTO notifications (id, tenant_id, box_id, category, severity, title, message) VALUES 
                ($1, $2, $3, 'system', 'info', 'Setup Selesai', 'Sistem berhasil diinisiasi untuk pertama kalinya.')
            `, [crypto.randomUUID(), tenantId, boxIds[0]]);
        } else {
            console.log('Data dummy sudah ada. Dilewati.');
        }

        console.log('\n✅ Database berhasil diisi dengan schema dan data baru (secara aman)!');
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat seeding:', error);
    } finally {
        await client.end();
        console.log('Koneksi database ditutup.');
    }
}

seedDatabase();