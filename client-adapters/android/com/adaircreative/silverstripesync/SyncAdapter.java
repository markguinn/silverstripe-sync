package com.adaircreative.silverstripesync;

import java.io.IOException;

import org.json.JSONException;

import android.accounts.Account;
import android.content.AbstractThreadedSyncAdapter;
import android.content.ContentProviderClient;
import android.content.Context;
import android.content.OperationApplicationException;
import android.content.SyncResult;
import android.net.ParseException;
import android.os.Bundle;
import android.os.RemoteException;
import android.util.Log;

/**
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 24, 2013
 * @package com.adaircreative.silverstripesync
 */
public class SyncAdapter extends AbstractThreadedSyncAdapter {
	
	private static SyncConfig sConfig = null;
	private Context mContext;
	
	/**
	 * Initialize the adapter
	 * @param context
	 * @param autoInitialize
	 */
	public SyncAdapter(Context context, boolean autoInitialize) {
		super(context, autoInitialize);
		mContext = context;
	}

	/**
	 * Initialize the adapter
	 * @param context
	 * @param autoInitialize
	 */
	public SyncAdapter(Context context, boolean autoInitialize, boolean allowParallelSyncs) {
		super(context, autoInitialize, allowParallelSyncs);
		mContext = context;
	}
	
	/**
	 * @param cfg
	 */
	public static void setConfig(SyncConfig cfg) {
		sConfig = cfg;
	}
	
	/**
	 * @return 
	 */
	public static SyncConfig getConfig() {
		return sConfig;
	}
	
	@Override
	public void onPerformSync(Account account, Bundle extras, String authority, 
			ContentProviderClient provider, SyncResult syncResult) {
		Log.d("constangy", "Performing data sync.");
		try {
			
			if (sConfig == null) throw new IOException("Configuration has not been set.");
			SyncBatch batch = new SyncBatch(sConfig, mContext, provider);
			batch.process();
			
//		} catch (final AuthenticatorException e) {
//			syncResult.stats.numParseExceptions++;
//			Log.e(SyncConfig.LOG_TAG, "AuthenticatorException", e);
//		} catch (final OperationCanceledException e) {
//			Log.e(SyncConfig.LOG_TAG, "OperationCanceledExcetpion", e);
//			} catch (final AuthenticationException e) {
//			syncResult.stats.numAuthExceptions++;
//			Log.e(SyncConfig.LOG_TAG, "AuthenticationException", e);
		} catch (final IOException e) {
			Log.e(SyncConfig.LOG_TAG, "IOException", e);
			syncResult.stats.numIoExceptions++;
		} catch (final ParseException e) {
			syncResult.stats.numParseExceptions++;
			Log.e(SyncConfig.LOG_TAG, "ParseException", e);
		} catch (final JSONException e) {
			syncResult.stats.numParseExceptions++;
			Log.e(SyncConfig.LOG_TAG, "JSONException", e);
		} catch (RemoteException e) {
			Log.e(SyncConfig.LOG_TAG, "RemoteException", e);
			syncResult.stats.numIoExceptions++;
		} catch (OperationApplicationException e) {
			Log.e(SyncConfig.LOG_TAG, "OperationApplicationException", e);
			syncResult.stats.numIoExceptions++;
		}	
	}
}
