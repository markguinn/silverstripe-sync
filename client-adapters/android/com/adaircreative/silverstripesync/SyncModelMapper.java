package com.adaircreative.silverstripesync;

import org.json.JSONObject;
import android.content.ContentValues;

/**
 * If a model definition implements this interface it means it wants
 * to have control over how the fields are mapped from json to the
 * ContentValues object for insert/update on the content provider.
 * 
 * @author Mark Guinn <mark@adaircreative.com>
 * @date Oct 29, 2013
 * @package com.adaircreative.silverstripesync
 */
public interface SyncModelMapper {

	public ContentValues fillValuesFromRemote(JSONObject rec);
	
}
