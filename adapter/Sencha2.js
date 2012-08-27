/**
 * Sync adapter for Sencha Touch 2. NOTE: I don't love sticking 3 classes in
 * the one file like this, but when they were in their own files, the packaged
 * version (for PhoneGap, etc) was not working well.
 *
 * NOTE: This requires a pretty specific model setup in Sencha:
 *	idProperty:	'LocalID',
 *	fields: [
 *		{name:'LocalID',	type:'int'},
 *		{name:'ID',			type:'int'},
 *		{name:'LastEdited',	type:'date', dateFormat: 'c'},
 *		...
 *	],
 * It's not necessary for LocalID to be specifically called that,
 * I just renamed it to avoid confusion. I haven't found a way for
 * Sencha to use the same ID as Sapphire. It keeps wanting to override
 * plus, you've got to find a way for autonumber fields to work right.
 *
 * The model can define the following functions:
 *  - beforeSyncDelete			-- called before the record is deleted on the client
 *  - beforeSyncClientUpdate	-- called when a record has changed on the client right before it's sent to the server
 *  - beforeSyncClientInsert	-- called on a new record before it's sent to the server
 *  - onSyncServerUpdate		-- called after a change from the server has been saved to the client record
 *  - onSyncServerInsert		-- called after a new record has been created on the client originating at the server (note: also called on our own new records)
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 7.23.12
 * @package SapphireSync
 * @subpackage adapters
 */

Ext.define('SapphireSync.adapter.Sencha2', {
	extend:				'Ext.Evented',
//	requires:			['SapphireSync.adapter.Sencha2.Batch'],
	
	// !Configuration /////////////////////////////////////////
	config:{
		mask:{
			xtype:		'loadmask',
			message:	'Synchronizing...',
		},
	
		maskTpl:		'Synchronizing...<br>{pct}%',
		
		timeoutMin:		4, 			// minutes
		
		apiUrl:			'/sync',
		
		serverTimeUrl:	'/sync/server_time.php',
		
		useJsonp:		false,		// we don't want to autodetect this because it's also possible to do cross-domain xhr
	
		/**
		 * a list of model name strings
		 */
		models:			[],
	
		/**
		 * A list of stores. If a store is not found with the same name as the model, one will be created.
		 */
		stores:			{},
		
		/**
		 * these keys will be added into all requests to the server
		 */
		auth:			{},
	},


	// !Member variables //////////////////////////////////////


	/**
	 * lookup table: model => { id => local id, id, etc }
	 */
	lookup:			null,
	
	
	/**
	 * Number of seconds difference between server time and local time (UTC)
	 */
	serverOffset:	0,
	
	
	/**
	 * the processing queue. don't access manually.
	 */
	queue:			[],


	/**
	 * a lock so we're not doing two at once
	 */
	isProcessing:	false,
	
	isFirstSync: 	true,


	// !Methods ///////////////////////////////////////////////	
	
/*
    constructor: function(config){
        config = config || {};
        this.initialConfig = config;
        Ext.apply(this, config);

        this.addEvents(
        	'complete',		// Fired when a batch is complete, whether it succeeded or failed
        	'success',		// Fired when a batch is complete. Never fires if allModels is not called (i.e. when accessing singleModel directly)
        	'afterfirstsync',// Fired when the first sync is complete or when a full refresh has completed
        	'aftersingle',	// Fired when a single model is copmlete. Fires multiple times when allModels is called
        	'error'			// Fired when a batch has errored out
        );

        // Call our superclass constructor to complete construction process.
        SenchaSyncAdapter.superclass.constructor.call(this, config)
    },
*/
    
    	
	/**
	 * Syncronises models with the server. This is depricated.
	 * Better to just use initBatch.
	 */
	allModels:function(doFullRefresh, onComplete){
		return this.initBatch({
			fullRefresh:	doFullRefresh,
			abortOnError:	true,
			listeners:{
				after:	onComplete
			}
		});
	},


	/**
	 * syncronises a single model (see docblock in SyncController::sync() for a full explanation)
	 * This is also depricated. Just use initBatch.
	 */
	singleModel:function(modelName, onComplete, doFullRefresh, beenWaiting){
		return this.initBatch({
			fullRefresh:	doFullRefresh,
			models:			[modelName],
			showMask:		false,
			suppressAdapterEvents:true,
			listeners:{
				after:	onComplete
			}
		});
	},
	
	
	/**
	 * Creates a new batch of models to sync, adds them to the queue,
	 * and start's processing if we're not in the middle of processing
	 */
	initBatch:function(config){
		if (config.fullRefresh) config.isFirstSync = true;
		var self = this;
		
		// initialize the lookups if needed
		if (this.lookup == null) this.initLookups();
		
		// copy the global configuration if needed
		Ext.each(['mask','maskTpl','timeoutMin','models','stores','auth'], function(k){
			if (typeof config[k] == 'undefined') config[k] = self.getConfig(k);
		});
		config.syncAdapter = self;
		
		// create the actual batch object and add it to the queue
		var batch = Ext.create('SapphireSync.adapter.Sencha2.Batch', config);
		batch.on('error', this.setDirtyFlag, this);
		this.queue.push(batch);
		this.processQueue();
		
		// set the "last sync" flag unless prohibited
		if (!config.noLastSyncFlag) {
			this.setLastSync();
		}
		
		return batch;
	},
	
	
	
	/**
	 * Wipes out the queue but doesn't stop any current processing.
	 */
	clearQueue:function() {
		this.queue = [];
	},
	
	
	/**
	 * Processes the first batch in the queue. OR if we're in the middle of something just returns.
	 */
	processQueue:function() {
		if (this.isProcessing) return null;
		if (this.queue.length == 0) return null;
		
		this.curBatch = this.queue.shift();
		
		// when the batch is finished, clean up and start the next
		this.curBatch.on('complete', function(){
			this.isProcessing = false;
			this.curBatch = null;
			this.processQueue();
		}, this);
		
		// start 'er up
		this.isProcessing = true;
		this.curBatch.process();
		return this.curBatch;
	},
	
	
	/**
	 * Looks up a model by the remote ID rather than the local ID
	 * This could be a non-trivial process as you have to actually
	 * loop through every record.
	 *
	 * NOTE: callbacks are now optional. returns null or the record.
	 *
	 * @param string modelName
	 * @param int id
	 * @param function onSuccess [optional]
	 * @param function onFailure [optional]
	 */
	findModelByID: function(modelName, id, onSuccess, onFailure){
		if (typeof onSuccess != 'function') onSuccess = Ext.emptyFn;
		if (typeof onFailure != 'function') onFailure = Ext.emptyFn;
		
		// if id is an array, we loop through and call onSuccess on each one, then return the last value
		if (Ext.isArray(id)) {
			var rec = null;
			for (var i = 0; i < id.length; i++) {
				rec = this.findModelByID(modelName, id[i], onSuccess, onFailure);	
			}
			if (!rec) onFailure('Not found');
			return rec;
		}
		
		var proxy = this.getStore(modelName).getProxy();
		
		if (this.lookup[modelName] && typeof this.lookup[modelName][id] != 'undefined') {
		
			// if it's in the lookup, we can go straight to the proxy cache
			var localID = this.lookup[modelName][id];
			if (localID !== false) {
				var rec = proxy.cache[localID];
				if (rec) {
					onSuccess(rec);
					return rec;
				} else {
					onFailure('Not found');
					return null
				}
			} else {
				onFailure('Not found');
				return null;
			}
			
		} else {
			
			// otherwise, we loop through the cache
			for (var localID in proxy.cache) {
				if (proxy.cache[localID].get('ID') == id) {
					this.lookup[modelName][id] = localID;
					onSuccess(proxy.cache[localID]);
					return proxy.cache[localID];
				}
			}
			
			// if we got through the whole cache, it isn't here
			this.lookup[modelName][id] = false;
			onFailure('Not found');
			return null;
		
		}
	},


	/**
	 * Initializes our lookup tables for all models.
	 * This doesn't actually take as long as it looks like it might.
	 */
	initLookups:function(dontLoad){
		this.clearLookups();
		var models = this.getModels();
		for (var i = 0; i < models.length; i++) {
			var modelName = models[i];
			//console.log('Initializing lookup for '+modelName);
			var s = this.getStore(modelName);
			this.lookup[modelName] = {};

			if (dontLoad) continue;
			try {
//				var self = this;
				s.load();
				var recs = s.getProxy().cache;
				for (var localID in recs) {
					if (!recs[localID].get('ID')) continue;
					this.lookup[modelName][ recs[localID].get('ID') ] = localID;
				}
/*
				s.each(function(rec){
					if (!rec.get('ID')) return;
					self.lookup[modelName][ rec.get('ID') ] = rec.get('LocalID');
				});
*/
			} catch(e) {
				console.log('Error loading model '+modelName+'. Resetting local db');
				localStorage.clear();
				this.initLookups(true);
			}
		}
	},
	
	
	/**
	 * Clears the lookups
	 */
	clearLookups:function(){
		this.lookup = {};
	},
	
	
	/**
	 * Checks whether the last sync was a failure.
	 * Uses localstorage to save some information about the sync that failed.
	 * @return false|Object
	 */
	checkDirtyFlag:function(){
		try {
			var flag = localStorage.getItem('__syncDirty');
			if (!flag) return false;
			return Ext.decode(flag);
		} catch(e) {
			console.log('Error checking __syncDirty flag: ', e);
			return false;
		}
	},
	
	
	/**
	 * Saves some information about the current sync so
	 * it can be more or less recreated later
	 */
	setDirtyFlag:function(){
		var data = {
			apiUrl:		this.getApiUrl(),
			auth:		this.getAuth(),	
			failTime:	Date.now(),
		};
		console.log('Setting sync dirty flag',data);
		
		localStorage.setItem('__syncDirty', Ext.encode(data));
	},
	
	
	/**
	 * Clears the above
	 */
	clearDirtyFlag:function(){
		localStorage.removeItem('__syncDirty');
	},
	
	
	/**
	 * Saves the current time as the last sync date
	 */
	setLastSync:function(){
		localStorage.setItem('__syncLast', Date.now());
	},
	
	
	/**
	 * @return int
	 */
	getLastSync:function(){
		var s = localStorage.getItem('__syncLast');
		var i = parseInt(s);
		return Ext.isNumber(i) ? i : 0;
	},
	
	
	/**
	 * Checks for tiny differences between our time and the server's time
	 */
	updateServerTimeOffset:function(){
		var self = this;
		this._request({
			url:	this.getServerTimeUrl(),
			params:	{},
			callback:function(data){
				var d = new Date();
				self.serverOffset = data.ok ? (data.time * 1000 - d.getTime()) : 0;
			}
		});
	},


	/**
	 * Checks how accurate the serverOffset still is (debugging function)
	 */
	checkServerTimeOffset:function(){
		var self = this;
		this._request({
			url:	this.getServerTimeUrl(),
			params:	{},
			callback:function(data){
				var d1 = self.getServerNow();
				var d2 = new Date();
				d2.setTime(data.time*1000);
			}
		});
	},
	
	
	/**
	 * Returns a date object that is the current time on the server
	 */
	getServerNow:function(){
		var d = new Date();
		d.setTime( d.getTime() + this.serverOffset );
		return d;
	},
	
	
	/**
	 * Preps the data in a model for syncing. Returns
	 * a simple hash/object of the fields.
	 *
	 * @param Ext.data.Model rec 
	 * @return object
	 */
	prepForSync:function(rec){
		var d = {};
		for (var k in rec.data) {
			if (Ext.isDate(rec.data[k])) {
				d[k] = Math.round(rec.data[k].getTime() / 1000); // convert to a standard unix timestamp
			} else {
				d[k] = rec.data[k];
			}
		}
		return d;
	},
	
	
	/**
	 * Preps data from the server to be re-inserted
	 * into the model. NOTE: Does not save the model.
	 *
	 * @param object data
	 * @param Ext.data.Model rec
	 */
	saveToModel:function(data, rec){
		for (var k in data) {
			rec.set(k, data[k]);
		}

		return rec;
	},


	/**
	 * returns a store for the given model, creating one if needed
	 * @param string modelName
	 * @return Ext.data.Store
	 */
	getStore:function(modelName) {
		if (!this._stores[modelName]) {
			console.log('Creating store for '+modelName);
			this._stores[modelName] = new Ext.data.Store({ model:modelName });
		}
		if (Ext.isString(this._stores[modelName])) this._stores[modelName] = Ext.getStore(this._stores[modelName]);
		if (this._stores[modelName].isFiltered()) this._stores[modelName].clearFilter();
		return this._stores[modelName];
	},	


	/**
	 * simple wrapper to pick b/t json and jsonp
	 */
	_request:function(options){
		var self = this;
		
		// set the url
		if (!options.url) options.url = this.getApiUrl();
		
		// wrap the callback function
		var finished = false;
		var realCallback = (typeof options.callback == 'function') ? options.callback : Ext.emptyFn;
		options.callback = function(obj, success, response) {
			// failsafe for jsonp requests
			if (finished) return;
			finished = true;
			
			if (self._useJsonp) {
				obj = success; // sencha2 seems to have changed the order?
				// jsonp requests give us the actual object
				realCallback(obj);
			} else {
				// json requests give us text that we have to decode
				var data = response.responseText && response.responseText.substr(0,1)=='{'
					? Ext.decode(response.responseText) 
					: {ok:0, statusMessage:'Server error. Please try again shortly.'};
				realCallback(data);
			}
		};
		
		// handle jsonp differently
		if (this._useJsonp) {
			setTimeout(function(){
				if (finished) return;
				finished = true;
				options.callback({ok:0, statusMessage:'Request timed out'});
			}, this.getTimeoutMin() * 60 * 1000);
			
			options.callbackKey = 'SSCB';
			Ext.util.JSONP.request(options);
		} else {
			Ext.Ajax.request(options);
		}
	}
	
});


/**
 * Represents a group of requests (or a single request)
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 7.23.12
 * @package SapphireSync
 * @subpackage Sencha2
 */
Ext.define('SapphireSync.adapter.Sencha2.Batch', {
	extend:				'Ext.Evented',
//	requires:			['SapphireSync.adapter.Sencha2.Request'],

	// !Configuration /////////////////////////////////////////
	config:{
		mask:{
			xtype:		'loadmask',
			message:	'Synchronizing...',
		},
	
		maskTpl:		'Synchronizing...<br>{pct}%',
		
		timeoutMin:		4, 			// minutes
		
		abortOnError:	false,		// when an error happens, do we go to the next request or just cancel it all?
	
		fullRefresh:	false,
		
		suppressAdapterEvents:false,	// if true, will not fire complete, success, and error events on the adapter (only on the the batch)
		
		syncAdapter:	null,
		
		/**
		 * a list of model name strings
		 */
		models:			[],
	
		/**
		 * A list of stores. If a store is not found with the same name as the model, one will be created.
		 */
		stores:			{},
		
		/**
		 * these keys will be added into all requests to the server
		 */
		auth:			{},
	},
	
	// !Member variables //////////////////////////////////////


	/**
	 * List of individual requests.
	 */
	queue:			[],
	
	isProcessing:	false,
	
	success:		true,
	
	errors:			{},
	

	// !Methods ///////////////////////////////////////////////	


/*
    constructor: function(config){
        config = config || {};
        this.initialConfig = config;
        Ext.apply(this, config);

        this.addEvents(
        	'complete',		// Fired when the batch finishes (before success or error)
        	'success',		// Fired when the batch succeed
        	'aftersingle',	// Fired when a single request has finished
        	'error',		// Fired when the batch failed
        	'after'			// Fired on success or failure after all other events have been fired
        );

        // Call our superclass constructor to complete construction process.
        SenchaSyncAdapter.Batch.superclass.constructor.call(this, config)
    },
*/


	/**
	 * Returns the mask string with the holes filled in
	 * @param completed
	 * @param total
	 */
	getMaskText:function(completed, total) {
		var pct = total==0 ? 0 : Math.round(completed * 100 / total);
		return this._maskTpl.replace('{pct}', pct);
	},


	showMask:function(){
		// display the mask if needed
		this.mask = null;
		if (this.getMask()) {
			this.mask = Ext.Viewport.add(this.getMask());

			// this is needed because sometimes prompts/alerts/etc seem to hide the mask AFTER we show it, even if we delay a few hundred ms
			// NOTE: this MAY not be needed in Sencha 2...
/*
			var myMask = this.mask;
			this.maskEnforcer = setInterval(function(){
				var els = Ext.select('.x-mask');
				if (els.getCount() == 0) {
					myMask.show(); 
				}
			}, 100);
*/
		}

		
	},
	
	
	hideMask:function(){
		if (this.mask) {
			//clearInterval(batch.maskEnforcer);
			this.mask.destroy();			
		}
	},
	
	
	updateMask:function(){
		if (this.mask) {
			var n = this.totalModels - this.queue.length;
			if (this.mask.isXType('loadmask')) {
				this.mask.setMessage(this.getMaskText(n, this.totalModels));
			} else {
				this.mask.setHtml(this.getMaskText(n, this.totalModels));
			}
		}
	},
	

	/**
	 * Sets up the queue with the request objects and starts the batch
	 */
	process:function(){
		var models = this.getModels();
		this.totalModels = models.length;

		this.showMask();
		
		// TODO: set up a fallback to fire if we take too long (>4 minutes)
/*
		setTimeout(function(){
			if (SapphireSync.lastDbSync == null && typeof(SapphireSync.onTimeout)=='function'){
				SapphireSync.onTimeout();
			}
		}, this.timeoutMin * 60 * 1000);
*/

		// create requests for each model
		for (var i = 0; i < models.length; i++) {
			var r = this.initRequest({ model: models[i] }, true);
		}
		
		this.processQueue();
	},
	

	/**
	 * Creates a new sync request, adds it to the queue,
	 * and start's processing if we're not in the middle 
	 * of another request
	 */
	initRequest:function(config, dontProcess){
		config.syncAdapter = this.getSyncAdapter();
		config.batch = this;
		if (typeof config.model == 'undefined') throw new Error("No model supplied");
		if (typeof config.auth == 'undefined') config.auth = this.getAuth();
		if (typeof config.store == 'undefined') config.store = this.getSyncAdapter().getStore(config.model);
		if (typeof config.fullRefresh == 'undefined') config.fullRefresh = this.getFullRefresh();
		var req = Ext.create('SapphireSync.adapter.Sencha2.Request', config);
		this.queue.push(req);
		if (!dontProcess) this.processQueue();
		return req;
	},
	
	
	
	/**
	 * Wipes out the queue but doesn't stop any current processing.
	 */
	clearQueue:function() {
		this.queue = [];
	},
	
	
	/**
	 * Processes the first model in the queue. 
	 */
	processQueue:function() {
		if (this.isProcessing) return null;
		if (this.queue.length == 0) return null;
		
		// update the mask if present
		this.updateMask();

		// grab the first item in the queue
		var req = this.queue.shift();
		
		// when the request is finished, clean up and start the next
		var batch = this;
		req.on('complete', function(e){
			batch.isProcessing = false;
			batch.curRequest = null;
			
			// fire the 'single' events
			batch.fireEvent('aftersingle', {success:e.success, batch:batch, request:req, msg:e.msg});
			
			if (!batch.getSuppressAdapterEvents()) batch.getSyncAdapter().fireEvent('aftersingle', {success:e.success, batch:batch, request:req, msg:e.msg});
			
			// if it was an error, clear the queue
			if (!e.success) {
				console.log('Error on '+req.getModel()+':' + e.msg);
				batch.success = false;
				batch.errors[req.getModel()] = e.msg;
				if (batch.getAbortOnError()) batch.queue.length = 0;
			}
			
			// if we're done, fire the complete/success/error events for the batch
			if (batch.queue.length == 0) {
				batch.hideMask();
				
				batch.fireEvent('complete', {success:batch.success, batch:batch, errors:batch.errors});
				batch.fireEvent(batch.success ? 'success' : 'error', {success:batch.success, batch:batch, errors:batch.errors});
				
				if (!batch.getSuppressAdapterEvents()) batch.getSyncAdapter().fireEvent('complete', {success:batch.success, batch:batch, errors:batch.errors});
				if (!batch.getSuppressAdapterEvents()) batch.getSyncAdapter().fireEvent(batch.success ? 'success' : 'error', {success:batch.success, batch:batch, errors:batch.errors});
				
				if (batch.isFirstSync) batch.getSyncAdapter().fireEvent('afterfirst', {success:batch.success, batch:batch, errors:batch.errors});
				batch.fireEvent('after', {success:batch.success, batch:batch, errors:batch.errors});
			} else {
				batch.processQueue();
			}			
		});

		// start 'er up
		this.isProcessing = true;
		this.curRequest = req;
		req.process();
		
		return req;
	}
	
	
});


/**
 * Represents a single request for a single model.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 7.23.12
 * @package SapphireSync
 * @subpackage Sencha2
 */
Ext.define('SapphireSync.adapter.Sencha2.Request', {
	extend:				'Ext.Evented',

	// !Configuration /////////////////////////////////////////
	config:{
		model:			null,
		
		store:			null,
		
		auth:			{},
	
		batch:			null,
		
		syncAdapter:	null,
		
		fullRefresh:	false,
	},

	// !Methods ///////////////////////////////////////////////	

/*
    constructor: function(config){
        config = config || {};
        this.initialConfig = config;
        Ext.apply(this, config);

        this.addEvents(
        	'complete',		// Fired when the request finishes (before success or error)
        	'success',		// Fired when the request succeed
        	'error'			// Fired when the request failed
        );

        // Call our superclass constructor to complete construction process.
        SenchaSyncAdapter.Request.superclass.constructor.call(this, config)
    },
*/
    
    
    process:function(){
    	var self = this;
    	
		// check the lock first
		console.log('Syncing '+this.getModel());
		this.getStore().load(function(recs){
			// 1. assemble a list of what we've got, including inserts
			var dataOut = Ext.apply({
				model:	self.getModel(),
				insert:	[],
				check:	[]
			}, self.auth);
			
			var deleteUs = [];
			for (var i = 0; i < recs.length; i++){
				if (recs[i].get('ID') > 0) {
					if (self.getFullRefresh()) {
						// if this is a full refresh, we delete all the records and let the server send them back to us
						deleteUs.push(recs[i]);
					} else {
						// if it's not a full refresh, we add this record to the list to be checked for freshness by the server
						dataOut.check.push({
							'ID':	recs[i].get('ID'),
							'TS':	Ext.isDate(recs[i].get('LastEdited'))  ? Math.floor(recs[i].get('LastEdited').getTime() / 1000) : 0
						});
					}
				} else {
					// if it's a new record we upload it to the server but also delete it
					// locally because the server will send a record back with an id and
					// everything OR it's a SYNC_UP in which case we don't want it hanging
					// around.
					if (typeof recs[i].beforeSyncClientInsert == 'function') rec.beforeSyncClientInsert();
					dataOut.insert.push(self.getSyncAdapter().prepForSync(recs[i]));
					deleteUs.push(recs[i]);
				}
			}
			
			// 2. send that list to the server
			dataOut.insert = Ext.encode(dataOut.insert);
			dataOut.check = Ext.encode(dataOut.check);
			
			self.getSyncAdapter()._request({
				params: dataOut,
				callback:function(data){
					if (data.ok) {
						// 3. send back any requested records
						if (data.send.length > 0) {
							var newUpdate = [];
							for (var i = 0; i < recs.length; i++){
								for (var j = 0; j < data.send.length; j++) {
									if (recs[i].get('ID') == data.send[j]) {
										if (typeof recs[i].beforeSyncClientUpdate == 'function') recs[i].beforeSyncClientUpdate();
										newUpdate.push(self.getSyncAdapter().prepForSync(recs[i]));
										break;
									}
								}
							}
							
							// send a second requect to the server
							// we don't actually update the UI or block input for this
							// request since it doesn't actually affect the client at
							// all. If it were to fail, the same records would be
							// requested by the server next time so it wouldn't matter
							self.getSyncAdapter()._request({
								params: Ext.apply({
									model:	self.getModel(),
									update: Ext.encode(newUpdate)
								}, self.auth)
							});
						}

						// 4. update anything that's changed
						if (data.update.length > 0) {
							// this is a o(n^2) process no matter what, but it's
							// safe to assume the full store will be longer than
							// the update list so we go through that list once
							// and the other list multiple times.
							for (var i = 0; i < recs.length; i++){
								for (var j = 0; j < data.update.length; j++) {
									if (recs[i].get('ID') == data.update[j].ID) {
										self.getSyncAdapter().saveToModel(data.update[j], recs[i]);
										recs[i].save();
										if (typeof recs[i].onSyncServerUpdate == 'function') recs[i].onSyncServerUpdate();
										break;
									}
								}
							}
						}

						
						// 5. delete anything the server asked us to delete
						// we also delete new records (the server will send them back with an id)
						if (data.del.length > 0) {
							//store.remove(data.del);
							// convert an array of id's into an array of records
							self.getSyncAdapter().findModelByID(self.getModel(), data.del, function(rec){
								if (typeof rec.beforeSyncDelete == 'function') rec.beforeSyncDelete();
								self.getSyncAdapter().lookup[self.getModel()][data.del] = false;
								deleteUs.push(rec);
							});
						}
						self.getStore().remove(deleteUs);
						
						// 6. insert new records from the server
						for (var i = 0; i < data.insert.length; i++) {
							var rec = Ext.ModelMgr.create({}, self.getModel());
							self.getSyncAdapter().saveToModel(data.insert[i], rec);
							rec.save();
							if (typeof rec.onSyncServerInsert == 'function') rec.onSyncServerInsert();
							self.getSyncAdapter().lookup[ self.getModel() ][ rec.get('ID') ] = rec.get('LocalID');
							self.getStore().insert(self.getStore().getCount(), rec);
						}

						// write the changes to localstorage
						self.getStore().sync();
						
						// fire our events
						self.fireEvent('complete', {success:true, msg:'Sync complete.'});
						self.fireEvent('success', {success:true, msg:'Sync complete.'});
						
						// for some reason, it doesn't seem like this always gets fired so it's safer to let one more event rip
						self.getStore().fireEvent('refresh');
					} else {
						self.fireEvent('complete', {success:false, msg:data.statusMessage});
						self.fireEvent('error', {success:false, msg:data.statusMessage});
					}
				}
			});
		});
    }

});




