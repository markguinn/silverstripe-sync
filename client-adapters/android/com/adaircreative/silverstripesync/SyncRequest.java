package com.adaircreative.silverstripesync;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.ContentProviderClient;
import android.content.ContentProviderOperation;
import android.content.ContentValues;
import android.content.OperationApplicationException;
import android.database.Cursor;
import android.os.RemoteException;
import android.util.Log;

/**
 * Handles the work of syncing a single model.
 * 
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 25, 2013
 * @package com.adaircreative.silverstripesync
 */
public class SyncRequest {
	private SyncModelDefinition mModel;
	private SyncConfig mConfig;
	private ContentProviderClient mProvider;
	
	private static final String[] CHECK_PROJECTION = {SyncModelDefinition.REMOTE_ID, SyncModelDefinition.LAST_EDITED};
	
	public SyncRequest(SyncModelDefinition model, SyncConfig cfg, ContentProviderClient provider) {
		mModel  = model;
		mConfig = cfg;
		mProvider = provider;
	}
	
	public void process() throws IOException, OperationApplicationException, RemoteException, JSONException {
		Log.d(SyncConfig.LOG_TAG, "Syncing model " + mModel.getRemoteName());
		String body = null;
		int bodyLen = 0;
		JSONObject response = null;
		StringBuilder responseBuilder = new StringBuilder();
		HttpURLConnection conn = null;
		int numInserts = 0;
		int numDeletes = 0;
		int numUpdates = 0;
		
		try {

			// STEP 1. Assemble a list of local data to insert, check, and locally delete ::::::::::::::::::::
			JSONArray toCheck = new JSONArray();
			JSONArray toInsert = new JSONArray();
			
			// TODO - insert
			
			// Make a list of existing records and timestamps
			Cursor cursor = mProvider.query(mModel.getContentUri(), CHECK_PROJECTION, null, null, null);
			if (cursor != null) {
			    while (cursor.moveToNext()) {
			        JSONObject checkRow = new JSONObject();
			        checkRow.put("ID", cursor.getInt(0));
			        // NOTE: This assumes that you're using unix timestamp format for dates (several options for sqlite)
			        checkRow.put("TS", cursor.getInt(1));
			        toCheck.put(checkRow);
			    }
			} else {
				throw new IOException("Unable to build check table");
			}			
			
			// STEP 2. Send those lists to the server ::::::::::::::::::::::::::::::::::::::::::::::::::::::::
			URL url = new URL(mConfig.apiUrl);
			conn = (HttpURLConnection)url.openConnection();
			
			// first post param is the model
			StringBuilder params = new StringBuilder("model=");
			params.append( URLEncoder.encode(mModel.getRemoteName(), "UTF-8") );
			
			// append any authentication to the post
			if (mConfig.authenticationParams != null) {
				for (Map.Entry<String,String>entry : mConfig.authenticationParams.entrySet()) {
			        params.append("&");
			        params.append( URLEncoder.encode((String)entry.getKey(), "UTF-8") );
			        params.append("=");
			        params.append( URLEncoder.encode((String)entry.getValue(), "UTF-8") );		        
				}
			}
			
			// append the insert and check arrays
			params.append("&insert=");
			params.append( URLEncoder.encode(toInsert.toString(), "UTF-8") );
			params.append("&check=");
			params.append( URLEncoder.encode(toCheck.toString(), "UTF-8") );
			
			// send the POST 
			params.append("&date_format=U");
			body = params.toString();
			bodyLen = body.getBytes().length;
			Log.d(SyncConfig.LOG_TAG, "Sending post to " + url + ": " + body);
			
			// set up the request
			conn.setRequestMethod("POST");
			conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
			conn.setRequestProperty("Content-Length", Integer.toString(bodyLen));
			conn.setRequestProperty("charset", "utf-8");
			conn.setUseCaches(false);
		    conn.setDoInput(true);
		    conn.setDoOutput(true);
		    conn.setFixedLengthStreamingMode(bodyLen);
		    
		    // send request
		    DataOutputStream wr = new DataOutputStream(conn.getOutputStream());
		    wr.writeBytes(body);
		    wr.flush();
		    wr.close();
		    
		    // download the response
		    InputStream is = conn.getInputStream();
		    BufferedReader rd = new BufferedReader(new InputStreamReader(is));
		    String line;		     
		    while ((line = rd.readLine()) != null) {
		    	responseBuilder.append(line);
		    	responseBuilder.append("\n");
		    }
		    rd.close();
		    
		    // convert to JSON
		    response = new JSONObject(responseBuilder.toString());
			Log.d(SyncConfig.LOG_TAG, "Got response: " + response.toString(3));

			if (response.getInt("ok") != 1) {
				throw new IOException(response.getString("statusMessage"));
			}
			
			// STEP 3. Send back any requested records :::::::::::::::::::::::::::::::::::::::::::::::::::::::
			// TODO
			
			// STEP 4. Update anything that's changed ::::::::::::::::::::::::::::::::::::::::::::::::::::::::
			JSONArray serverUpdates = response.optJSONArray("update"); 
			if (serverUpdates != null && serverUpdates.length() > 0) {
				int length = serverUpdates.length();
				ArrayList<ContentProviderOperation> ops = new ArrayList<ContentProviderOperation>(length);
				
				for (int i = 0; i < length; i++) {
					JSONObject rec = serverUpdates.getJSONObject(i);
					int remoteID = rec.getInt(SyncModelDefinition.REMOTE_ID);
					ContentValues vals = fillValuesFromRemote(rec);

					Log.d(SyncConfig.LOG_TAG, "Updating #"+remoteID+" url="+mModel.getContentUri());
					ContentProviderOperation op = ContentProviderOperation.newUpdate( mModel.getContentUri() )
							.withSelection(SyncModelDefinition.REMOTE_ID + " = ?", new String[] { String.valueOf(remoteID) })
							.withValues(vals)
							.build();
					ops.add(op);
					numUpdates++;
				}

				mProvider.applyBatch(ops);
			}
			
			// STEP 5. Delete anything the server asked us to delete :::::::::::::::::::::::::::::::::::::::::
			JSONArray serverDeletes = response.optJSONArray("delete"); 
			if (serverDeletes != null && serverDeletes.length() > 0) {
				int length = serverDeletes.length();
				ArrayList<ContentProviderOperation> ops = new ArrayList<ContentProviderOperation>(length);
				
				for (int i = 0; i < length; i++) {
					int remoteID = serverDeletes.getInt(i);
					Log.d(SyncConfig.LOG_TAG, "Deleting #"+remoteID);
					ContentProviderOperation op = ContentProviderOperation.newDelete( mModel.getContentUri() )
							.withSelection(SyncModelDefinition.REMOTE_ID + " = ?", new String[] { String.valueOf(remoteID) })
							.build();
					ops.add(op);
					numDeletes++;
				}

				mProvider.applyBatch(ops);
			}
			
			// STEP 6. Insert new records from the server ::::::::::::::::::::::::::::::::::::::::::::::::::::
			JSONArray serverInserts = response.optJSONArray("insert");			
			if (serverInserts != null && serverInserts.length() > 0) {
				int length = serverInserts.length();
				ArrayList<ContentProviderOperation> ops = new ArrayList<ContentProviderOperation>(length);
				
				for (int i = 0; i < length; i++) {
					JSONObject rec = serverInserts.getJSONObject(i);
					ContentValues vals = fillValuesFromRemote(rec);

					Log.d(SyncConfig.LOG_TAG, "Inserting #"+rec.getInt(SyncModelDefinition.REMOTE_ID));
					ContentProviderOperation op = ContentProviderOperation.newInsert( mModel.getContentUri() )
							.withValues(vals)
							.build();
					ops.add(op);
					numInserts++;
				}

				mProvider.applyBatch(ops);
			}
			
			Log.i(SyncConfig.LOG_TAG, "Sync request complete for model: "+mModel.getRemoteName()
					+" - inserts:"+numInserts
					+", updates:"+numUpdates
					+", deletes:"+numDeletes);
		} catch (IOException e) {
			Log.e(SyncConfig.LOG_TAG, "Error for model " + mModel.getRemoteName() 
					+ "\nPost data: " + body 
					+ "\nError: " + e.getMessage());
			if (conn != null) conn.disconnect();
			throw e;
		} catch (OperationApplicationException e) {
			Log.e(SyncConfig.LOG_TAG, "Error for model " + mModel.getRemoteName() 
					+ "\nPost data: " + body 
					+ "\nError: " + e.getMessage());
			if (conn != null) conn.disconnect();
			throw e;
		} catch (RemoteException e) {
			// This shouldn't generally happen since we're going to be using Sqlite almost always
			Log.e(SyncConfig.LOG_TAG, "Error for model " + mModel.getRemoteName() 
					+ "\nPost data: " + body 
					+ "\nResponse: " + responseBuilder.toString() 
					+ "\nError: " + e.getMessage());
			if (conn != null) conn.disconnect();
			throw e;
		} catch (JSONException e) {
			Log.e(SyncConfig.LOG_TAG, "JSON Error for model " + mModel.getRemoteName() 
					+ "\nPost data: " + body 
					+ "\nResponse: " + responseBuilder.toString() 
					+ "\nError: " + e.getMessage());
			if (conn != null) conn.disconnect();
			throw e;
		}
	}
	

	/**
	 * Fills a contentValues object that can be used for insert or update.
	 * Also handles transforming data as appropriate (primarily date/time).
	 * This generic version assumes everything except ID and LastEdited
	 * is a string.
	 * 
	 * @param rec
	 * @return
	 */
	private ContentValues fillValuesFromRemote(JSONObject rec) {
		// If the model definition includes mapping, use that
		if (mModel instanceof SyncModelMapper) {
			return ((SyncModelMapper) mModel).fillValuesFromRemote(rec);
		}
		
		// Otherwise just fill it in with the basic types
		ContentValues vals = new ContentValues(rec.length());
		Iterator<?> keys = rec.keys();
		
        while( keys.hasNext() ){
    		try {
	            String key = (String)keys.next();
	            Object val = rec.get(key);

	            // awkward type mapping...
	            // technically these are the only options other than array or object, which would be an error anyway
	            if (val instanceof String) {
	            	String str = (String)val;
	            	if (str.matches("^\\d+$")) {
	            		vals.put(key, Integer.valueOf(str));
	            	} else {
	            		vals.put(key, str);
	            	}
	            } else if (val instanceof Boolean) {
	            	vals.put(key, (Boolean)val);
	            } else if (val instanceof Integer) {
	            	vals.put(key, (Integer)val);
	            } else if (val instanceof Long) {
	            	vals.put(key, (Long)val);
	            } else if (val instanceof Double) {
	            	vals.put(key, (Double)val);
	            } else {
	            	vals.putNull(key);
	            }
			} catch(JSONException e) {
				Log.e(SyncConfig.LOG_TAG, e.getMessage());
			}
        }
		
		return vals;
	}

}
