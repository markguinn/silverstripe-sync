package com.adaircreative.silverstripesync;

import android.net.Uri;

/**
 * Two ways to use this:
 * 1. Use GenericSyncModel implementation class
 * 2. Have your DB contract classes implement this interface.
 * 
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 29, 2013
 * @package com.adaircreative.silverstripesync
 */
public interface SyncModelDefinition {

	public static final String REMOTE_ID = "ID";
	public static final String LAST_EDITED = "LastEdited";
	
	public String getRemoteName();
	public Uri getContentUri();
	
}
