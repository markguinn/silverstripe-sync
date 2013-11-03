package com.adaircreative.silverstripesync;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/**
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 24, 2013
 * @package com.adaircreative.silverstripesync
 */
public class SyncService extends Service {

    private static final Object sSyncAdapterLock = new Object();
    private static SyncAdapter sSyncAdapter = null;
 
    @Override
    public void onCreate() {
        synchronized (sSyncAdapterLock) {
            if (sSyncAdapter == null)
                sSyncAdapter = new SyncAdapter(getApplicationContext(), true);
        }
    }
 
    @Override
    public IBinder onBind(Intent intent) {
        return sSyncAdapter.getSyncAdapterBinder();
    }
}
