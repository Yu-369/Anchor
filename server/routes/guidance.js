import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';

const router = Router();

// ============================================================================
// WIFI SIMILARITY ENGINE
// ============================================================================

/**
 * Compute similarity between two WiFi fingerprints using BSSID matching.
 * Returns value between 0.0 (no match) and 1.0 (perfect match).
 */
function computeWifiSimilarity(currentNetworks, storedNetworks) {
    if (!currentNetworks?.length || !storedNetworks?.length) return 0;

    // Build BSSID → RSSI maps
    const currentMap = new Map(currentNetworks.map(n => [n.bssid, n.rssi]));
    const storedMap = new Map(storedNetworks.map(n => [n.bssid, n.rssi]));

    // Find common networks by BSSID
    const commonBssids = [...currentMap.keys()].filter(k => storedMap.has(k));

    if (commonBssids.length === 0) {
        // Fallback: try matching by SSID if no BSSID matches
        const currentSsidMap = new Map(currentNetworks.map(n => [n.ssid, n.rssi]));
        const storedSsidMap = new Map(storedNetworks.map(n => [n.ssid, n.rssi]));
        const commonSsids = [...currentSsidMap.keys()].filter(k => storedSsidMap.has(k));

        if (commonSsids.length === 0) return 0;

        // Use SSID matching with lower weight
        let dotProduct = 0, normA = 0, normB = 0;
        for (const ssid of commonSsids) {
            const a = Math.abs(currentSsidMap.get(ssid));
            const b = Math.abs(storedSsidMap.get(ssid));
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }

        const cosineSim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        const coverage = commonSsids.length / Math.max(currentSsidMap.size, storedSsidMap.size);

        return cosineSim * coverage * 0.7; // Reduced weight for SSID-only matching
    }

    // Cosine similarity on RSSI values (using absolute values since RSSI is negative)
    let dotProduct = 0, normA = 0, normB = 0;
    for (const bssid of commonBssids) {
        const a = Math.abs(currentMap.get(bssid));
        const b = Math.abs(storedMap.get(bssid));
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    const cosineSim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    // Penalize if many networks are missing
    const coverage = commonBssids.length / Math.max(currentMap.size, storedMap.size);

    // RSSI difference penalty: if same networks but very different signal strengths
    let rssiPenalty = 0;
    for (const bssid of commonBssids) {
        const diff = Math.abs(currentMap.get(bssid) - storedMap.get(bssid));
        rssiPenalty += diff;
    }
    const avgRssiDiff = rssiPenalty / commonBssids.length;
    const rssiSimilarity = Math.max(0, 1 - (avgRssiDiff / 30)); // 30dB diff = 0 similarity

    return cosineSim * coverage * rssiSimilarity;
}

// ============================================================================
// PHASE DETERMINATION
// ============================================================================

/**
 * Determine guidance phase based on WiFi similarity.
 */
function determinePhase(similarity) {
    if (similarity >= 0.85) return 'ARRIVED';
    if (similarity >= 0.6) return 'NEAR';
    if (similarity >= 0.3) return 'APPROACHING';
    return 'FAR';
}

/**
 * Get phase description for user.
 */
function getPhaseDescription(phase) {
    switch (phase) {
        case 'ARRIVED': return "You're in the right spot. Look around here.";
        case 'NEAR': return "You're in the right area. Getting close.";
        case 'APPROACHING': return "Getting closer. Continue this direction.";
        case 'FAR': return "Object is in a different room.";
        default: return "Move around to find signal.";
    }
}

// ============================================================================
// DIRECTION HINTS
// ============================================================================

/**
 * Compute directional hint based on heading difference.
 */
function computeDirectionHint(currentHeading, placementHeading, similarity) {
    // Only provide direction if we have some signal
    if (similarity < 0.2) {
        return {
            hint: "Move around to find signal",
            action: "EXPLORE",
            relativeBearing: null,
            confidence: similarity
        };
    }

    // If heading data is missing, provide generic hint
    if (placementHeading == null || currentHeading == null) {
        return {
            hint: similarity > 0.6 ? "Look around this area" : "Move forward and scan",
            action: similarity > 0.6 ? "SCAN" : "FORWARD",
            relativeBearing: null,
            confidence: similarity
        };
    }

    // Compute relative bearing
    let delta = placementHeading - currentHeading;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;

    // Provide directional guidance based on angle
    if (Math.abs(delta) < 15) {
        return {
            hint: "Object likely ahead",
            action: "FORWARD",
            relativeBearing: delta,
            confidence: similarity
        };
    } else if (Math.abs(delta) > 135) {
        return {
            hint: "Object likely behind you",
            action: "TURN_AROUND",
            relativeBearing: delta,
            confidence: similarity
        };
    } else if (delta < 0) {
        return {
            hint: `Object likely to your left (${Math.abs(Math.round(delta))}°)`,
            action: "TURN_LEFT",
            relativeBearing: delta,
            confidence: similarity
        };
    } else {
        return {
            hint: `Object likely to your right (${Math.round(delta)}°)`,
            action: "TURN_RIGHT",
            relativeBearing: delta,
            confidence: similarity
        };
    }
}

// ============================================================================
// SMOOTHING STATE (per-session, in-memory)
// ============================================================================

const smoothingState = new Map(); // objectId -> { history: [], lastRoom: string }

function getSmoothingKey(objectId, sessionId) {
    return `${objectId}:${sessionId || 'default'}`;
}

function smoothSimilarity(objectId, sessionId, newSimilarity, newRoom) {
    const key = getSmoothingKey(objectId, sessionId);
    let state = smoothingState.get(key);

    if (!state) {
        state = { history: [], lastRoom: null, consecutiveRoomMatches: 0 };
        smoothingState.set(key, state);
    }

    // Add to history (keep last 5 readings)
    state.history.push(newSimilarity);
    if (state.history.length > 5) state.history.shift();

    // Exponential moving average
    const alpha = 0.4;
    const smoothed = state.history.reduce((acc, val, idx) => {
        const weight = Math.pow(alpha, state.history.length - 1 - idx);
        return acc + val * weight;
    }, 0) / state.history.reduce((acc, _, idx) => {
        return acc + Math.pow(alpha, state.history.length - 1 - idx);
    }, 0);

    // Hysteresis for room switching
    if (newRoom === state.lastRoom) {
        state.consecutiveRoomMatches++;
    } else {
        state.consecutiveRoomMatches = 1;
    }

    // Only switch room if 3+ consecutive matches
    const confirmedRoom = state.consecutiveRoomMatches >= 3 ? newRoom : state.lastRoom;
    state.lastRoom = confirmedRoom || newRoom;

    return { smoothedSimilarity: smoothed, confirmedRoom };
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * POST /api/guidance
 * Get probabilistic AR guidance for finding an object.
 */
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { targetObjectId, currentNetworks, currentHeading, sessionId } = req.body;

        if (!targetObjectId) {
            return res.status(400).json({ error: 'targetObjectId is required' });
        }

        // Note: In browser environments, currentNetworks may be empty []
        // because browsers cannot access WiFi RSSI. We allow this and return FAR phase.
        const networks = currentNetworks || [];

        // Fetch target object
        const object = db.prepare('SELECT * FROM ar_objects WHERE id = ?').get(targetObjectId);

        // If object not found in DB, return a graceful FAR phase response
        // This happens when objects are stored in localStorage but not synced to backend
        if (!object) {
            return res.json({
                phase: 'FAR',
                phaseDescription: 'Object not yet registered for guidance. Save it via AR mode to enable WiFi guidance.',
                confidence: 0,
                rawSimilarity: 0,
                roomMatch: {
                    targetRoom: 'Unknown',
                    likelyCurrentRoom: 'Unknown',
                    similarity: 0
                },
                direction: {
                    hint: 'Move around to explore',
                    action: 'EXPLORE',
                    relativeBearing: null,
                    confidence: 0
                },
                object: {
                    id: targetObjectId,
                    label: 'Unregistered Object'
                },
                showGhostImage: false,
                showDirectionalArrow: true
            });
        }

        // Fetch stored fingerprint
        const fingerprint = db.prepare('SELECT * FROM wifi_fingerprints WHERE objectId = ?').get(targetObjectId);

        let similarity = 0;
        let storedNetworks = [];
        let targetRoom = object.roomLabel || 'Unknown';

        if (fingerprint) {
            try {
                storedNetworks = JSON.parse(fingerprint.networks);
                similarity = computeWifiSimilarity(networks, storedNetworks);
                targetRoom = fingerprint.roomLabel || object.roomLabel || 'Unknown';
            } catch (e) {
                console.error('Error parsing fingerprint networks:', e);
            }
        }

        // Apply smoothing
        const { smoothedSimilarity, confirmedRoom } = smoothSimilarity(
            targetObjectId,
            sessionId,
            similarity,
            targetRoom
        );

        // Determine phase
        const phase = determinePhase(smoothedSimilarity);
        const phaseDescription = getPhaseDescription(phase);

        // Compute direction hint
        const direction = computeDirectionHint(
            currentHeading,
            object.placementHeading || object.captureHeading,
            smoothedSimilarity
        );

        // Build response
        const response = {
            phase,
            phaseDescription,
            confidence: Math.round(smoothedSimilarity * 100) / 100,
            rawSimilarity: Math.round(similarity * 100) / 100,

            roomMatch: {
                targetRoom,
                likelyCurrentRoom: confirmedRoom || 'Unknown',
                similarity: Math.round(smoothedSimilarity * 100) / 100
            },

            direction,

            object: {
                id: object.id,
                label: object.label,
                description: object.description,
                elevationHint: object.elevationHint,
                referencePhoto: object.referencePhoto
            },

            // Hints for frontend
            showGhostImage: phase === 'ARRIVED' || phase === 'NEAR',
            showDirectionalArrow: phase === 'FAR' || phase === 'APPROACHING'
        };

        res.json(response);
    } catch (err) {
        console.error('Guidance error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/guidance/fingerprint/:objectId
 * Store WiFi fingerprint for an object.
 */
router.post('/fingerprint/:objectId', (req, res) => {
    try {
        const db = getDb();
        const { objectId } = req.params;
        const { networks, roomLabel, heading } = req.body;

        if (!networks || !Array.isArray(networks)) {
            return res.status(400).json({ error: 'networks array is required' });
        }

        // Verify object exists
        const object = db.prepare('SELECT id FROM ar_objects WHERE id = ?').get(objectId);
        if (!object) {
            return res.status(404).json({ error: 'Object not found' });
        }

        // Delete existing fingerprint if any
        db.prepare('DELETE FROM wifi_fingerprints WHERE objectId = ?').run(objectId);

        // Insert new fingerprint
        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO wifi_fingerprints (id, objectId, createdAt, networks, roomLabel)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, objectId, now, JSON.stringify(networks), roomLabel || null);

        // Update object's room label and placement heading if provided
        if (roomLabel || heading != null) {
            db.prepare(`
        UPDATE ar_objects SET
          roomLabel = COALESCE(?, roomLabel),
          placementHeading = COALESCE(?, placementHeading)
        WHERE id = ?
      `).run(roomLabel, heading, objectId);
        }

        res.status(201).json({
            id,
            objectId,
            stored: true,
            networkCount: networks.length,
            roomLabel: roomLabel || null
        });
    } catch (err) {
        console.error('Fingerprint storage error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/guidance/fingerprint/:objectId
 * Get stored fingerprint for an object.
 */
router.get('/fingerprint/:objectId', (req, res) => {
    try {
        const db = getDb();
        const { objectId } = req.params;

        const fingerprint = db.prepare('SELECT * FROM wifi_fingerprints WHERE objectId = ?').get(objectId);

        if (!fingerprint) {
            return res.status(404).json({ error: 'No fingerprint found for this object' });
        }

        res.json({
            id: fingerprint.id,
            objectId: fingerprint.objectId,
            createdAt: fingerprint.createdAt,
            networks: JSON.parse(fingerprint.networks),
            roomLabel: fingerprint.roomLabel
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/guidance/fingerprint/:objectId
 * Delete fingerprint for an object.
 */
router.delete('/fingerprint/:objectId', (req, res) => {
    try {
        const db = getDb();
        const { objectId } = req.params;

        const result = db.prepare('DELETE FROM wifi_fingerprints WHERE objectId = ?').run(objectId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'No fingerprint found for this object' });
        }

        res.json({ deleted: true, objectId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/guidance/reset-session
 * Reset smoothing state for a session (when user restarts navigation).
 */
router.post('/reset-session', (req, res) => {
    const { objectId, sessionId } = req.body;

    if (objectId) {
        const key = getSmoothingKey(objectId, sessionId);
        smoothingState.delete(key);
    } else {
        // Clear all if no objectId specified
        smoothingState.clear();
    }

    res.json({ reset: true });
});

export default router;
