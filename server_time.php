<?php
/**
 * This just simply returns the current server time as a timestamp. It's not part of
 * Silverstripe because there's just no reason to load the whole framework for such
 * a simple task.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 11.03.2011
 * @package silverstripe-sync
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: X-Requested-With');
if (isset($_REQUEST['SSCB'])) {
	header('Content-type: text/javascript');
	echo $_REQUEST['SSCB'] . '({"ok":1, "time":' . time() . '});';
} else {
	header('Content-type: application/json');
	echo '{"ok":1, "time":' . time() . '}';
}
