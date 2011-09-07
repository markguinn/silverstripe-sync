<?php
// Syncing constants
define('SYNC_NONE',	'');		// model is not synced to the kiosk at all
define('SYNC_FULL',	'full');	// changes flow both ways
define('SYNC_DOWN',	'down');	// changes only flow from server to client
define('SYNC_UP', 	'up');		// changes only flow from client to server AND existing records are never downloaded
