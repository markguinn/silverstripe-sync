<?php
require_once dirname(__FILE__) . '/_sync_types.php';

define('SYNC_MODULE_FOLDER', dirname(__FILE__));

// Set up a route manually. I don't know of a better way to
// do this while still allowing the url segment to change.
// Pull requests welcome if there is a way.
if (Config::inst()->get('SyncController', 'url_segment') != 'sync') {
	Director::addRules(
		100,
		array(
			Config::inst()->get('SyncController', 'url_segment') . '/$SyncContext' => 'SyncController',
		)
	);
}
