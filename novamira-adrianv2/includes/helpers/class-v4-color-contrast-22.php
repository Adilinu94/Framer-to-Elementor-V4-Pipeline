<?php
declare(strict_types=1);
/**
 * WCAG 2.2 Color Contrast Helper (Plan 5.1.1)
 *
 * Erweitert die bestehende V4_Color_Contrast um WCAG 2.2 Features:
 *   - TARGET_SIZE_MIN = 24  (2.5.8 — Minimum 24x24px Click-Target)
 *   - FOCUS_APPEARANCE_CONTRAST = 3.0 (2.4.11)
 *   - passes_target_size(), passes_focus_appearance()
 *
 * @since 1.1.0
 */

namespace Novamira\AdrianV2\Helpers;

if (!defined('ABSPATH')) exit();

class V4_Color_Contrast_22 {
    /** WCAG 2.2 — 2.5.8 Target Size (Minimum): 24×24px */
    public const TARGET_SIZE_MIN = 24;

    /** WCAG 2.2 — 2.4.11 Focus Appearance: 3:1 contrast */
    public const FOCUS_APPEARANCE_CONTRAST = 3.0;

    /**
     * Prüft ob ein Click-Target die WCAG 2.2 Mindestgröße (24×24px) erfüllt.
     */
    public static function passes_target_size(float $width, float $height): bool {
        return $width >= self::TARGET_SIZE_MIN && $height >= self::TARGET_SIZE_MIN;
    }

    /**
     * Prüft ob ein Focus-Indicator ausreichenden Kontrast (3:1) zum Hintergrund hat.
     */
    public static function passes_focus_appearance(string $focus_color, string $bg_color): bool {
        return self::contrast_ratio($focus_color, $bg_color) >= self::FOCUS_APPEARANCE_CONTRAST;
    }

    /**
     * Berechnet das Kontrastverhältnis zwischen zwei Hex-Farben.
     * Formel: (L1 + 0.05) / (L2 + 0.05) nach WCAG 2.x.
     */
    public static function contrast_ratio(string $hex1, string $hex2): float {
        $l1 = self::relative_luminance($hex1);
        $l2 = self::relative_luminance($hex2);
        $lighter = max($l1, $l2);
        $darker  = min($l1, $l2);
        return ($lighter + 0.05) / ($darker + 0.05);
    }

    private static function relative_luminance(string $hex): float {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        $r = hexdec(substr($hex, 0, 2)) / 255;
        $g = hexdec(substr($hex, 2, 2)) / 255;
        $b = hexdec(substr($hex, 4, 2)) / 255;
        $r = $r <= 0.04045 ? $r / 12.92 : pow(($r + 0.055) / 1.055, 2.4);
        $g = $g <= 0.04045 ? $g / 12.92 : pow(($g + 0.055) / 1.055, 2.4);
        $b = $b <= 0.04045 ? $b / 12.92 : pow(($b + 0.055) / 1.055, 2.4);
        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    }
}
