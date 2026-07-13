require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/db');
const crypto = require('crypto');

console.log("📹 Memulai Simulasi Computer Vision YOLOv8 (PostgreSQL)...");

const phases = ["Primordia", "Baby Larva", "Adult Larva", "Prepupa", "Pupa"];

async function startSimulation() {
    try {
        const boxRes = await pool.query('SELECT id, tenant_id FROM boxes LIMIT 10');
        if (boxRes.rows.length === 0) {
            console.error("❌ Tidak ada box ditemukan di database. Jalankan seed.js terlebih dahulu.");
            process.exit(1);
        }
        const boxes = boxRes.rows;
        let index = 0;

        setInterval(async () => {
            try {
                const box = boxes[index];
                const dominantPhase = phases[Math.floor(Math.random() * phases.length)];
                const confidenceScore = parseFloat((75 + Math.random() * 24).toFixed(2)); // 75.00 - 99.00

                const baby_larva_count = Math.floor(Math.random() * 50);
                const adult_larva_count = Math.floor(Math.random() * 50);
                const prepupa_count = Math.floor(Math.random() * 20);
                const pupa_count = Math.floor(Math.random() * 10);

                const cvId = crypto.randomUUID();
                const imageUrl = `/mock-images/box_${index+1}_${Date.now()}.jpg`;

                const query = `
                    INSERT INTO cv_results (id, tenant_id, box_id, baby_larva_count, adult_larva_count, prepupa_count, pupa_count, dominant_phase, confidence, image_path)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *;
                `;
                
                await pool.query(query, [
                    cvId,
                    box.tenant_id,
                    box.id,
                    baby_larva_count,
                    adult_larva_count,
                    prepupa_count,
                    pupa_count,
                    dominantPhase,
                    confidenceScore,
                    imageUrl
                ]);

                console.log(`📸 CV Simulated - Box UUID: ${box.id.substring(0,8)}... | Phase: ${dominantPhase.toUpperCase()}`);

                index = (index + 1) % boxes.length;
            } catch (err) {
                console.error("❌ Error simulasi CV (Insert):", err.message);
            }
        }, 10000);
    } catch (err) {
        console.error("❌ Error saat inisialisasi simulasi CV:", err.message);
        process.exit(1);
    }
}

startSimulation();
