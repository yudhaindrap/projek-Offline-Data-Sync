const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth');

const {
    getAggregatedMikroklimat,
    getLatestPredictions
} = require('../services/dataService');

const pool = require('../db');


/* =========================================================
   DASHBOARD SUMMARY
========================================================= */
router.get('/', verifyToken, async (req, res) => {

    try {

        let summary;

        // ADMIN → semua data (semua box)
        if (req.user.role === 'admin') {

            summary = await getAggregatedMikroklimat();

        }

        // OPERATOR → hanya box miliknya, format array sama dengan admin
        else {

            const result = await pool.query(
                `
                SELECT
                    sd.box_id,
                    b.box_name    AS box_name,
                    l.room_number as room_number,
                    b.tenant_id   AS owner_id,
                    ROUND(AVG(sd.temperature), 2)     AS avg_temp,
                    ROUND(AVG(sd.humidity_air), 2)    AS avg_humidity,
                    ROUND(AVG(sd.humidity_media), 2)  AS avg_media_humidity
                FROM sensor_data sd
                JOIN boxes b ON sd.box_id = b.id
                LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
                WHERE b.tenant_id = $1
                GROUP BY sd.box_id, b.box_name, l.room_number, b.tenant_id
                ORDER BY sd.box_id ASC
                `,
                [req.user.tenant_id]
            );

            summary = result.rows;   // ← array, bukan single object

        }

        res.json({
            user: req.user,
            summary
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});



/* =========================================================
   LATEST BOX DATA
========================================================= */
router.get('/latest/:box_id', verifyToken, async (req, res) => {

    try {

        const { box_id } = req.params;

        /* =================================================
           VALIDASI AKSES BOX
        ================================================= */

        let boxCheck;

        // ADMIN
        if (req.user.role === 'admin') {

            boxCheck = await pool.query(
                'SELECT * FROM boxes WHERE id = $1',
                [box_id]
            );

        }

        // OPERATOR
        else {

            boxCheck = await pool.query(
                `
                SELECT *
                FROM boxes
                WHERE id = $1
                AND tenant_id = $2
                `,
                [box_id, req.user.tenant_id]
            );

        }

        if (boxCheck.rows.length === 0) {

            return res.status(403).json({
                message: 'Tidak memiliki akses ke box ini.'
            });

        }

        /* =================================================
           SENSOR TERBARU
        ================================================= */

        const sensorRes = await pool.query(
            `
            SELECT *
            FROM sensor_data
            WHERE box_id = $1
            ORDER BY recorded_at DESC
            LIMIT 1
            `,
            [box_id]
        );

        if (sensorRes.rows.length === 0) {

            return res.status(404).json({
                error: 'Data belum tersedia'
            });

        }

        /* =================================================
           PREDIKSI TERBARU
        ================================================= */

        let prediction = null;

        // ADMIN → semua prediksi
        if (req.user.role === 'admin') {

            const allPredictions =
                await getLatestPredictions();

            prediction =
                allPredictions.find(
                    pred =>
                        pred.box_id === box_id
                ) || null;

        }

        // OPERATOR → hanya box miliknya
        else {

            const predRes = await pool.query(
                `
                SELECT *
                FROM harvest_predictions
                WHERE box_id = $1
                ORDER BY predicted_at DESC
                LIMIT 1
                `,
                [box_id]
            );

            prediction =
                predRes.rows[0] || null;

        }

        const s = sensorRes.rows[0];

        /* =================================================
           ACTUATOR STATUS
        ================================================= */

        const actuators = {

            fan_in:
                s.temperature > 28,

            pump:
                s.humidity_media < 40,

            heater:
                s.temperature < 25

        };

        /* =================================================
           RESPONSE
        ================================================= */

        res.json({

            box_id: parseInt(box_id),

            air_temp: s.temperature,

            air_humidity: s.humidity_air,

            media_humidity: s.humidity_media,

            cv_latest: {

                phase:
                    prediction
                        ? prediction.dominant_phase
                        : 'Monitoring',

                confidence: 100,

                counts:
                    prediction
                        ? prediction.detection_counts
                        : {}

            },

            harvest_est:
                prediction
                    ? (prediction.estimated_days !== undefined ? prediction.estimated_days : prediction.predicted_days)
                    : 0,

            actuators,

            timestamp: s.recorded_at

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;