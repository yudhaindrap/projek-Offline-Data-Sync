const express = require('express');
const router = express.Router();

const pool = require('../db');
const verifyToken = require('../middleware/auth');


/* =========================================================
   HISTORY SENSOR
========================================================= */
router.get('/', verifyToken, async (req, res) => {

    try {

        let result;

        // ADMIN → semua history
        if (req.user.role === 'admin') {

            result = await pool.query(
                `
                SELECT *, temperature AS air_temp, humidity_air AS air_humidity, humidity_media AS media_humidity, recorded_at AS timestamp
                FROM sensor_data
                ORDER BY recorded_at DESC
                LIMIT 20
                `
            );

        }

        // OPERATOR → hanya box miliknya
        else {

            result = await pool.query(
                `
                SELECT s.*, s.temperature AS air_temp, s.humidity_air AS air_humidity, s.humidity_media AS media_humidity, s.recorded_at AS timestamp
                FROM sensor_data s
                JOIN boxes b
                    ON s.box_id = b.id
                WHERE b.tenant_id = $1
                ORDER BY s.recorded_at DESC
                LIMIT 20
                `,
                [req.user.tenant_id]
            );

        }

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


/* =========================================================
   EXTENDED HISTORY
========================================================= */
router.get('/extended', verifyToken, async (req, res) => {

    try {

        let result;

        // ADMIN → semua data
        if (req.user.role === 'admin') {

            result = await pool.query(
                `
                SELECT
                    s.*,
                    s.temperature AS air_temp, 
                    s.humidity_air AS air_humidity, 
                    s.humidity_media AS media_humidity, 
                    s.recorded_at AS timestamp,
                    c.dominant_phase
                FROM sensor_data s

                LEFT JOIN cv_results c
                    ON s.box_id = c.box_id
                    AND s.recorded_at = c.recorded_at

                ORDER BY s.recorded_at DESC
                LIMIT 50
                `
            );

        }

        // OPERATOR → hanya box miliknya
        else {

            result = await pool.query(
                `
                SELECT
                    s.*,
                    s.temperature AS air_temp, 
                    s.humidity_air AS air_humidity, 
                    s.humidity_media AS media_humidity, 
                    s.recorded_at AS timestamp,
                    c.dominant_phase

                FROM sensor_data s

                JOIN boxes b
                    ON s.box_id = b.id

                LEFT JOIN cv_results c
                    ON s.box_id = c.box_id
                    AND s.recorded_at = c.recorded_at

                WHERE b.tenant_id = $1

                ORDER BY s.recorded_at DESC
                LIMIT 50
                `,
                [req.user.tenant_id]
            );

        }

        res.json(

            result.rows.map(r => ({

                id: r.id,

                time: new Date(
                    r.timestamp
                ).toLocaleString('id-ID'),

                box: r.box_id,

                temp: parseFloat(r.air_temp),

                rh: parseFloat(r.air_humidity),

                media: parseFloat(r.media_humidity),

                phase:
                    r.dominant_phase ||
                    'Monitoring',

                act:
                    r.air_temp > 28
                        ? 'Kipas'
                        : (
                            r.media_humidity < 40
                                ? 'Valve'
                                : '-'
                        ),

                status:
                    (
                        r.air_temp > 28 ||
                        r.media_humidity < 40
                    )
                        ? 'warning'
                        : 'normal'

            }))

        );

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;