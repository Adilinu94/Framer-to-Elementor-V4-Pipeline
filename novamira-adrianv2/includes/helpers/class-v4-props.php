<?php
// SPDX-FileCopyrightText: 2026 Ovation S.r.l. <dev@novamira.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later

declare(strict_types=1);

/**
 * V4_Props — typed prop builder for Elementor 4.0 atomic elements.
 *
 * Wraps and unwraps Elementor 4.0 typed prop values ($$type system).
 * MCP abilities accept simple flat values from AI agents; this class converts
 * them to/from the $$type format that Elementor's atomic engine requires.
 *
 * Key invariants:
 * - image(): Uses 'image-attachment-id' $$type (not 'number').
 * - image(): Invariant IV — omits 'url' key entirely when id is set.
 *   Image_Src_Prop_Type requires exactly one of {id, url}.
 *
 * @package Novamira_AdrianV2
 * @since   1.0.0
 */

namespace Novamira\AdrianV2\Helpers;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Static helpers for building and reading atomic prop values.
 *
 * @since 1.0.0
 */
final class V4_Props {

    /**
     * Wraps a plain string into a typed prop.
     *
     * @param string $value The string value.
     * @return array{$$type: string, value: string}
     */
    public static function string(string $value): array {
        return [
            '$$type' => 'string',
            'value'  => $value,
        ];
    }

    /**
     * Wraps a number into a typed prop.
     *
     * @param int|float $value The numeric value.
     * @return array{$$type: string, value: int|float}
     */
    public static function number($value): array {
        return [
            '$$type' => 'number',
            'value'  => $value,
        ];
    }

    /**
     * Wraps a boolean into a typed prop.
     *
     * @param bool $value The boolean value.
     * @return array{$$type: string, value: bool}
     */
    public static function boolean(bool $value): array {
        return [
            '$$type' => 'boolean',
            'value'  => $value,
        ];
    }

    /**
     * Wraps a size value (number + unit) into a typed prop.
     *
     * @param int|float $size The size number.
     * @param string    $unit The CSS unit (px, em, rem, %, vw, vh).
     * @return array{$$type: string, value: array{size: int|float, unit: string}}
     */
    public static function size($size, string $unit = 'px'): array {
        return [
            '$$type' => 'size',
            'value'  => [
                'size' => $size,
                'unit' => $unit,
            ],
        ];
    }

    /**
     * Wraps text content into an html-v3 typed prop.
     *
     * @param string $text Plain text content.
     * @return array{$$type: string, value: array{content: array, children: array}}
     */
    public static function html(string $text): array {
        return [
            '$$type' => 'html-v3',
            'value'  => [
                'content'  => self::string($text),
                'children' => [],
            ],
        ];
    }

    /**
     * Wraps a URL into a typed prop.
     *
     * @param string $url The URL string.
     * @return array{$$type: string, value: string}
     */
    public static function url(string $url): array {
        return [
            '$$type' => 'url',
            'value'  => $url,
        ];
    }

    /**
     * Builds a link prop from a URL string.
     *
     * @param string $url           The destination URL.
     * @param bool   $target_blank  Whether to open in new tab.
     * @return array{$$type: string, value: array}
     */
    public static function link(string $url, bool $target_blank = false): array {
        $link_value = [
            'destination' => self::url($url),
            'tag'         => self::string('a'),
        ];

        if ($target_blank) {
            $link_value['isTargetBlank'] = self::boolean(true);
        }

        return [
            '$$type' => 'link',
            'value'  => $link_value,
        ];
    }

    /**
     * Builds a classes prop from an array of class IDs.
     *
     * @param string[] $class_ids Array of class identifiers.
     * @return array{$$type: string, value: string[]}
     */
    public static function classes(array $class_ids = []): array {
        return [
            '$$type' => 'classes',
            'value'  => $class_ids,
        ];
    }

    /**
     * Wraps a WordPress media image reference.
     *
     * Invariant IV: When id is set, OMIT the url key entirely.
     *
     * @param int    $image_id  The attachment ID.
     * @param string $image_url The image URL (optional fallback, only used when no id).
     * @return array{$$type: string, value: array{src: array}}
     */
    public static function image(int $image_id, string $image_url = ''): array {
        $src = [];

        if ($image_id > 0) {
            $src['id'] = [
                '$$type' => 'image-attachment-id',
                'value'  => $image_id,
            ];
        } elseif ('' !== $image_url) {
            $src['url'] = self::url($image_url);
        }

        return [
            '$$type' => 'image',
            'value'  => [
                'src' => $src,
            ],
        ];
    }

    /**
     * Recursively unwraps $$type values back to plain values.
     *
     * @param mixed $prop The prop value (may or may not be $$type-wrapped).
     * @return mixed The unwrapped plain value.
     */
    public static function unwrap($prop) {
        if (!is_array($prop)) {
            return $prop;
        }

        if (isset($prop['$$type'])) {
            $type  = $prop['$$type'];
            $value = $prop['value'] ?? null;

            switch ($type) {
                case 'string':
                case 'number':
                case 'boolean':
                case 'url':
                    return $value;

                case 'size':
                    return is_array($value)
                        ? ($value['size'] ?? 0) . ($value['unit'] ?? 'px')
                        : $value;

                case 'html-v3':
                    if (is_array($value) && isset($value['content'])) {
                        return self::unwrap($value['content']);
                    }
                    return $value;

                case 'link':
                    if (is_array($value) && isset($value['destination'])) {
                        return self::unwrap($value['destination']);
                    }
                    return $value;

                case 'classes':
                    return is_array($value) ? $value : [];

                case 'image':
                    if (is_array($value) && isset($value['src']) && is_array($value['src'])) {
                        return [
                            'id'  => self::unwrap($value['src']['id'] ?? 0),
                            'url' => self::unwrap($value['src']['url'] ?? ''),
                        ];
                    }
                    return $value;

                default:
                    return is_array($value) ? self::unwrap_array($value) : $value;
            }
        }

        return self::unwrap_array($prop);
    }

    /**
     * Unwraps all values in an array recursively.
     *
     * @param array $arr The array to unwrap.
     * @return array Unwrapped array.
     */
    private static function unwrap_array(array $arr): array {
        $result = [];
        foreach ($arr as $key => $value) {
            $result[$key] = self::unwrap($value);
        }
        return $result;
    }

    /**
     * Exports the canonical V4 Property Type Schema.
     *
     * Source-of-truth for the pipeline's schemas/v4-prop-type-schema.json.
     * The pipeline calls wp-json/novamira-adrianv2/v1/prop-schema to stay
     * in sync (Phase 0.2 Schema-Dedup).
     *
     * @since 1.0.0
     * @return array
     */
    public static function get_schema(): array {
        return [
            '$schema'  => 'https://json-schema.org/draft/2020-12/schema',
            'title'    => 'Elementor V4 Property Type Schema',
            'version'  => NOVAMIRA_ADRIANV2_VERSION,
            'source'   => 'novamira-adrianv2 V2-Plugin — canonical source of truth',
            'types'    => [
                'string'  => ['shape' => ['$$type' => 'string', 'value' => 'string'], 'auto_wrap' => true],
                'number'  => ['shape' => ['$$type' => 'number', 'value' => 'number'], 'auto_wrap' => true],
                'boolean' => ['shape' => ['$$type' => 'boolean', 'value' => 'boolean'], 'auto_wrap' => true],
                'size'    => ['shape' => ['$$type' => 'size', 'value' => ['size' => 'number', 'unit' => 'string']], 'auto_wrap' => true, 'units' => ['px', 'em', 'rem', 'vw', 'vh', '%', 'pt', 'cm', 'mm', 'in', 'pc', 'ex', 'ch', 'vmin', 'vmax', 'fr', 'svh', 'svw', 'lvh', 'lvw', 'dvh', 'dvw']],
                'dimensions' => ['shape' => ['$$type' => 'dimensions', 'value' => ['block-start' => 'size', 'block-end' => 'size', 'inline-start' => 'size', 'inline-end' => 'size']], 'auto_wrap' => false],
                'color' => ['shape' => ['$$type' => 'color', 'value' => 'string'], 'auto_wrap' => true, 'format' => '#RGB | #RRGGBB | #RRGGBBAA | rgba(r,g,b,a) | named-color'],
                'global-color-variable' => ['shape' => ['$$type' => 'global-color-variable', 'value' => 'string'], 'auto_wrap' => false, 'format' => 'e-gv-[a-f0-9]{7}'],
                'global-font-variable'  => ['shape' => ['$$type' => 'global-font-variable', 'value' => 'string'], 'auto_wrap' => false, 'format' => 'e-gv-[a-f0-9]{7}'],
                'global-size-variable'  => ['shape' => ['$$type' => 'global-size-variable', 'value' => 'string'], 'auto_wrap' => false, 'format' => 'e-gv-[a-f0-9]{7}'],
                'url'   => ['shape' => ['$$type' => 'url', 'value' => 'string'], 'auto_wrap' => false],
                'html-v3' => ['shape' => ['$$type' => 'html-v3', 'value' => ['content' => 'string', 'children' => ['html-v3']]], 'auto_wrap' => false],
                'link'  => ['shape' => ['$$type' => 'link', 'value' => ['destination' => 'url', 'tag' => 'string', 'isTargetBlank' => 'boolean']], 'auto_wrap' => false],
                'classes' => ['shape' => ['$$type' => 'classes', 'value' => ['string']], 'auto_wrap' => false, 'format' => 'Array of style IDs or gc-* global class IDs'],
                'image' => ['shape' => ['$$type' => 'image', 'value' => ['src' => 'image-src', 'size' => 'string']], 'auto_wrap' => false],
                'image-src' => ['shape' => ['$$type' => 'image-src', 'value' => ['id' => 'image-attachment-id|null', 'url' => 'string|null']], 'constraint' => 'exactly-one-non-null(id, url). Omit url key when id is set.'],
                'image-attachment-id' => ['shape' => ['$$type' => 'image-attachment-id', 'value' => 'number']],
                'background' => ['shape' => ['$$type' => 'background', 'value' => ['color' => 'color|global-color-variable', 'background-overlay' => ['background-color-overlay|background-image-overlay']]], 'auto_wrap' => true],
                'box-shadow' => ['shape' => ['$$type' => 'box-shadow', 'value' => 'array'], 'auto_wrap' => false],
                'border-radius' => ['shape' => ['$$type' => 'border-radius', 'value' => ['start-start' => 'size', 'start-end' => 'size', 'end-start' => 'size', 'end-end' => 'size']], 'auto_wrap' => true],
                'flex' => ['shape' => ['$$type' => 'flex', 'value' => ['grow' => 'number', 'shrink' => 'number', 'basis' => 'string']], 'auto_wrap' => false],
                'raw-object' => ['shape' => ['raw' => 'string'], 'description' => 'custom_css container: {raw: base64(string)}'],
                'attributes' => ['shape' => ['$$type' => 'attributes', 'value' => [['_id' => 'string', 'key' => 'string', 'value' => 'string']]], 'auto_wrap' => false],
            ],
            'properties' => [
                'font-size'        => ['expected_type' => 'size', 'also_accepts' => ['global-size-variable'], 'category' => 'typography', 'mobile_threshold_px' => 28, 'unit_default' => 'px'],
                'font-family'      => ['expected_type' => 'string', 'also_accepts' => ['global-font-variable'], 'category' => 'typography'],
                'font-weight'      => ['expected_type' => 'string', 'category' => 'typography', 'enum' => ['100','200','300','400','500','600','700','800','900','normal','bold','bolder','lighter']],
                'line-height'      => ['expected_type' => 'size', 'also_accepts' => ['global-size-variable'], 'category' => 'typography', 'unit_default' => 'em'],
                'letter-spacing'   => ['expected_type' => 'size', 'also_accepts' => ['global-size-variable'], 'category' => 'typography', 'unit_default' => 'px'],
                'color'            => ['expected_type' => 'color', 'also_accepts' => ['global-color-variable'], 'category' => 'typography'],
                'text-align'       => ['expected_type' => 'string', 'category' => 'text-formatting', 'enum' => ['start','center','end','justify']],
                'text-transform'   => ['expected_type' => 'string', 'category' => 'text-formatting', 'enum' => ['none','capitalize','uppercase','lowercase']],
                'text-decoration'  => ['expected_type' => 'string', 'category' => 'text-formatting', 'enum' => ['none','underline','overline','line-through']],
                'padding'          => ['expected_type' => 'dimensions', 'category' => 'spacing', 'mobile_threshold_horizontal_px' => 20],
                'margin'           => ['expected_type' => 'dimensions', 'category' => 'spacing'],
                'gap'              => ['expected_type' => 'size', 'category' => 'spacing', 'unit_default' => 'px'],
                'width'            => ['expected_type' => 'size', 'category' => 'sizing', 'unit_default' => '%'],
                'max-width'        => ['expected_type' => 'size', 'category' => 'sizing', 'unit_default' => 'px'],
                'min-height'       => ['expected_type' => 'size', 'category' => 'sizing', 'unit_default' => 'px', 'mobile_threshold_px' => 200],
                'height'           => ['expected_type' => 'size', 'category' => 'sizing', 'unit_default' => 'px'],
                'opacity'          => ['expected_type' => 'size', 'category' => 'sizing', 'unit_default' => 'px'],
                'display'          => ['expected_type' => 'string', 'category' => 'flexbox-layout', 'enum' => ['block','inline','inline-block','flex','inline-flex','grid','inline-grid','flow-root','none','contents']],
                'flex-direction'   => ['expected_type' => 'string', 'category' => 'flexbox-layout', 'enum' => ['row','row-reverse','column','column-reverse']],
                'flex-wrap'        => ['expected_type' => 'string', 'category' => 'flexbox-layout', 'enum' => ['wrap','nowrap','wrap-reverse']],
                'justify-content'  => ['expected_type' => 'string', 'category' => 'flexbox-layout', 'enum' => ['center','start','end','flex-start','flex-end','left','right','normal','space-between','space-around','space-evenly','stretch']],
                'align-items'      => ['expected_type' => 'string', 'category' => 'flexbox-layout', 'enum' => ['normal','stretch','center','start','end','flex-start','flex-end','self-start','self-end','anchor-center']],
                'align-self'       => ['expected_type' => 'string', 'category' => 'flexbox-layout', 'enum' => ['normal','stretch','center','start','end','flex-start','flex-end','self-start','self-end','anchor-center']],
                'flex'             => ['expected_type' => 'flex', 'category' => 'flexbox-layout'],
                'border-radius'    => ['expected_type' => 'size', 'also_accepts' => ['border-radius'], 'category' => 'border', 'unit_default' => 'px'],
                'border-width'     => ['expected_type' => 'size', 'category' => 'border', 'unit_default' => 'px'],
                'border-color'     => ['expected_type' => 'color', 'also_accepts' => ['global-color-variable'], 'category' => 'border'],
                'border-style'     => ['expected_type' => 'string', 'category' => 'border', 'enum' => ['none','hidden','dotted','dashed','solid','double','groove','ridge','inset','outset']],
                'background-color' => ['expected_type' => 'color', 'also_accepts' => ['global-color-variable'], 'category' => 'background'],
                'background'       => ['expected_type' => 'background', 'category' => 'background', 'auto_wrap' => true],
                'box-shadow'       => ['expected_type' => 'box-shadow', 'category' => 'effects'],
                'position'         => ['expected_type' => 'string', 'category' => 'positioning', 'enum' => ['relative','absolute','fixed','sticky']],
                'overflow'         => ['expected_type' => 'string', 'category' => 'positioning', 'enum' => ['visible','hidden','scroll','auto']],
                'object-fit'       => ['expected_type' => 'string', 'category' => 'image', 'enum' => ['fill','contain','cover','none','scale-down']],
                'custom_css'       => ['expected_type' => 'raw-object', 'category' => 'custom'],
            ],
            'widget_requirements' => [
                'e-heading'   => ['required' => ['title']],
                'e-paragraph' => ['required' => ['editor']],
                'e-button'    => ['required' => ['title']],
                'e-image'     => ['required' => ['image-src']],
                'e-svg'       => ['required' => ['svg']],
                'e-divider'   => ['required' => []],
                'e-flexbox'   => ['required' => []],
                'e-div-block' => ['required' => []],
            ],
            'responsive_rules' => [
                'mandatory_mobile_if_oversize' => [
                    'font-size'       => ['threshold_px' => 28],
                    'flex-direction'  => ['threshold' => "value === 'row'"],
                    'width_px'        => ['threshold' => "unit === 'px' && size > 100"],
                    'width_pct'       => ['threshold' => "unit === '%' && size < 100"],
                    'min-height'      => ['threshold_px' => 200],
                    'padding_inline'  => ['threshold_px' => 20],
                ],
                'browser_handles' => ['font-family', 'font-weight', 'text-transform', 'color', 'text-align', 'object-fit', 'aspect-ratio', 'background-size'],
            ],
            'common_errors' => [
                ['wrong' => 'color: e-gv-f958850 (bare string)', 'right' => 'color: {$$type: global-color-variable, value: e-gv-f958850}', 'reason' => 'Auto-wrap erkennt keine Token-IDs'],
                ['wrong' => 'font-weight: 700 (number)', 'right' => 'font-weight: "700" (string)', 'reason' => 'font-weight muss string sein'],
                ['wrong' => 'flex-direction: horizontal', 'right' => 'flex-direction: row', 'reason' => 'horizontal/vertical existieren nicht'],
                ['wrong' => 'text-align: left', 'right' => 'text-align: start', 'reason' => 'left/right nicht im Enum'],
                ['wrong' => 'gap: "24px" (string)', 'right' => 'gap: 24 (number, px default)', 'reason' => 'Zahl ohne Anführungszeichen'],
                ['wrong' => 'custom_css: plain string', 'right' => 'custom_css: {raw: base64_encode(string)}', 'reason' => 'Plain string crasht die Seite. Muss base64 in raw-Objekt sein.'],
                ['wrong' => 'image-src with id AND url:null', 'right' => 'omitt url key entirely when id is set', 'reason' => 'url key ganz weglassen wenn id gesetzt. url:null wird von PHP sanitize gelöscht.'],
                ['wrong' => 'Styles defined, classes.value empty', 'right' => 'Every local style ID must be in classes.value', 'reason' => 'Render-Gate: styles ohne classes sind unerreichbar.'],
            ],
        ];
    }

    /**
     * Checks whether Elementor atomic (V4) elements are available AND will persist.
     *
     * @return bool True if atomic element types are registered/available.
     */
    public static function is_atomic_supported(): bool {
        if (class_exists('\\Elementor\\Plugin') && method_exists('\\Elementor\\Plugin', 'instance')) {
            $elementor = \Elementor\Plugin::instance();

            if (
                isset($elementor->elements_manager)
                && is_object($elementor->elements_manager)
                && method_exists($elementor->elements_manager, 'get_element_types')
            ) {
                $types = $elementor->elements_manager->get_element_types();
                if (is_array($types) && (isset($types['e-flexbox']) || isset($types['e-div-block']))) {
                    return true;
                }
            }

            if (
                isset($elementor->experiments)
                && is_object($elementor->experiments)
                && method_exists($elementor->experiments, 'is_feature_active')
            ) {
                foreach (['e_atomic_elements', 'atomic_widgets'] as $feature) {
                    if ($elementor->experiments->is_feature_active($feature)) {
                        return true;
                    }
                }
            }
        }

        return defined('ELEMENTOR_VERSION') && version_compare(ELEMENTOR_VERSION, '4.0.0', '>=');
    }
}
