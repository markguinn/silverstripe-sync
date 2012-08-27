<?php
require_once dirname(__FILE__) . '/_sync_types.php';

define('SYNC_MODULE_FOLDER', 'SapphireSync');

// Set up a route
Director::addRules(
	100,
	array(
		SyncController::$url_segment . '/$SyncContext' => 'SyncController',
	)
);