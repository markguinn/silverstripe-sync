package com.adaircreative.silverstripesync;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * Used to configure a sync client, passed on to requests and batches.
 * 
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 23, 2013
 * @package com.adaircreative.silverstripesync
 */
public class SyncConfig implements Serializable
{
	private static final long serialVersionUID = -5404343202282701785L;

	public static final String LOG_TAG = "SilverstripeSync";
	
	public String apiUrl;
	public String serverTimeUrl;
	public Map<String,String> authenticationParams;
	public List<SyncModelDefinition> models;
	public boolean fullRefresh;
}
