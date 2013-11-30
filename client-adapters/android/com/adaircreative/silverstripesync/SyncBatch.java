package com.adaircreative.silverstripesync;

import java.io.IOException;
import java.util.LinkedList;

import org.json.JSONException;

import android.content.ContentProviderClient;
import android.content.Context;
import android.content.Intent;
import android.content.OperationApplicationException;
import android.os.RemoteException;

/**
 * Handles a batch of models.
 * 
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 25, 2013
 * @package com.adaircreative.silverstripesync
 */
public class SyncBatch {
	private LinkedList<SyncRequest> mQueue;
	private int mTotalModels;
	private Context mContext;
	
	public static final String STATUS_UPDATE = "com.adaircreative.silverstripesync.statuschange";
	public static final String STATUS_TOTAL_MODELS = "total_models";
	public static final String STATUS_NUM_COMPLETE = "num_complete";
	public static final String STATUS_ERROR = "sync_error";
	
	/**
	 * Set up the queue and prep everything for action
	 * @param cfg
	 */
	public SyncBatch(SyncConfig cfg, Context context, ContentProviderClient provider) {
		mTotalModels = cfg.models.size();
		mQueue       = new LinkedList<SyncRequest>();
		
		// Initialize the queue
		for (SyncModelDefinition model : cfg.models) {
			mQueue.add( new SyncRequest(model, cfg, provider) );
		}
	}
	
	
	/**
	 * This actually does the work of taking each request in turn.
	 * @throws OperationApplicationException 
	 * @throws IOException 
	 * @throws JSONException 
	 * @throws RemoteException 
	 * @throws Exception 
	 */
	public void process() throws IOException, OperationApplicationException, RemoteException, JSONException {
		sendStatusUpdate();
		while (!mQueue.isEmpty()) {
			SyncRequest request = mQueue.remove();
			try {
				request.process();
				sendStatusUpdate();
			} catch (IOException e) {
				clearQueue();
				sendStatusError(e.getMessage());
				throw e;
			} catch (OperationApplicationException e) {
				clearQueue();
				sendStatusError(e.getMessage());
				throw e;
			} catch (RemoteException e) {
				clearQueue();
				sendStatusError(e.getMessage());
				throw e;
			} catch (JSONException e) {
				clearQueue();
				sendStatusError(e.getMessage());
				throw e;
			}
		}
	}
	
	/**
	 * Clear the queue in case of error (is this needed?)
	 */
	public void clearQueue() {
		while (!mQueue.isEmpty()) {
			mQueue.remove();
		}
	}
	
	/**
	 * Sends a notification to anyone who's listening in case
	 * we need to update the UI.
	 */
	private void sendStatusUpdate() {
		if (mContext != null) {
			Intent i = new Intent(STATUS_UPDATE);
			i.putExtra(STATUS_TOTAL_MODELS, mTotalModels);
			i.putExtra(STATUS_NUM_COMPLETE, mTotalModels - mQueue.size());
			mContext.sendBroadcast(i);
		}
	}
	
	/**
	 * Send a notification that indicates an error, in which we
	 * may want to clear any visual indicator
	 * @param message
	 */
	private void sendStatusError(String message) {
		if (mContext != null) {
			Intent i = new Intent(STATUS_UPDATE);
			i.putExtra(STATUS_TOTAL_MODELS, mTotalModels);
			i.putExtra(STATUS_NUM_COMPLETE, mTotalModels - mQueue.size());
			i.putExtra(STATUS_ERROR, message);
			mContext.sendBroadcast(i);
		}
	}
}
