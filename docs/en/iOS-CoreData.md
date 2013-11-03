iOS Client Adapter
==================

1. Install client adapter files
-------------------------------
Copy the files into your XCode project. Anywhere will do.


2. Set up data model
--------------------
Fields should have the same name and type as Silverstripe with the following exceptions:
- First letter must be lowercase (Xcode's rules not mine)
- ID maps to "remoteID"
- remoteID and lastEdited fields must exist
- use the built in "date" type for dates


3. Add some initialization code to AppDelegate
----------------------------------------------
AppDelete.h:
```
#import <UIKit/UIKit.h>
#import "SyncDelegate.h"

@class SyncClient;

@interface AppDelegate : UIResponder <UIApplicationDelegate, SyncDelegate>

@property (strong, nonatomic) UIWindow *window;
@property (strong, nonatomic) SyncClient *sync;

- (NSURL *)applicationDocumentsDirectory;
- (void)syncBatchDidFail:(id)sender withErrors:(NSDictionary*)errors;

@end
```

AppDelegate.m:
```
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
	// ... other setup would happen here

	// set up Silverstripe Sync
    SyncConfig *cfg = [[SyncConfig alloc] init];

    NSString *apiBase = @"http://mysilverstripeinstall.com";
    cfg.apiUrl			= [apiBase stringByAppendingString:@"/sync/default"];
    cfg.serverTimeUrl	= [apiBase stringByAppendingString:@"/sync/server_time.php"];
    cfg.indicator		= [[MTStatusBarIndicator alloc] init];
	cfg.maskTpl			= @"Updating...%d%%";
    cfg.context			= [NSManagedObjectContext defaultContext];

    cfg.models = @[
		@"Blog",
		@"BlogPost",
		@"Newsletter",
		@"NewsletterCategory",
		@"Headline",
		@"Event",
	];

    self.sync = [[SyncClient alloc] initWithConfig:cfg];
    self.sync.delegate = self;
}

- (void)applicationDidBecomeActive:(UIApplication *)application
{
    [self.sync createBatch:NULL];
}

#pragma mark - Sync delegate
- (void)syncBatchDidFail:(id)sender withErrors:(NSDictionary*)errors
{
    UIAlertView *alert = [[UIAlertView alloc] initWithTitle:@"Connection Problem"
                                                    message:@"There was a problem updating the app content. Please ensure you have a working data or wifi connection and open the app again. Any previously downloaded content is still available to view while you're offline."
                                                   delegate:nil
                                          cancelButtonTitle:@"OK"
                                          otherButtonTitles:nil];
    [alert show];
}
```

NOTE: This will cause data to sync whenever the app starts or returns from the background.
You can force it to sync at any time (on button press, on a timer, push notification, etc)
with this call: `[self.sync createBatch:NULL];`

