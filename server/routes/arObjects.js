import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';

const router = Router();

// ============================================================================
// DIRECTIONAL MATH UTILITIES
// ============================================================================

function toRad(deg) {
    return deg * Math.PI / 180;
}

function toDeg(rad) {
    return rad * 180 / Math.PI;
}

/**
 * Compute bearing from point A to point B
 * Returns degrees 0-360
 */
function bearingFromTo(fromLat, fromLng, toLat, toLng) {
    const dLng = toRad(toLng - fromLng);
    const lat1 = toRad(fromLat);
    const lat2 = toRad(toLat);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Compute angular delta between two headings
 * Returns -180 to +180 (negative = left, positive = right)
 */
function angularDelta(currentHeading, targetHeading) {
    let delta = targetHeading - currentHeading;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
}

/**
 * Determine guidance state from angular delta
 */
function getGuidanceState(delta, tolerance = 5) {
    const absDelta = Math.abs(delta);

    if (absDelta <= tolerance) return 'aligned';
    if (absDelta > 135) return 'behind';
    if (delta < 0) return 'rotate_left';
    return 'rotate_right';
}

/**
 * Compute distance between two GPS points (meters)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Get proximity state
 */
function getProximityState(distance) {
    if (distance <= 5) return 'very_close';
    if (distance <= 20) return 'close';
    if (distance <= 50) return 'near';
    return 'far';
}

// ============================================================================
// API ROUTES
// ============================================================================

// Helper to format AR object
function formatARObject(row) {
    if (!row) return null;
    return {
        id: row.id,
        anchorId: row.anchorId,
        label: row.label,
        description: row.description,
        createdAt: row.createdAt,
        bearingFromAnchor: row.bearingFromAnchor,
        distanceFromAnchor: row.distanceFromAnchor,
        elevationHint: row.elevationHint,
        captureHeading: row.captureHeading,
        captureGps: {
            lat: row.captureGps_lat,
            lng: row.captureGps_lng
        },
        referencePhoto: row.referencePhoto
    };
}

// GET /api/objects - List all AR objects
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM ar_objects ORDER BY createdAt DESC').all();
        res.json(rows.map(formatARObject));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/objects/guidance - Get directional guidance
router.get('/guidance', (req, res) => {
    try {
        const db = getDb();
        const { anchorId, currentHeading, currentLat, currentLng } = req.query;

        if (!currentHeading || !currentLat || !currentLng) {
            return res.status(400).json({
                error: 'Required: currentHeading, currentLat, currentLng'
            });
        }

        const heading = parseFloat(currentHeading);
        const userLat = parseFloat(currentLat);
        const userLng = parseFloat(currentLng);

        // Get objects (optionally filtered by anchor)
        let query = 'SELECT o.*, a.gps_lat as anchor_lat, a.gps_lng as anchor_lng FROM ar_objects o JOIN anchors a ON o.anchorId = a.id';
        let params = [];

        if (anchorId) {
            query += ' WHERE o.anchorId = ?';
            params.push(anchorId);
        }

        const rows = db.prepare(query).all(...params);

        const guidanceResults = rows.map(row => {
            // Distance from user to anchor
            const distanceToAnchor = haversineDistance(userLat, userLng, row.anchor_lat, row.anchor_lng);

            // Bearing from user to anchor
            const bearingToAnchor = bearingFromTo(userLat, userLng, row.anchor_lat, row.anchor_lng);

            // Target heading = bearing to anchor + object's relative offset
            const targetHeading = (bearingToAnchor + row.bearingFromAnchor + 360) % 360;

            // Angular delta from current heading to target
            const delta = angularDelta(heading, targetHeading);

            // Guidance state
            const state = getGuidanceState(delta);
            const proximityState = getProximityState(distanceToAnchor);

            // Generate instruction
            let instruction;
            switch (state) {
                case 'aligned':
                    instruction = 'Aligned — look ahead';
                    break;
                case 'behind':
                    instruction = 'Object is behind you — turn around';
                    break;
                case 'rotate_left':
                    instruction = `Rotate left ${Math.abs(Math.round(delta))}°`;
                    break;
                case 'rotate_right':
                    instruction = `Rotate right ${Math.round(delta)}°`;
                    break;
            }

            // Distance hint
            let distanceHint;
            const objDist = row.distanceFromAnchor || 1;
            if (distanceToAnchor < 3) {
                distanceHint = `about ${objDist}m ahead`;
            } else {
                distanceHint = `${Math.round(distanceToAnchor)}m to anchor, then ${objDist}m ahead`;
            }

            // Elevation hint
            let elevationHintText = null;
            if (row.elevationHint === 'floor') elevationHintText = 'look down (floor level)';
            if (row.elevationHint === 'overhead') elevationHintText = 'look up (overhead)';
            if (row.elevationHint === 'eye') elevationHintText = 'eye level';

            return {
                id: row.id,
                label: row.label,
                referencePhoto: row.referencePhoto,
                guidance: {
                    state,
                    angleDelta: Math.round(delta),
                    targetHeading: Math.round(targetHeading),
                    instruction,
                    proximityState,
                    distanceToAnchor: Math.round(distanceToAnchor),
                    distanceHint,
                    elevationHint: elevationHintText
                }
            };
        });

        // Sort by distance (closest first)
        guidanceResults.sort((a, b) => a.guidance.distanceToAnchor - b.guidance.distanceToAnchor);

        res.json({ objects: guidanceResults });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/objects/:id - Get single AR object
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT * FROM ar_objects WHERE id = ?').get(req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'AR object not found' });
        }
        res.json(formatARObject(row));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/objects - Place AR object
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const now = new Date().toISOString();

        const {
            anchorId,
            label,
            description,
            bearingFromAnchor,
            distanceFromAnchor,
            elevationHint,
            captureHeading,
            captureGps,
            referencePhoto
        } = req.body;

        // Validate required fields
        if (!anchorId) {
            return res.status(400).json({ error: 'anchorId is required' });
        }
        if (!label) {
            return res.status(400).json({ error: 'label is required' });
        }
        if (bearingFromAnchor == null) {
            return res.status(400).json({ error: 'bearingFromAnchor is required' });
        }
        if (captureHeading == null) {
            return res.status(400).json({ error: 'captureHeading is required' });
        }
        if (!captureGps || !captureGps.lat || !captureGps.lng) {
            return res.status(400).json({ error: 'captureGps (lat, lng) is required' });
        }

        // Verify anchor exists
        const anchor = db.prepare('SELECT id FROM anchors WHERE id = ?').get(anchorId);
        if (!anchor) {
            return res.status(404).json({ error: 'Anchor not found' });
        }

        db.prepare(`
      INSERT INTO ar_objects (
        id, anchorId, label, description, createdAt,
        bearingFromAnchor, distanceFromAnchor, elevationHint,
        captureHeading, captureGps_lat, captureGps_lng,
        referencePhoto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            anchorId,
            label,
            description || null,
            now,
            bearingFromAnchor,
            distanceFromAnchor || null,
            elevationHint || null,
            captureHeading,
            captureGps.lat,
            captureGps.lng,
            referencePhoto || null
        );

        const created = db.prepare('SELECT * FROM ar_objects WHERE id = ?').get(id);
        res.status(201).json(formatARObject(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/objects/:id - Update AR object
router.put('/:id', (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM ar_objects WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'AR object not found' });
        }

        const {
            label,
            description,
            bearingFromAnchor,
            distanceFromAnchor,
            elevationHint,
            referencePhoto
        } = req.body;

        db.prepare(`
      UPDATE ar_objects SET
        label = COALESCE(?, label),
        description = COALESCE(?, description),
        bearingFromAnchor = COALESCE(?, bearingFromAnchor),
        distanceFromAnchor = COALESCE(?, distanceFromAnchor),
        elevationHint = COALESCE(?, elevationHint),
        referencePhoto = COALESCE(?, referencePhoto)
      WHERE id = ?
    `).run(
            label,
            description,
            bearingFromAnchor,
            distanceFromAnchor,
            elevationHint,
            referencePhoto,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM ar_objects WHERE id = ?').get(req.params.id);
        res.json(formatARObject(updated));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/objects/:id - Delete AR object
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM ar_objects WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'AR object not found' });
        }

        db.prepare('DELETE FROM ar_objects WHERE id = ?').run(req.params.id);
        res.json({ message: 'AR object deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
