Silverstripe Setup
==================

Install the module via composer. There are two ways to define
the configuration. You can use a static $sync field on each
model class or define one or more SyncContext subclasses. The
former is quicker and keeps all the information about a single
model in one place. The latter allows multiple configurations
and sync endpoints, allows you to sync classes you don't have
control over or may not want to modify (BlogEntry, etc), and
keeps all syncing configuration together.

NOTE: This module has not been updated to utilize the new yml
configuration yet. Sorry! Pull requests welcome on that.

Example of Configuration
------------------------
```
class BlogPost extends DataObject {
	// ...

	public static $sync = array(
		'type'		=> 'down',
		'fields'	=> 'ID,LastEdited,Title:strip_html_and_whitespace,Author:strip_html,Date,Content,Summary,Link,Category,BlogID',
		'filter'	=> array('Date' => ':last 90 days'),
	);

	// ...
}
```


Example of SyncContext
----------------------
```
require_once BASE_PATH . '/' . SYNC_MODULE_FOLDER . '/_sync_types.php';
class MobileSyncContext extends SyncContext
{
	public function __construct() {
		parent::__construct(array(
			'SenchaTestApp.model.BlogEntry' => array(
				'type'		=> SYNC_DOWN,
				'model'		=> 'BlogEntry',
				'sort'		=> 'Date DESC',
				'fields'	=> "ID,LastEdited,Date,Title,ContentSummary,ContentForMobile as Content",
				'limit'		=> 10
			),
			'SenchaTestApp.model.CalendarEvent' => array(
				'type'		=> SYNC_DOWN,
				'model'		=> 'CalendarEvent',
				'fields'	=> "ID,LastEdited,StartDate,StartDateFormatted,Title,Details,TimeFrame,CategoryID",
				'filter'	=> array(
									'StartDate:GreaterThan' => date('Y-m-d H:i:s', time() - 24 * 60 * 60),
									'StartDate:LessThan' => date('Y-m-d H:i:s', time() + 90 * 24 * 60 * 60),
								),
				'sort'		=> 'StartDate ASC',
			),
		));
	}
}
```

In this example, the sync is for a Sencha Touch 2 app where the model names on the client are
different from the names on the server. Also notice "ContentForMobile as Content" in the field
list. ContentForMobile() is a method that returns formatted content. As you would expect, the
field name sent to the client is "Content" though.


Configuration Options
---------------------
- __type:__     Options: none, full, up, down (or you can use the SYNC_NONE, etc constants in _sync_types.php)
                "up" means data is only sent from the client back to the server. "down" means data is only
                sent from the server to the client and server data can never be changed by the client. "full"
                means whichever side has a newer timestamp will change the other side.
- __model:__    Defines the model class on the server. Only required if it's different.
- __fields:__   Which fields to sync. ID and LastEdited are required. It uses basically the same rules as
				the template language for retrieving field values - Field(), getField(), etc.
				There are also some filters that can be added here such as ":strip_html". See SyncFilterHelper
				for a full list.
- __filter:__   Standard array as passed to DataList::filter(). The only difference is there are some
				additional tags that can be used in the value part of the filter. For example ':last 90 days'
				in the first example above. See SyncFilterHelper for examples. Currently only :last x days and
				:future are supported.
- __limit:__    Optionally limit number of results
- __sort:__     Optionally sort the results
- __join:__     Optionally join results. Value should be an array with the parameters to DataList::innerJoin OR
				a 3-dimensional array where the first element is the type of join (e.g. `array('left', 'Table', 'Table.ID = Table2.ID')`)


Request Level Options
---------------------
The client can also send any of the following parameters with the request:
- __data_format:__  Default is 'c' but some adapters (android) use 'U'. This is just a data() format string.

