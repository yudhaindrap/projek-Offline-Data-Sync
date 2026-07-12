const express = require('express');
const router = express.Router();

const pool = require('../db');
const verifyToken = require('../middleware/auth');


/* =========================================================
   GET CHART DATA
========================================================= */
router.get('/:box_id', verifyToken, async (req, res) => {

    try {

        const { box_id } = req.params;

        /* =================================================
           VALIDASI AKSES BOX
        ================================================= */

        let boxCheck;

        // ADMIN → semua box
        if (req.user.role === 'admin') {

            boxCheck = await pool.query(
                'SELECT * FROM boxes WHERE id = $1',
                [box_id]
            );

        }

        // OPERATOR → hanya box miliknya
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
           AMBIL DATA SENSOR
        ================================================= */

        const result = await pool.query(
            `
            SELECT
                to_char(recorded_at, 'HH24:MI') as time,
                temperature as temp,
                humidity_air as hum,
                humidity_media as media_hum
            FROM sensor_data
            WHERE box_id = $1
            ORDER BY recorded_at ASC
            LIMIT 20
            `,
            [box_id]
        );

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;