<?php
/**
 * Processes where filters and makes a few things easier
 * such as date ranges. Currently processes:
 *
 * 'Date' => ':future'
 * 'Date' => ':last X days'
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 3.13.13
 * @package silverstripe-sync
 */
class SyncFilterHelper
{
    /**
     * @static
     * @param array $filters
     * @return array
     */
    public static function process_filters(array $filters) {
        $out = array();

        foreach ($filters as $field => $filter) {
            if (is_string($filter) && $filter == ':future') {
                $out[$field . ':GreaterThan'] = date('Y-m-d H:i:s');
            } elseif (is_string($filter) && preg_match('/^:last (\d+) days?$/', $filter, $matches)) {
                $out[$field . ':GreaterThan'] = date('Y-m-d H:i:s', time() - ($matches[1] * 24 * 60 * 60));
            } else {
                // pass everything else through
                $out[$field] = $filter;
            }
   		}

        return $out;
    }


	/**
	 * @param array $field_names
	 * @return array - key=real field name, value=false|callable
	 */
	public static function process_fields(array $field_names) {
		$out = array();

		foreach ($field_names as $name) {
			if (strpos($name, ':') !== false) {
				$parts = explode(':', $name);
				$out[$parts[0]] = array('SyncFilterHelper', $parts[1]);
			} else {
				$out[$name] = false;
			}
		}

		return $out;
	}


	// Filter functions /////////////////////////////////////////////////////////


	/**
	 * @param $s
	 * @return string
	 */
	public static function strip_html($s) {
		return Convert::html2raw($s);
	}


	/**
	 * @param $s
	 * @return string
	 */
	public static function quote_html($s) {
		return htmlentities($s);
	}

}
