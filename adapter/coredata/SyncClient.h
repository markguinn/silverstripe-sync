//
//  SyncClient.h
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "SyncConfig.h"
#import "SyncBatch.h"
#import "SyncDelegate.h"

@interface SyncClient : NSObject <SyncDelegate>

@property (weak) id <SyncDelegate> delegate;
@property (strong) SyncConfig *config;
@property BOOL isProcessing;


/** 
 * Initializes the object with a configuration class 
 */
- (id)initWithConfig:(SyncConfig*)cfg;

/** 
 * Creates a new batch, adds it to the queue, and starts it if we're not in the 
 * middle of something already.
 * @param cfg - optionally used to override global cfg settings 
 */
- (SyncBatch*)createBatch:(SyncConfig*)cfg;

/** 
 * Creates a new batch, adds it to the queue, and starts it if we're not in the 
 * middle of something already.
 * @param cfg - optionally used to override global cfg settings 
 * @param delegate - if present, the batch will notify it on success, failure, and completion
 */
- (SyncBatch*)createBatch:(SyncConfig*)cfg 
             withDelegate:(id)del;

/**
 * Queue management methods. Not needed in normal use.
 */
- (void)clearQueue;
- (SyncBatch*)processQueue;

/**
 * @param modelName
 * @param remoteID
 */
- (NSManagedObject*)findModel:(NSString*)modelName 
       byID:(int)remoteID;

/**
 * This flag is set when a sync fails.
 * The idea is that an app can clear the flag after
 * a successful and complete sync, and then check
 * the flag before doing anything destructive that
 * might cause data loss if there's unsynced data.
 * Setting the flag happens automatically. Clearing
 * it is up to the app.
 */
- (BOOL)checkDirtyFlag;
- (void)setDirtyFlag;
- (void)clearDirtyFlag;

- (NSDate*)getLastSync;

- (void)savePersistedData;
- (void)loadPersistedData;

/**
 * Because this system requires the LastEdited
 * dates to be reasonably close, we request the
 * server time and remember the difference between
 * local and server time.
 */
- (void)updateServerTimeOffset;

/**
 * Gets the estimated current time on the server
 * using the current local time and the server time
 * offset.
 */
- (NSDate*)getServerNow;


- (void)syncBatchDidFinish:(id)sender withErrors:(NSDictionary*)errors;


@end

