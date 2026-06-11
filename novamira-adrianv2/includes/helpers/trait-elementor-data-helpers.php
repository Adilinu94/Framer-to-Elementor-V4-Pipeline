<?php
declare(strict_types=1);

namespace Novamira\AdrianV2\Helpers;

if ( ! defined( 'ABSPATH' ) ) { exit; }

trait Elementor_Data_Helpers {
    protected static function elementor_get_document( int $post_id ) {
        if ( ! class_exists( '\Elementor\Plugin' ) ) { return null; }
        return \Elementor\Plugin::$instance->documents->get( $post_id );
    }

    protected static function elementor_get_data( int $post_id ): array {
        $doc = self::elementor_get_document( $post_id );
        if ( ! $doc ) { return []; }
        $data = $doc->get_elements_data();
        return is_array( $data ) ? $data : [];
    }

    protected static function elementor_save_data( int $post_id, array $data ): bool {
        $doc = self::elementor_get_document( $post_id );
        if ( ! $doc ) { return false; }
        $doc->update_json_meta( '_elementor_data', $data );
        return true;
    }
}
