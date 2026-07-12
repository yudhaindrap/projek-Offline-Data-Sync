const express = require('express');
const router = express.Router();

const pool = require('../db');
const verifyToken = require('../middleware/auth');


/* =========================================================
   GET THRESHOLD BY FLOOR
========================================================= */
router.get('/:floor', verifyToken, async (req, res) => {

    try {

        const floor =
            parseInt(req.params.floor);

        if (!floor) {
            return res.status(400).json({
                message: 'Floor tidak valid.'
            });
        }

        /* ================================================
           VALIDASI HAK AKSES FLOOR
        ================================================ */

        // ADMIN → bebas
        if (req.user.role !== 'admin') {

            const ownedBox = await pool.query(
                `
                SELECT b.id
                FROM boxes b
                JOIN box_locations l ON b.id = l.box_id
                WHERE l.floor_level = $1
                AND b.tenant_id = $2
                LIMIT 1
                `,
                [
                    floor,
                    req.user.tenant_id
                ]
            );

            if (ownedBox.rows.length === 0) {

                return res.status(403).json({
                    message:
                        'Anda tidak memiliki akses ke floor ini.'
                });

            }

        }

        /* ================================================
           GET THRESHOLD
        ================================================ */

        let result;
        if (req.user.role === 'admin') {
            result = await pool.query(
                `
                SELECT *
                FROM automation_thresholds
                WHERE floor_level = $1
                LIMIT 1
                `,
                [floor]
            );
        } else {
            result = await pool.query(
                `
                SELECT *
                FROM automation_thresholds
                WHERE floor_level = $1 AND tenant_id = $2
                `,
                [floor, req.user.tenant_id]
            );
        }

        /* ================================================
           DEFAULT VALUE
        ================================================ */

        if (result.rows.length === 0) {

            return res.json({

                floorLevel: floor,

                tempMin: 25.0,
                tempMax: 35.0,

                mediaMin: 40.0,
                mediaMax: 65.0,

                humAirMin: 60.0,
                humAirMax: 85.0

            });

        }

        const t = result.rows[0];

        res.json({

            floorLevel:
                parseInt(t.floor_level),

            tempMin:
                parseFloat(t.temp_min),

            tempMax:
                parseFloat(t.temp_max),

            mediaMin:
                parseFloat(t.media_hum_min),

            mediaMax:
                parseFloat(t.media_hum_max),

            humAirMin:
                parseFloat(t.air_hum_min),

            humAirMax:
                parseFloat(t.air_hum_max)

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


/* =========================================================
   CREATE / UPDATE THRESHOLD
========================================================= */
router.post('/', verifyToken, async (req, res) => {

    try {

        const {
            floorLevel,
            tempMin,
            tempMax,
            mediaMin,
            mediaMax,
            humAirMin,
            humAirMax
        } = req.body;

        /* ================================================
           VALIDASI HAK AKSES
        ================================================ */

        // ADMIN → bebas edit
        if (req.user.role !== 'admin') {

            const ownedBox = await pool.query(
                `
                SELECT b.id
                FROM boxes b
                JOIN box_locations l ON b.id = l.box_id
                WHERE l.floor_level = $1
                AND b.tenant_id = $2
                LIMIT 1
                `,
                [
                    floorLevel,
                    req.user.tenant_id
                ]
            );

            if (ownedBox.rows.length === 0) {

                return res.status(403).json({
                    message:
                        'Anda tidak memiliki akses mengubah floor ini.'
                });

            }

        }

        /* ================================================
           CHECK EXISTING
        ================================================ */

        let checkExist;
        if (req.user.role === 'admin') {
            checkExist = await pool.query(
                `
                SELECT id
                FROM automation_thresholds
                WHERE floor_level = $1
                LIMIT 1
                `,
                [floorLevel]
            );
        } else {
            checkExist = await pool.query(
                `
                SELECT id
                FROM automation_thresholds
                WHERE floor_level = $1 AND tenant_id = $2
                `,
                [floorLevel, req.user.tenant_id]
            );
        }

        /* ================================================
           UPDATE
        ================================================ */

        if (checkExist.rows.length > 0) {

            await pool.query(
                `
                UPDATE automation_thresholds
                SET
                    temp_min = $1,
                    temp_max = $2,

                    media_hum_min = $3,
                    media_hum_max = $4,

                    air_hum_min = $5,
                    air_hum_max = $6

                WHERE id = $7
                `,
                [
                    tempMin,
                    tempMax,

                    mediaMin,
                    mediaMax,

                    humAirMin,
                    humAirMax,

                    checkExist.rows[0].id
                ]
            );

        }

        /* ================================================
           INSERT
        ================================================ */

        else {

            const crypto = require('crypto');
            const tenantIdToUse = req.user.tenant_id || null;
            await pool.query(
                `
                INSERT INTO automation_thresholds
                (
                    id,
                    tenant_id,
                    floor_level,
                    temp_min,
                    temp_max,
                    media_hum_min,
                    media_hum_max,
                    air_hum_min,
                    air_hum_max
                )
                VALUES
                (
                    $1, $2, $3,
                    $4, $5,
                    $6, $7,
                    $8, $9
                )
                `,
                [
                    crypto.randomUUID(),
                    tenantIdToUse,
                    floorLevel,

                    tempMin,
                    tempMax,

                    mediaMin,
                    mediaMax,

                    humAirMin,
                    humAirMax
                ]
            );

        }

        /* ================================================
           SOCKET EMIT — broadcast ke semua klien aktif
           (room-based emit dinonaktifkan: klien belum join room)
        ================================================ */

        const io = req.app.get('io');

        if (io) {
            io.emit('thresholds_updated', {
                floorLevel,
                tempMin,
                tempMax,
                mediaMin,
                mediaMax,
                humAirMin,
                humAirMax
            });
        }

        res.json({
            message:
                `Threshold floor ${floorLevel} berhasil diperbarui`
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;