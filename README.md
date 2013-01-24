Silverstripe Sync
=================
v0.2

This module is in a very very early stage. It's just been refactored
from a project under active development and so lacks some functionality
that would be generally useful but isn't required for our one project.
Hopefully it can grow from here.

*The following is old documentation. I need to update this. Sorry.*

Server usage:

There are a few statics you can set to configure things like the sync
API url and set up additional syncing "contexts" with different rules.

The only required setup is that you define a static on the models you
want to sync with some configuration.




Client usage:

Make sure sync/javascript/sencha.js is included. This should work for
both Sencha Touch 1.x and ExtJS 4.

// REQUIRED: before you sync you must tell it which models to sync
SapphireSync.models = ['Store','Product','User'];

// OPTIONAL: no authentication is done by default, but if you
// add that to your SyncContext setup on the server side, this
// would be where you specify additional parameters to get included
// with each POST request.
SapphireSync.auth = {
	user: 'john',
	password: 'abcdef'
};

Then to initiate the sync:

SapphireSync.allModels();

Or:

SapphireSync.allModels(false, function(){
	// this will be called when sync is complete
});