/**
 * Sync adapter for Sencha Touch / ExtJS 4.
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
 * Sencha to use the same ID as Sapphire. It keeps wanting to overrite
 * plus, you've got to find a way for autonumber fields to work right.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 8.15.11
 * @package sync
 */

var SapphireSync = {

	// !Configuration /////////////////////////////////////////
	
	showMask: 		true,
	
	timeoutMin:		4, // minutes
	
	apiUrl:			'/sync',
	
	/**
	 * a list of model name strings
	 */
	models:			[],
	
	/**
	 * these keys will be added into all requests to the server
	 */
	auth:			{},


	/**
	 * What happens when the request times out.
	 */
	onTimeout: function(){
		document.location.reload();
	},


	// !Member variables //////////////////////////////////////


	/**
	 * serves as a lock
	 */
	lastDbSync: 	null,


	// !Methods ///////////////////////////////////////////////	
	
	
	/**
	 * syncronises models with the server
	 */
	allModels:function(doFullRefresh, onComplete){
		this.lastDbSync = null; // acts as a lock
		var mask = null;
		if (this.showMask) {
			mask = new Ext.LoadMask(Ext.getBody(), {msg:"Synchronizing database..."});
			mask.show();
		}
		
		// make a list of models to sync
		// needs to be a copy so we can pop off it
		var toSync = [];
		if (Ext.isArray(this.models)){
			for (var i = 0; i < this.models.length; i++){
				// is it a list of string model names?
				toSync.push(this.models[i]);
			}
		} else {
			for (var k in this.models) {
				// or a hash of model objects?
				toSync.push(k);
			}
		}
		
		// set up a fallback to reset the kiosk if we take too long (>4 minutes)
		setTimeout(function(){
			if (SapphireSync.lastDbSync == null && typeof(SapphireSync.onTimeout)=='function'){
				SapphireSync.onTimeout();
			}
		}, this.timeoutMin * 60 * 1000);

/*
This would be cool to build in, but for now we'll leave it up to the app.
		// do we need a full reboot or just a simple update?
		// this seems a bit counterintuitive, but the MVK version
		// is fresh from the server and the localstorage version
		// could be behind if we changed fields on a model or
		// something. So if that version gets incremented, we
		// go ahead and send any pending inserts but then wipe
		// the table and download all the records again.
		var myDB = parseInt(localStorage.getItem('KioskDBVersion'));
		var doFullRefresh = (myDB < MVK.dbVersion);

		// save the new version to the local db
		localStorage.setItem('KioskDBVersion', MVK.dbVersion);
*/
		
		// in a slightly convoluted way (because it's all asyncronous)
		// go through each model and sync it. this uses a few more
		// requests - we might be able to do them all at once if we
		// did some work on that - but this is simpler for now
		var curModel;
		var doIt = function(){
			if (toSync.length > 0) {
				curModel = toSync.pop();
				SapphireSync.singleModel(curModel, doIt, doFullRefresh);
			} else {
				if (mask) mask.hide();
				SapphireSync.lastDbSync = new Date();
				
				if (typeof onComplete == 'function') {
					onComplete();
				}
			}
		};
		
		doIt();
	},
	
	
	/**
	 * syncronises a single model (see docblock in APIKiosk::sync() for a full explanation)
	 */
	singleModel:function(modelName, onComplete, isFullRefresh){
		var store = new Ext.data.Store({ model:modelName });
		store.load(function(recs){
			// 1. assemble a list of what we've got, including inserts
			var dataOut = Ext.apply({
				model:	modelName,
				insert:	[],
				check:	[]
			}, SapphireSync.auth);
			
			var deleteUs = [];
			for (var i = 0; i < recs.length; i++){
				if (recs[i].get('ID') > 0) {
					if (isFullRefresh) {
						// if this is a full refresh, we delete all the records and let the server send them back to us
						deleteUs.push(recs[i]);
					} else {
						// if it's not a full refresh, we add this record to the list to be checked for freshness by the server
						dataOut.check.push({
							'ID':	recs[i].get('ID'),
							'TS':	recs[i].get('LastEdited') ? recs[i].get('LastEdited').format('U') : 0
						});
					}
				} else {
					// if it's a new record we upload it to the server but also delete it
					// locally because the server will send a record back with an id and
					// everything
					dataOut.insert.push(recs[i].data);
					deleteUs.push(recs[i]);
				}
			}
			
			// 2. send that list to the server
			dataOut.insert = Ext.encode(dataOut.insert);
			dataOut.check = Ext.encode(dataOut.check);
			
			Ext.Ajax.request({
				url:	SapphireSync.apiUrl,
				params: dataOut,
		
				success:function(response,opts){
					var data = response.responseText && response.responseText.substr(0,1)=='{'
						? Ext.decode(response.responseText) 
						: {ok:0, statusMessage:'Server error. Please try again shortly.'};
		
					if (data.ok) {
						// 3. send back any requested records
						if (data.send.length > 0) {
							var newUpdate = [];
							for (var i = 0; i < recs.length; i++){
								for (var j = 0; j < data.send.length; j++) {
									if (recs[i].get('ID') == data.send[j]) {
										newUpdate.push(recs[i].data);
										break;
									}
								}
							}
							
							// send a second requect to the server
							// we don't actually update the UI or block input for this
							// request since it doesn't actually affect the client at
							// all. If it were to fail, the same records would be
							// requested by the server next time so it wouldn't matter
							Ext.Ajax.request({
								url:	SapphireSync.apiUrl,
								params: Ext.apply({
									model:	modelName,
									fields: dataOut.fields,
									update: Ext.encode(newUpdate)
								}, SapphireSync.auth)
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
										// if the id's match, copy in the fields
										for (var k in data.update[j]) {
											recs[i].set(k, data.update[j][k]);
										}
										
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
							SapphireSync._findModelByID(modelName, data.del, function(rec){
								deleteUs.push(rec);
							});
						}
						store.remove(deleteUs);
						
						// 6. insert new records from the server
						for (var i = 0; i < data.insert.length; i++) {
							store.add(data.insert[i]);
						}

						// write the changes to localstorage						
						store.sync();
					} else {
						alert('Sync error on '+modelName+': '+data.statusMessage);
					}

					onComplete();
				},
		
				failure:function(response){
					alert('Sync error on '+modelName+': '+(response.responseText ? response.responseText : 'Communications Error'));
					onComplete();
				}
			});
		});
	},
	
	
	/**
	 * Looks up a model by the remote ID rather than the local ID
	 * This could be a non-trivial process as you have to actually
	 * loop through every record.
	 * @param string modelName
	 * @param int id
	 * @param function onSuccess [optional]
	 * @param function onFailure [optional]
	 */
	_findModelByID: function(modelName, id, onSuccess, onFailure){
		if (typeof onFailure != 'function') onFailure = function(){};
		
		var store = new Ext.data.Store({model:modelName});
		store.load(function(recs,op,success){
			if (!success) onFailure('Error loading records');
			for (var i = 0; i < recs.length; i++) {
				if (Ext.isArray(id)) {
					// if it's an array, we call onsuccess a bunch of times
					for (var j = 0; j < id.length; j++) {
						if (recs[i].get('ID') == id[j]) {
							onSuccess(recs[i]);
							break;
						}
					}
				} else {
					if (recs[i].get('ID') == id) {
						onSuccess(recs[i]);
						return;
					}
				}
			}
		
			onFailure('Not found');
		});
	}
	
};
