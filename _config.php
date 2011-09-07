<?php
require_once dirname(__FILE__) . '/_sync_types.php';

// Set up a route
Director::addRules(
	50,
	array(
		SyncController::$url_segment . '/$SyncContext' => 'SyncController',
	)
);