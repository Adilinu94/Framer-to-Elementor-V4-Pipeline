<?php
declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) { exit; }

use Novamira\AdrianV2\Helpers\Diagnostics;

// ── Plan 4.2 + 5.1.1: CPT + WCAG 2.2 Helper (muss VOR plugins_loaded geladen werden) ──
require_once __DIR__ . '/class-build-versioning.php';
require_once __DIR__ . '/helpers/class-v4-color-contrast-22.php';

// Top-Bootstrap: Per-Group wp_abilities_api_init mit Try/Catch (loest Single-Closure-Bug).
// Fehler in einer Sub-Domain blockieren nicht die anderen.

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/a11y/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'a11y', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/atomic/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'atomic', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/audit/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'audit', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/custom-code/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'custom-code', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/elementor/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'elementor', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/global-classes/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'global-classes', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/media/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'media', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/php-sandbox/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'php-sandbox', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/seo/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'seo', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/utilities/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'utilities', '?', $e );
    }
}, 20 );

add_action( 'wp_abilities_api_init', static function () {
    try {
        require_once __DIR__ . '/abilities/variables/bootstrap.php';
    } catch ( \Throwable $e ) {
        \Novamira\AdrianV2\Helpers\Diagnostics::record( 'variables', '?', $e );
    }
}, 20 );
