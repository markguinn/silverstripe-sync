Android Client Adapter
======================

1. Install
----------
Add the com.adaircreative.silverstripesync package to your project. You'll need
to set up a content provider for your data, even if you're just using SQLite.
This is easy to do and there are lots of tutorials.


2. Add Model Definition to your DB Contract Class (or create a new class)
--------------------
The important bit is those last two methods. Putting the model list in the contract
class is not at all required. I just find it a convenient central location.
```
public class MyAppDbContract {

	public static final String AUTHORITY = "com.adaircreative.myapp.db";
	public static final Uri CONTENT_URI = Uri.parse("content://" + AUTHORITY);

	public static final SyncModelDefinition[] MODELS = {
		new BlogPost(),
		new Newsletter(),
		new NewsletterCategory(),
		new Headline(),
		new Event()
	};


	public static final class BlogPost implements BaseColumns, SyncModelDefinition {
		public static final String TABLE_NAME = "BlogPost";

		// Columns
		public static final String AUTHOR = "Author";
		public static final String BLOG_ID = "BlogID";
		public static final String CATEGORY = "Category";
		public static final String CONTENT = "Content";
		public static final String DATE = "Date";
		public static final String LINK = "Link";
		public static final String SUMMARY = "Summary";
		public static final String TITLE = "Title";

		// Content Provider details
		public static final Uri CONTENT_URI = Uri.withAppendedPath(ConstangyDbContract.CONTENT_URI, TABLE_NAME);

		// Misc
		public static final String[] PROJECTION_ALL = {_ID, REMOTE_ID, TITLE, AUTHOR, CATEGORY, DATE, LINK, SUMMARY, CONTENT};
		public static final String SORT_ORDER_DEFAULT = DATE + " DESC";

		// Sync details
		public Uri getContentUri() { return CONTENT_URI; }
		public String getRemoteName() { return TABLE_NAME; }
	}

	// ... additional model definitions here
}
```

NOTE: Your database should have an "ID" field (in addition to the usual _id primary key)
and a "LastEdited" field. *This adapter assumes your sqlite dates are unix timestamps.*



3. Create a config class
------------------------
You could do the same thing by just instantiating SyncConfig and setting properties,
but this feels better to me.
```
public class MyAppSyncConfig extends SyncConfig
{
	private static final long serialVersionUID = -4345695351693860100L;

	public MyAppSyncConfig() {
		String apiBase 		= "http://mysilverstripeinstall.com";
		this.apiUrl 		= apiBase + "/sync/default";
		this.serverTimeUrl	= apiBase + "/sync/server_time.php";
		this.models 		= Arrays.asList( MyAppDbContract.MODELS );
	}
}
```

And then let the sync adapter know about it:

```
public class MyApplication extends Application {

	@Override
	public void onCreate() {
		super.onCreate();
		SyncConfig cfg = new MyAppSyncConfig();
		SyncAdapter.setConfig(cfg);
	}

}
```



4. Set up the stub authenticator and sync adapter in xml
--------------------------------------------------------
res/xml/sync_adapter.xml
```
<?xml version="1.0" encoding="utf-8"?>
<sync-adapter
    xmlns:android="http://schemas.android.com/apk/res/android"
	android:contentAuthority="com.adaircreative.myapp.db"
	android:accountType="com.silverstripesync.public"
	android:userVisible="false"
	android:allowParallelSyncs="false"
	android:isAlwaysSyncable="true"
	android:supportsUploading="false"/>
```

res/xml/authenticator.xml
```
<?xml version="1.0" encoding="utf-8"?>
<account-authenticator
        xmlns:android="http://schemas.android.com/apk/res/android"
        android:accountType="com.silverstripesync.public"
        android:icon="@drawable/ic_launcher"
        android:smallIcon="@drawable/ic_launcher"
        android:label="@string/app_name"/>
```

NOTE: This assumes you're using the bundled stub authenticator. You may need
to build your own in which case you could plug it in there. There's not a ton
of support for extra authentication in this version of the adapter. I'd welcome
suggestions and pull requests on how that can work better.

And finally in AndroidManifest.xml (again assuming the stub authenticator):
```
	    <service
	            android:name="com.adaircreative.silverstripesync.AuthenticatorService"
	            android:exported="false">
	        <intent-filter>
	            <action android:name="android.accounts.AccountAuthenticator"/>
	        </intent-filter>
	        <meta-data
	            android:name="android.accounts.AccountAuthenticator"
	            android:resource="@xml/authenticator" />
	    </service>

		<service
            android:name="com.adaircreative.silverstripesync.SyncService"
            android:exported="true"
            android:process=":sync" >
            <intent-filter>com.example.android.datasync.provider
                <action android:name="android.content.SyncAdapter" />
            </intent-filter>

            <meta-data
                android:name="android.content.SyncAdapter"
                android:resource="@xml/sync_adapter" />
        </service>
```



5. Initiate syncing
-------------------
At this point, you should refer to the android docs. There are multiple ways to start
a sync adapter and you could use any of them. Here's how you'd do a manual sync from
an activity class:

```
class MyActivity extends Activity {

	Account mAccount = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mine);
        mAccount = CreateSyncAccount(this);
    }


    public void onSyncButtonClick(View view) {
        Bundle settingsBundle = new Bundle();
        settingsBundle.putBoolean(ContentResolver.SYNC_EXTRAS_MANUAL, true);
        settingsBundle.putBoolean(ContentResolver.SYNC_EXTRAS_EXPEDITED, true);
        ContentResolver.requestSync(mAccount, "com.adaircreative.myapp.db", settingsBundle);
    }


    /**
     * Create a new dummy account for the sync adapter
     *
     * @param context The application context
     */
    public static Account CreateSyncAccount(Context context) {
        // Create the account type and default account
        Account newAccount = new Account("mark", "com.silverstripesync.public");

        // Get an instance of the Android account manager
        AccountManager accountManager = (AccountManager) context.getSystemService(ACCOUNT_SERVICE);

        /*
         * Add the account and account type, no password or user data
         * If successful, return the Account object, otherwise report an error.
         */
        if (accountManager.addAccountExplicitly(newAccount, null, null)) {
        	return newAccount;
        } else {
        	return null;
        }
    }
}
```

