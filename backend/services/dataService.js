const pool = require('../db');

/**
 * 1. Mengambil rata-rata mikroklimat per Box
 * Sudah ditambahkan JOIN ke tabel boxes untuk mengambil data floor_level
 */
async function getAggregatedMikroklimat() {
    try {
        const query = `
            SELECT 
                sd.box_id, 
                b.box_name AS box_name,
                l.room_number, 
                b.tenant_id AS owner_id,
                ROUND(AVG(sd.temperature), 2) AS avg_temp, 
                ROUND(AVG(sd.humidity_air), 2) AS avg_humidity, 
                ROUND(AVG(sd.humidity_media), 2) AS avg_media_humidity
            FROM sensor_data sd
            LEFT JOIN boxes b ON sd.box_id = b.id
            LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
            GROUP BY sd.box_id, b.box_name, l.room_number, b.tenant_id
            ORDER BY sd.box_id ASC
        `;
        const result = await pool.query(query);
        return result.rows;
    } catch (err) {
        console.error("Error di getAggregatedMikroklimat:", err.message);
        throw err;
    }
}

/**
 * 2. Mengambil prediksi panen terbaru untuk setiap box
 * Disinkronkan dengan data sensor terakhir (recorded_at) dan deteksi kamera terakhir (detected_at)
 */
async function getLatestPredictions() {
    try {
        const query = `
            SELECT 
                p.id AS prediction_id,
                p.box_id,
                b.box_name AS box_name,
                l.room_number,
                b.tenant_id AS owner_id,
                p.predicted_days AS estimated_days,
                'green' AS urgency_level, -- placeholder logic to keep frontend unchanged
                p.predicted_at AS predicted_at,
                s.temperature AS latest_air_temp,
                s.humidity_air AS latest_air_humidity,
                s.humidity_media AS latest_media_humidity,
                s.recorded_at AS latest_sensor_at,
                c.dominant_phase,
                c.confidence AS confidence_score,
                jsonb_build_object(
                    'baby_larva', c.baby_larva_count,
                    'adult_larva', c.adult_larva_count,
                    'prepupa', c.prepupa_count,
                    'pupa', c.pupa_count
                ) AS detection_counts,
                c.image_path AS image_url,
                c.recorded_at AS detected_at
            FROM harvest_predictions p
            LEFT JOIN boxes b ON p.box_id = b.id
            LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
            LEFT JOIN sensor_data s ON p.sensor_data_id = s.id
            LEFT JOIN cv_results c ON p.cv_result_id = c.id
            WHERE p.predicted_at IN (
                SELECT MAX(predicted_at) 
                FROM harvest_predictions 
                GROUP BY box_id
            )
            ORDER BY p.box_id ASC
        `;
        const result = await pool.query(query);
        return result.rows;
    } catch (err) {
        console.error("Error di getLatestPredictions:", err.message);
        throw err;
    }
}

module.exports = {
    getAggregatedMikroklimat,
    getLatestPredictions
};