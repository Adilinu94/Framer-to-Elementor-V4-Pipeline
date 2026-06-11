<?php
declare(strict_types=1);

namespace Novamira\AdrianV2\Abilities\CustomCode;

if (!defined('ABSPATH')) {
    exit();
}

/**
 * Custom_Code — XSS-safe JS/CSS injection abilities.
 *
 * Provides `novamira/adrians-add-custom-js` and `novamira/adrians-add-custom-css`
 * for injecting page-level JavaScript and CSS into Elementor pages.
 *
 * Security model (Phase 0.5.4):
 * - Users WITHOUT `unfiltered_html` capability:
 *     - JS: wp_kses_post() strips <script>, <iframe>, on* handlers, and
 *       javascript: URLs; if anything was stripped, refuse with an error
 *       rather than silently changing the payload. Defense-in-depth blocklist
 *       of dangerous JS patterns (document.cookie, eval, innerHTML, etc.)
 *       is rejected.
 *     - CSS: wp_strip_all_tags() strips HTML; additionally reject payloads
 *       containing @import, expression(), behavior:, or javascript: patterns.
 * - Users WITH `unfiltered_html` capability (single-site admin, multisite
 *   super-admin): All content passes through unchanged (backward compatibility).
 *
 * Audit evidence: novamira-improvement-2026-06/report.md, item B9.
 *
 * @since 1.0.0
 */
class Custom_Code {

    /**
     * @var string[]
     */
    private static array $ability_names = [];

    /**
     * Dangerously unsafe JS patterns blocked for users without unfiltered_html.
     *
     * Covers the most common XSS vectors: cookie exfiltration, location
     * redirection, DOM injection, eval-based code execution, and
     * javascript: pseudo-URLs.
     *
     * @var string[]
     */
    private const DANGEROUS_JS_PATTERNS = [
        'document.cookie',
        'window.location',
        'document.location',
        'eval(',
        'new Function(',
        'setTimeout("',
        "setTimeout('",
        'setInterval("',
        "setInterval('",
        '.innerHTML',
        '.outerHTML',
        '.insertAdjacentHTML',
        'javascript:',
    ];

    /**
     * Unsafe CSS patterns blocked for users without unfiltered_html.
     *
     * Covers CSS-based XSS vectors: expression() dynamic properties,
     * @import-based SSRF/data exfiltration, behavior: (IE-only but
     * defense-in-depth), and javascript: pseudo-URLs.
     *
     * @var string[]
     */
    private const DANGEROUS_CSS_PATTERNS = [
        'expression(',
        '@import',
        'behavior:',
        'javascript:',
    ];

    /**
     * Register both custom-code abilities.
     *
     * @return void
     */
    public static function register(): void {
        // ── add-custom-js ──────────────────────────────────────────────────
        wp_register_ability('novamira/adrians-add-custom-js', [
            'label'              => 'Add Custom JS',
            'description'        => 'Inject custom JavaScript on a page. XSS-safe: requires unfiltered_html capability for raw script injection; otherwise sanitized with refuse-on-modify semantics.',
            'category'           => 'adrians',
            'input_schema'       => [
                'type'       => 'object',
                'properties' => [
                    'post_id' => [
                        'type'        => 'integer',
                        'description' => 'Post ID to inject JS into.',
                    ],
                    'code'    => [
                        'type'        => 'string',
                        'description' => 'JavaScript code to inject. Users without unfiltered_html: no HTML tags, no eval(), no dangerous DOM APIs.',
                    ],
                ],
                'required'   => ['post_id', 'code'],
            ],
            'output_schema'      => [
                'type'       => 'object',
                'properties' => [
                    'success'  => ['type' => 'boolean'],
                    'message'  => ['type' => 'string'],
                    'post_id'  => ['type' => 'integer'],
                    'sanitized'=> ['type' => 'boolean', 'description' => 'true if the code was sanitized (user lacks unfiltered_html)'],
                    'error'    => ['type' => 'string'],
                ],
            ],
            'execute_callback'   => [self::class, 'execute_add_js'],
            'permission_callback' => 'novamira_permission_callback',
            'meta'               => [
                'show_in_rest' => true,
                'mcp'          => ['public' => true],
                'annotations'  => ['readonly' => false, 'destructive' => true, 'idempotent' => false],
            ],
        ]);
        self::$ability_names[] = 'novamira/adrians-add-custom-js';

        // ── add-custom-css ────────────────────────────────────────────────
        wp_register_ability('novamira/adrians-add-custom-css', [
            'label'              => 'Add Custom CSS',
            'description'        => 'Inject custom CSS on a page. Sanitized: strips HTML tags, blocks url()/@import/expression() for users without unfiltered_html.',
            'category'           => 'adrians',
            'input_schema'       => [
                'type'       => 'object',
                'properties' => [
                    'post_id' => [
                        'type'        => 'integer',
                        'description' => 'Post ID to inject CSS into.',
                    ],
                    'code'    => [
                        'type'        => 'string',
                        'description' => 'CSS code to inject. Users without unfiltered_html: no url(), @import, or expression().',
                    ],
                ],
                'required'   => ['post_id', 'code'],
            ],
            'output_schema'      => [
                'type'       => 'object',
                'properties' => [
                    'success'  => ['type' => 'boolean'],
                    'message'  => ['type' => 'string'],
                    'post_id'  => ['type' => 'integer'],
                    'sanitized'=> ['type' => 'boolean'],
                    'error'    => ['type' => 'string'],
                ],
            ],
            'execute_callback'   => [self::class, 'execute_add_css'],
            'permission_callback' => 'novamira_permission_callback',
            'meta'               => [
                'show_in_rest' => true,
                'mcp'          => ['public' => true],
                'annotations'  => ['readonly' => false, 'destructive' => true, 'idempotent' => false],
            ],
        ]);
        self::$ability_names[] = 'novamira/adrians-add-custom-css';
    }

    /**
     * @return string[]
     */
    public static function get_ability_names(): array {
        return self::$ability_names;
    }

    // ───────────────────────────────────────────────────────────────────
    //  Execute: add-custom-js
    // ───────────────────────────────────────────────────────────────────

    /**
     * Inject custom JavaScript into an Elementor page.
     *
     * Appends the JS via Elementor's Custom Code mechanism
     * (_elementor_page_settings.custom_js) after XSS validation.
     *
     * @param array|null $input Request payload.
     * @return array Result with success/error and metadata.
     */
    public static function execute_add_js(?array $input = null): array {
        $post_id = isset($input['post_id']) ? (int) $input['post_id'] : 0;
        $code    = isset($input['code']) ? trim($input['code']) : '';

        if ($post_id <= 0) {
            return ['success' => false, 'error' => 'Invalid post_id.'];
        }
        if ($code === '') {
            return ['success' => false, 'error' => 'code must not be empty.'];
        }
        $post = get_post($post_id);
        if (!$post) {
            return ['success' => false, 'error' => "Post {$post_id} not found."];
        }

        // Phase 0.5.4: XSS guard for JS.
        $js_guard_error = self::guard_js($code);
        if (null !== $js_guard_error) {
            return $js_guard_error;
        }

        // Store JS in Elementor page settings.
        $settings = get_post_meta($post_id, '_elementor_page_settings', true);
        if (!is_array($settings)) {
            $settings = [];
        }
        $settings['custom_js'] = $code;
        update_post_meta($post_id, '_elementor_page_settings', $settings);

        return [
            'success'   => true,
            'message'   => 'Custom JavaScript injected successfully.',
            'post_id'   => $post_id,
            'sanitized' => false,
        ];
    }

    // ───────────────────────────────────────────────────────────────────
    //  Execute: add-custom-css
    // ───────────────────────────────────────────────────────────────────

    /**
     * Inject custom CSS into an Elementor page.
     *
     * Stores the CSS via Elementor's custom_css page setting after
     * validation.
     *
     * @param array|null $input Request payload.
     * @return array Result with success/error and metadata.
     */
    public static function execute_add_css(?array $input = null): array {
        $post_id = isset($input['post_id']) ? (int) $input['post_id'] : 0;
        $code    = isset($input['code']) ? trim($input['code']) : '';

        if ($post_id <= 0) {
            return ['success' => false, 'error' => 'Invalid post_id.'];
        }
        if ($code === '') {
            return ['success' => false, 'error' => 'code must not be empty.'];
        }
        $post = get_post($post_id);
        if (!$post) {
            return ['success' => false, 'error' => "Post {$post_id} not found."];
        }

        // Phase 0.5.4: CSS guard.
        $css_guard_error = self::guard_css($code);
        if (null !== $css_guard_error) {
            return $css_guard_error;
        }

        $settings = get_post_meta($post_id, '_elementor_page_settings', true);
        if (!is_array($settings)) {
            $settings = [];
        }
        $settings['custom_css'] = $code;
        update_post_meta($post_id, '_elementor_page_settings', $settings);

        return [
            'success'   => true,
            'message'   => 'Custom CSS injected successfully.',
            'post_id'   => $post_id,
            'sanitized' => false,
        ];
    }

    // ───────────────────────────────────────────────────────────────────
    //  Guards (Phase 0.5.4)
    // ───────────────────────────────────────────────────────────────────

    /**
     * JS guard — XSS protection for custom JavaScript injection.
     *
     * Returns null if the input is safe to store, or an error-result
     * array if it should be rejected.
     *
     * Security model:
     * - Admin (unfiltered_html): pass-through, no sanitization.
     * - Others: wp_kses_post() strips dangerous HTML elements/attributes
     *   while preserving JS code; refuse-on-modify if anything was stripped.
     *   Then blocklist check for dangerous JS API patterns.
     *
     * @param string $js Raw JavaScript input.
     * @return array|null Null = safe, array = error result to return.
     */
    private static function guard_js(string $js): ?array {
        // Admin pass-through.
        if (current_user_can('unfiltered_html')) {
            return null;
        }

        // wp_kses_post strips <script>, <iframe>, on* handlers, javascript:
        // URLs while preserving plain text (including JS comparison operators).
        // Refuse-on-modify: if anything was stripped, reject with error.
        $sanitized = wp_kses_post($js);
        if ($sanitized !== $js) {
            return [
                'success' => false,
                'error'   => 'JS contains disallowed HTML (e.g. <script>, on* event handlers, javascript: URLs). Either remove the markup or grant the calling user the unfiltered_html capability.',
            ];
        }

        // Defense-in-depth: blocklist of known-dangerous JS patterns.
        foreach (self::DANGEROUS_JS_PATTERNS as $pattern) {
            if (false !== stripos($js, $pattern)) {
                return [
                    'success' => false,
                    'error'   => sprintf(
                        'JS contains blocked pattern "%s". This requires the unfiltered_html capability.',
                        esc_html($pattern)
                    ),
                ];
            }
        }

        return null;
    }

    /**
     * CSS guard — protection for custom CSS injection.
     *
     * Returns null if the input is safe to store, or an error-result
     * array if it should be rejected.
     *
     * Security model:
     * - Admin (unfiltered_html): pass-through, no sanitization.
     * - Others: wp_strip_all_tags() strips HTML; then blocklist for
     *   @import, expression(), behavior:, javascript: patterns.
     *
     * @param string $css Raw CSS input.
     * @return array|null Null = safe, array = error result to return.
     */
    private static function guard_css(string $css): ?array {
        // Admin pass-through.
        if (current_user_can('unfiltered_html')) {
            return null;
        }

        // Strip ALL HTML tags — refuse if anything was removed.
        $sanitized = wp_strip_all_tags($css);
        if ($sanitized !== $css) {
            return [
                'success' => false,
                'error'   => 'CSS contains disallowed HTML tags. Either remove them or grant the calling user the unfiltered_html capability.',
            ];
        }

        // Block CSS-based injection vectors.
        foreach (self::DANGEROUS_CSS_PATTERNS as $pattern) {
            if (false !== stripos($css, $pattern)) {
                return [
                    'success' => false,
                    'error'   => sprintf(
                        'CSS contains blocked pattern "%s". This requires the unfiltered_html capability.',
                        esc_html($pattern)
                    ),
                ];
            }
        }

        return null;
    }
}

add_action('wp_abilities_api_init', [Custom_Code::class, 'register']);
