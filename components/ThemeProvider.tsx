import React, { useEffect } from 'react';
import {
    sourceColorFromImage,
    Hct,
    SchemeExpressive,
    hexFromArgb,
    TonalPalette,
    DynamicScheme
} from '@material/material-color-utilities';

// Simple interface for the ThemeProvider
interface ThemeProviderProps {
    children: React.ReactNode;
}

// Default Fallback Seed (Anchor Green)
const DEFAULT_SEED = 0xFFD4FF3F;

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    useEffect(() => {
        const applyTheme = async () => {
            let seed = DEFAULT_SEED;

            try {
                // Attempt to get system color via material-dynamic-colors or similar bridge
                // For web/dev fallback, we stick to default.
                // In a real Capacitor plugin scenario, we would await the plugin call here.
                // const result = await MaterialYou.getMaterialYouColors(); 
                // if (result) seed = argbFromHex(result.system_accent1[600]); 
            } catch (e) {
                console.warn("Failed to get system color, using default", e);
            }

            // Generate Expressive Scheme (Dark Mode by default for this app)
            const hct = Hct.fromInt(seed);
            const scheme = new SchemeExpressive(hct, true, 0.0);

            // Map to CSS Variables
            const root = document.documentElement;

            const setVar = (name: string, argb: number) => {
                root.style.setProperty(name, hexFromArgb(argb));
            };

            setVar('--md-sys-color-primary', scheme.primary);
            setVar('--md-sys-color-on-primary', scheme.onPrimary);
            setVar('--md-sys-color-primary-container', scheme.primaryContainer);
            setVar('--md-sys-color-on-primary-container', scheme.onPrimaryContainer);
            setVar('--md-sys-color-secondary', scheme.secondary);
            setVar('--md-sys-color-on-secondary', scheme.onSecondary);
            setVar('--md-sys-color-secondary-container', scheme.secondaryContainer);
            setVar('--md-sys-color-on-secondary-container', scheme.onSecondaryContainer);
            setVar('--md-sys-color-tertiary', scheme.tertiary);
            setVar('--md-sys-color-on-tertiary', scheme.onTertiary);
            setVar('--md-sys-color-tertiary-container', scheme.tertiaryContainer);
            setVar('--md-sys-color-on-tertiary-container', scheme.onTertiaryContainer);
            setVar('--md-sys-color-surface', scheme.surface);
            setVar('--md-sys-color-on-surface', scheme.onSurface);
            setVar('--md-sys-color-surface-variant', scheme.surfaceVariant);
            setVar('--md-sys-color-on-surface-variant', scheme.onSurfaceVariant);
            setVar('--md-sys-color-outline', scheme.outline);
            setVar('--md-sys-color-background', scheme.background);
            setVar('--md-sys-color-on-background', scheme.onBackground);
        };

        applyTheme();
    }, []);

    return <>{children}</>;
};
