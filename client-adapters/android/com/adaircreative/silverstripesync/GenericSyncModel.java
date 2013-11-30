package com.adaircreative.silverstripesync;

import java.io.Serializable;
import android.net.Uri;

/**
 * Defines a model definition on the server and how it maps to a database
 * table locally. I used a class here, because I can imagine putting some
 * other things here in the future. 
 *  
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 23, 2013
 * @package com.adaircreative.silverstripesync
 */
public class GenericSyncModel implements Serializable, SyncModelDefinition
{
	private static final long serialVersionUID = -3538949986321456395L;

	public String localName;
	public String remoteName;
	public Uri contentUri;
	
	public GenericSyncModel(String name, Uri uri) {
		localName  = name;
		remoteName = name;
		contentUri = uri;
	}

	public GenericSyncModel(String local, String remote, Uri uri) {
		localName  = local;
		remoteName = remote;
		contentUri = uri;
	}

	public String getRemoteName() {
		return remoteName; 
	}
	
	public Uri getContentUri() {
		return contentUri;
	}
}
