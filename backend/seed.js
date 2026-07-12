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

        console.log('Menghapus tabel lama jika ada...');
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
        `);

        console.log('Membuat tabel baru...');
        await client.query(`
            CREATE TABLE tenants (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                tenant_code VARCHAR(100) UNIQUE,
                contact_person VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE users (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                username VARCHAR(100),
                email VARCHAR(255) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE experiment_sessions (
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

            CREATE TABLE boxes (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                box_code VARCHAR(100) UNIQUE,
                box_name VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE box_locations (
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

            CREATE TABLE automation_thresholds (
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

            CREATE TABLE sensor_data (
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

            CREATE TABLE actuator_logs (
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

            CREATE TABLE cv_results (
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

            CREATE TABLE harvest_predictions (
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

            CREATE TABLE notifications (
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

        console.log('Menambahkan data seed...');
        const tenantId = crypto.randomUUID();
        await client.query(`
            INSERT INTO tenants (id, name, tenant_code, contact_person, phone, address, is_active) VALUES 
            ($1, 'Tenant A', 'TENT-A', 'Budi Santoso', '08123456789', 'Jl. Peternakan No. 12', true)
        `, [tenantId]);

        const adminId = crypto.randomUUID();
        const operatorId = crypto.randomUUID();
        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash('admin123', salt);
        const operatorPassword = await bcrypt.hash('pembudidaya123', salt);

        await client.query(`
            INSERT INTO users (id, tenant_id, username, email, password, role) VALUES 
            ($1, NULL, 'Admin', 'admin@admin.maggot', $2, 'admin'),
            ($3, $4, 'Pembudidaya', 'Pembudidaya@maggot.com', $5, 'pembudidaya')
        `, [adminId, adminPassword, operatorId, tenantId, operatorPassword]);

        const box1Id = crypto.randomUUID();
        const box2Id = crypto.randomUUID();
        const box3Id = crypto.randomUUID();

        await client.query(`
            INSERT INTO boxes (id, tenant_id, box_code, box_name, status) VALUES 
            ($1, $4, 'BOX-001', 'Box 1', 'active'),
            ($2, $4, 'BOX-002', 'Box 2', 'active'),
            ($3, $4, 'BOX-003', 'Box 3', 'active')
        `, [box1Id, box2Id, box3Id, tenantId]);

        await client.query(`
            INSERT INTO box_locations (id, tenant_id, box_id, room_number, slot_number, start_at, created_by) VALUES 
            ($1, $7, $4, 2, 'A1', CURRENT_TIMESTAMP, $8), 
            ($2, $7, $5, 2, 'A2', CURRENT_TIMESTAMP, $8), 
            ($3, $7, $6, 3, 'B1', CURRENT_TIMESTAMP, $8)
        `, [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), box1Id, box2Id, box3Id, tenantId, adminId]);

        const thresholdId = crypto.randomUUID();
        await client.query(`
            INSERT INTO automation_thresholds (id, tenant_id, floor_level, temp_min, temp_max, air_hum_min, air_hum_max, media_hum_min, media_hum_max) VALUES 
            ($1, $2, 2, 24.0, 28.0, 80.0, 95.0, 60.0, 80.0)
        `, [thresholdId, tenantId]);

        const boxIds = [box1Id, box2Id, box3Id];
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
            await client.query(`
                INSERT INTO cv_results (id, tenant_id, box_id, baby_larva_count, adult_larva_count, prepupa_count, pupa_count, dominant_phase, confidence, image_path) VALUES 
                ($1, $2, $3, 15, 40, 2, 0, 'Primordia', 92.5, '/mock-images/box${bId}_latest.jpg')
            `, [cvId, tenantId, bId]);

            const estDays = Math.floor(Math.random() * 10) + 1;
            await client.query(`
                INSERT INTO harvest_predictions (id, tenant_id, box_id, sensor_data_id, cv_result_id, predicted_days, input_temperature, input_humidity_air, input_humidity_media) VALUES 
                ($1, $2, $3, $4, $5, $6, 27.1, 83.0, 68.0)
            `, [crypto.randomUUID(), tenantId, bId, sd3Id, cvId, estDays]);
        }

        // Add dummy notification
        await client.query(`
            INSERT INTO notifications (id, tenant_id, box_id, category, severity, title, message) VALUES 
            ($1, $2, $3, 'system', 'info', 'Setup Selesai', 'Sistem berhasil diinisiasi untuk pertama kalinya.')
        `, [crypto.randomUUID(), tenantId, box1Id]);

        console.log('\n✅ Database berhasil diisi dengan schema dan data baru!');
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat seeding:', error);
    } finally {
        await client.end();
        console.log('Koneksi database ditutup.');
    }
}

seedDatabase();