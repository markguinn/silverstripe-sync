<?php
/**
 * How this works:
 *  1. Client sends a list of new records (insert) and the ID and LastEdited timestamp of each existing record (check)
 *  2. Server compares the "check" list with the db and generates 4 lists which it sends back to the client:
 *		a. send - records that appear to be newer on the client, so we're requesting the client hit us back with the full record
 *		b. insert - records that have been created on the server but weren't in the "check" list, so the client needs to add
 *		c. update - records that appear to be newer on the server, so the client needs to update
 *		d. delete - records that are in the "check" list with an ID but not present on the server. The ID means they have
 *					already been added to the server at one time, so odds are they've been deleted. Client should follow suit.
 *	3. If the server's "send" list contained any ID's, the client sends another request, this time with only the update list
 *		populated.
 *
 * Cases this doesn't cover:
 *	- deleting on the client (I can't think of a case this is needed on the kiosk)
 *	- merging changes if a record were modified in both places (again, I don't think there's a use case on the kiosk)
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 8.15.11
 * @package SapphireSync
 */
class SyncController extends Controller {
	static $url_segment = 'sync';
	static $allow_jsonp = true;
	
	/**
	 * Handles all contexts
	 * !TODO - handle more than one model in one request
	 *
	 * @param SS_HTTPRequest $req
	 * @return SS_HTTPResponse
	 */
	public function index($req) {
		$model	= $req->requestVar('model');
		if (!$model) return $this->fail(400);
		
		// find the configuration
		$context = SyncContext::current();
		if (!$context) return $this->fail(400);
		$cfg = $context->getConfig($model);
		
		// is syncing this model allowed?
		if (!$cfg 
			|| !is_array($cfg) 
			|| !isset($cfg['type']) 
			|| $cfg['type'] == SYNC_NONE
			) return $this->fail(403, 'Access denied');
			
		$fields = isset($cfg['fields']) 
			? explode(',', $cfg['fields']) 
			: array_keys(singleton($model)->db());
		if (count($fields) == 0) return $this->fail(403, 'Access denied');
		
		// do we need to swap out for a parent table or anything?
		if (isset($cfg['model'])) $model = $cfg['model'];
		
		// build up the rest of the config with defaults
		if (!isset($cfg['filter'])) $cfg['filter'] = '';
		if (!isset($cfg['join'])) $cfg['join'] = '';
		
		// check authentication
		if (!$context->checkAuth($req->requestVars())) return $this->fail(403, 'Incorrect or invalid authentication');
		
		// fill in any blanks in the filters based on the request input
		$replacements = $context->getFilterVariables($req->requestVars());
		$cfg['filter'] = str_replace(array_keys($replacements), array_values($replacements), $cfg['filter']);
		//Debug::log("replacing:".print_r($replacements,true).print_r($cfg,true));
		
		// input arrays
		$insert	= $req->requestVar('insert')	? json_decode($req->requestVar('insert'), true)	: array();
		$check	= $req->requestVar('check')		? json_decode($req->requestVar('check'), true)	: array();
		$update	= $req->requestVar('update')	? json_decode($req->requestVar('update'), true)	: array();		
		
		// output arrays
		$clientSend = array();
		$clientInsert = array();
		$clientUpdate = array();
		$clientDelete = array();
		
		// check modification times on any existing records
		// NOTE: if update is set we assume this is the second request (#3 above)
		if (count($update) == 0) {
			if ($cfg['type'] == SYNC_DOWN || $cfg['type'] == SYNC_FULL) {
				$do = singleton($model);
				//$query = new SQLQuery('ID, unix_timestamp(LastEdited) as TS', $do->baseTable(), "`ClassName` = '" . Convert::raw2sql($model) . "'");
				$query = $do->extendedSQL($cfg['filter'], '', '', $cfg['join'])
							->select("`{$do->baseTable()}`.`ID`, unix_timestamp(`{$do->baseTable()}`.`LastEdited`) as `TS`");
				$result = $query->execute();
				$map = array();
				foreach ($result as $row){
					$map[ $row['ID'] ] = $row['TS'];
				}
				
				// take out the id's that are up-to-date form the map
				// also add any inserts and deletes at this point
				foreach ($check as $rec) {
					if (isset($map[ $rec['ID'] ])) {
						$serverTS = $map[ $rec['ID'] ];
						$clientTS = max($rec['TS'], 0);
		
						if ($serverTS > $clientTS) {
							// the server is newer than the client
							// mark it to be sent back as a clientUpdate
							$clientUpdate[] = $rec['ID'];
						} elseif ($clientTS > $serverTS) {
							// the version on the client is newer than the server
							// add it to the clientSend list (i.e. request the data back from the client)
							$clientSend[] = $rec['ID'];
						} else {
							// the versions are the same, leave well enough alone
						}
	
						// $map is now our insert list, so we remove this id from it
						unset($map[ $rec['ID'] ]);
					} else {
						// if it's present on the client WITH an ID but not present
						// on the server, it means we've deleted it and need to notify
						// the client
						$clientDelete[] = $rec['ID'];			
					}
				}
				
				// anything left on the $map right now needs to be inserted
				if (count($map) > 0) {
					$set = DataObject::get($model, '"' . $do->baseTable() . '"."ID" in (' . implode(',', array_keys($map)) . ')');
					foreach ($set as $obj) {
						$clientInsert[] = $this->listFields($obj, $fields);
					}
				}
	
				// anything in the clientUpdate list right now need to be fleshed out to full records
				if (count($clientUpdate) > 0) {
					$set = DataObject::get($model, '"' . $do->baseTable() . '"."ID" in (' . implode(',', $clientUpdate) . ')');
					foreach ($set as $obj) {
						$clientUpdate[] = $this->listFields($obj, $fields);
					}
				}
			}
			
			// insert any new records
			// !todo: make sure only the allowed fields can be changed				
			if ($cfg['type'] == SYNC_FULL || $cfg['type'] == SYNC_UP) {
				foreach ($insert as $rec) {
					unset($rec['ID']);
					unset($rec['LocalID']);
					$obj = new $model();
					$obj->castedUpdate($rec);
					$obj->write();
					// send the object back so it gets an id, etc
					$clientInsert[] = $this->listFields($obj, $fields);
				}
			}
		} else {
			if ($cfg['type'] == SYNC_FULL || $cfg['type'] == SYNC_UP) {
				// update records
				// !todo: make sure only the allowed fields can be changed				
				foreach ($update as $rec) {
					$obj = DataObject::get_by_id($model, $rec['ID']);
					unset($rec['ID']);
					unset($rec['LocalID']);
					unset($rec['ClassName']);
					$obj->castedUpdate($rec);
					$obj->write();
								
				}
			}
		}
		
		// respond
		return $this->respond(array(
			'ok'		=> 1,
			'send'		=> $clientSend,		// here we're asking for a response with records for us to update for these id's
			'update'	=> $clientUpdate,	// here we're asking for the client to update it's own records
			'insert'	=> $clientInsert,
			'del'		=> $clientDelete,
		));
	}


	/**
	 * @param int $code
	 * @param string $message
	 * @return SS_HTTPResponse
	 */
	protected function fail($code=400, $message='') {
// 		NOTE: we can't really use HTTP status codes with JSONP, as cool as that was
//		return new SS_HTTPResponse($message, $code);
		return $this->respond(array(
			'ok' 			=> 0,
			'statusMessage' => $message,
			'statusCode'	=> $code
		));
	}
	

	/**
	 * shortcut to correctly return json
	 * Usage: return $this->respond($data); for json
	 *
	 * @param array $data
	 * @param int $code [optional]
	 * @return string
	 */
	protected function respond(array $data,$code=200) {
		// default is a simple json response
		$content = json_encode($data);
		$type = 'application/json';
		
		// modify for jsonp if needed
		if (self::$allow_jsonp && $this->getRequest()->getVar('SSCB')) {
			$type = 'text/javascript';
			$content = $this->getRequest()->getVar('SSCB') . '(' . $content . ');';
		}
		
		// send it
		$response = new SS_HTTPResponse($content, $code);
		$response->addHeader('Content-type', $type);
		return $response;
	}


	/**
	 * Given a dataobject, returns an array with the values of fields for that
	 * record. Optionally gives you the ability to limit which fields are returned
	 * and/or use dot notation or rename fields.
	 *
	 * @Example:
	 * $this->listFields($obj,'Name as name','mPlan.ID as id','mPlan.Owner as entity.Name as name');
	 * Will return:
	 * array(
	 * 		'name'=>'Some Question',
	 * 		'mPlan'=>array(
	 * 			'id'=>1,
	 * 			'entity'=>array(
	 * 				'name'=>'WalMart'
	 * 			)
	 * 		)
	 * };
	 */
	protected function listFields($obj, $fieldList=array()) {
		if (count($fieldList)) {
			$fields = array();
			foreach ($fieldList as $fname) {
				if ($fname == 'LocalID') continue;
				$DotExplode = explode('.',$fname,2);
				if (count($DotExplode) == 2) {
					list($key,$fName) = $DotExplode;
					$name=$key;
					$IDfield = $key.'ID';
					$asExplode = explode(' as ',$key,2); // e.g. Created as StartTime will pull "Created" but label it as "StartTime"
					if (count($asExplode) != 2) $asExplode = explode(' AS ',$key,2);
					if (count($asExplode) == 2) {
						list($key,$name) = $asExplode;
					}
					$recurseFields = ($obj->$IDfield || method_exists($obj,$key)) ? $this->listFields($obj->$key(),array($fName)) : null;
					if (isset($fields[$name])) {
						if (is_array($fields[$name])) {
							if (count($recurseFields) === 1 && is_string(key($recurseFields)) && !isset($fields[$name][key($recurseFields)])) {
								$fields[$name][key($recurseFields)] = reset($recurseFields);
							} else {
								$fields[$name][] = $recurseFields;
							}
						} else {
							$fields[$name] = array($fields[$name],$recurseFields);
						}
					} else {
						$fields[$name] = $recurseFields;
					}
				} else {
					$asExplode = explode(' as ',$fname,2); // e.g. Created as StartTime will pull "Created" but label it as "StartTime"
					if (count($asExplode) != 2) $asExplode = explode(' AS ',$fname,2);
					if (count($asExplode) == 2) {
						list($fname,$key) = $asExplode;
					} else {
						$key = $fname;
					}
					$IDfield = $fname.'ID';
					if (!$obj->$fname && $obj->$IDfield) {
						$fields[$key] = $this->listFields($obj->$fname()); // since $obj is a dataobject/viewabledata this covers methods too
					} else {
						$fields[$key] = $obj->$fname; // since $obj is a dataobject/viewabledata this covers methods too
					}
				}
			}
		} else {
			$fields = $obj->getAllFields();
		}

		return $fields;
	}


}