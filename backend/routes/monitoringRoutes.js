const express = require('express');
const router = express.Router();

const pool = require('../db');
const verifyToken = require('../middleware/auth');

const {
    getAggregatedMikroklimat,
    getLatestPredictions
} = require('../services/dataService');


/* =========================================================
   MONITORING ALL BOXES
========================================================= */
router.get('/all', verifyToken, async (req, res) => {

    try {

        /* =================================================
           AMBIL BOX BERDASARKAN ROLE
        ================================================= */

        let boxesResult;

        // ADMIN → semua box
        if (req.user.role === 'admin') {

            boxesResult = await pool.query(
                `
                SELECT b.*, l.room_number
                FROM boxes b
                LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
                ORDER BY b.id ASC
                `
            );

        }

        // OPERATOR → hanya box miliknya
        else {

            boxesResult = await pool.query(
                `
                SELECT b.*, l.room_number
                FROM boxes b
                LEFT JOIN box_locations l ON b.id = l.box_id AND l.end_at IS NULL
                WHERE b.tenant_id = $1
                ORDER BY b.id ASC
                `,
                [req.user.tenant_id]
            );

        }

        const boxes = boxesResult.rows;

        /* =================================================
           DATA AGREGASI
        ================================================= */

        const summaries =
            await getAggregatedMikroklimat();

        const predictions =
            await getLatestPredictions();

        const result = [];

        /* =================================================
           LOOP BOX
        ================================================= */

        for (const box of boxes) {

            const id = box.id;

            const summary =
                summaries.find(
                    s => s.box_id === id
                );

            const prediction =
                predictions.find(
                    p => p.box_id === id
                );

            const sensor = await pool.query(
                `
                SELECT *
                FROM sensor_data
                WHERE box_id = $1
                ORDER BY recorded_at DESC
                LIMIT 1
                `,
                [id]
            );

            if (
                sensor.rows.length > 0 &&
                summary
            ) {

                const s = sensor.rows[0];

                result.push({

                    id: s.box_id,

                    floor:
                        box.room_number ||

                        s.box_id,

                    name:
                        box.box_name,

                    owner_id:
                        box.tenant_id,

                    temp:
                        parseFloat(
                            summary.avg_temp
                        ),

                    humidity:
                        parseFloat(
                            summary.avg_humidity
                        ),

                    media:
                        parseFloat(
                            summary.avg_media_humidity
                        ),

                    tempStatus:
                        summary.avg_temp > 28
                            ? 'warning'
                            : 'normal',

                    humStatus:
                        'normal',

                    mediaStatus:
                        summary.avg_media_humidity < 40
                            ? 'warning'
                            : 'normal',

                    phase:
                        prediction
                            ? prediction.dominant_phase
                            : 'Monitoring',

                    activeActuators: [

                        ...(s.temperature > 28
                            ? ['Kipas Exhaust']
                            : []),

                        ...(s.humidity_media < 40
                            ? ['Solenoid Valve']
                            : []),

                        ...(s.temperature < 25
                            ? ['Lampu Heater']
                            : [])

                    ],

                    timestamp:
                        s.recorded_at

                });

            }

        }

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;