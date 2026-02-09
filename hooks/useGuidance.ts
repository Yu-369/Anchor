import { useState, useEffect, useRef, useCallback } from 'react';
import { GuidanceResponse, GuidancePhase } from '../types';

interface UseGuidanceProps {
    targetObjectId: string | null;
    currentHeading: number;
    isEnabled: boolean;
}

export const useGuidance = ({ targetObjectId, currentHeading, isEnabled }: UseGuidanceProps) => {
    const [guidance, setGuidance] = useState<GuidanceResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Session ID for smoothing
    const sessionId = useRef(`session-${Date.now()}`).current;

    // Polling interval
    useEffect(() => {
        if (!isEnabled || !targetObjectId) {
            setGuidance(null);
            return;
        }

        const fetchGuidance = async () => {
            try {
                // NOTE: Browsers cannot access WiFi RSSI for security reasons.
                // This array will be empty in a standard web browser.
                // To make this work for real, you must wrap this app in Capacitor/Cordova
                // and use a plugin like 'WifiWizard2' to get the scan results.
                const currentNetworks: any[] = [];

                const response = await fetch('/api/guidance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetObjectId,
                        currentNetworks,
                        currentHeading,
                        sessionId
                    })
                });

                if (!response.ok) throw new Error('Failed to fetch guidance');

                const data: GuidanceResponse = await response.json();
                setGuidance(data);
                setError(null);
            } catch (err) {
                console.error("Guidance fetch error:", err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        };

        const interval = setInterval(fetchGuidance, 1000); // 1Hz update
        fetchGuidance(); // Initial call

        return () => clearInterval(interval);
    }, [isEnabled, targetObjectId, currentHeading]);

    return {
        guidance,
        error
    };
};
