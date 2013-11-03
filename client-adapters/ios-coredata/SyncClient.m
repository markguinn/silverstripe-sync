//
//  SyncClient.m
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

// !TODO - check for method on models to map field names, possibly allowing a global map too (ID => remoteID, etc)

#import "SyncClient.h"
#import "NSMutableArray+QueueAdditions.h"

@implementation SyncClient
{
    int _serverOffset;
    NSMutableArray *_queue;
    NSMutableDictionary *_persistedData;
}

@synthesize config;
@synthesize isProcessing;
@synthesize delegate;


- (id)initWithConfig:(SyncConfig *)cfg
{
    if ((self = [super init])) {
        self.config = cfg;
        self.isProcessing = NO;
        [self loadPersistedData];
        _queue = [[NSMutableArray alloc] initWithCapacity:3]; // likelihood is we'll never need more than 3
        _serverOffset = 0;
        if (cfg.indicator != nil && cfg.maskTpl == nil) cfg.maskTpl = @"Synchronizing...%d%%";
    }
    return self;
}


/** 
 * Creates a new batch, adds it to the queue, and starts it if we're not in the 
 * middle of something already.
 * @param cfg - optionally used to override global cfg settings 
 */
- (SyncBatch*)createBatch:(SyncConfig*)cfg
{
    return [self createBatch:cfg 
                withDelegate:NULL];
}


/** 
 * Creates a new batch, adds it to the queue, and starts it if we're not in the 
 * middle of something already.
 * @param cfg - optionally used to override global cfg settings 
 * @param delegate - if present, the batch will notify it on success, failure, and completion
 */
- (SyncBatch*)createBatch:(SyncConfig*)cfg 
             withDelegate:(id)del
{
    // fill in the config with defaults from the global config
    if (cfg == NULL) cfg = [[SyncConfig alloc] init];
    [cfg fillWithDefaults:self.config];
    
    // create the batch
    SyncBatch *batch = [[SyncBatch alloc] initWithConfig:cfg 
                                               forClient:self 
                                            withDelegate:del];
    
    // add it to the queue
    [_queue enqueue:batch];
    
    // process the queue if appropriate
    [self processQueue];
    
    // set the last sync flag
    [_persistedData setObject:[NSDate date] forKey:@"lastSync"];
    
    return batch;
}


/**
 * Queue management methods. Not needed in normal use.
 */
- (void)clearQueue;
{
    [_queue removeAllObjects];
}

- (SyncBatch*)processQueue
{
    //NSLog(@"SYNC: Processing queue. isprocessing=%@ length=%d", isProcessing?@"YES":@"NO", [_queue count]);
    if (self.isProcessing != NO) return NULL;
    if ([_queue count] == 0) return NULL;
    
    self.isProcessing = YES;
    
    SyncBatch *batch = [_queue dequeue];
    [batch process];
    
    return batch;
}

/**
 
 * @param modelName
 * @param remoteID
 */
- (NSManagedObject*)findModel:(NSString*)modelName 
                         byID:(int)remoteID
{
    NSEntityDescription *entity = [NSEntityDescription entityForName:modelName 
                                              inManagedObjectContext:self.config.context];
    
    NSFetchRequest *request = [[NSFetchRequest alloc] init];
    [request setEntity:entity];
    
    NSPredicate *predicate;
    predicate = [NSPredicate predicateWithFormat:@"remoteID == %d", remoteID];
    [request setPredicate:predicate];
    
    NSError *error = nil;
    NSArray *results = [self.config.context executeFetchRequest:request error:&error];
    if (error != nil)
    {
        [NSException raise:NSGenericException format:[error description]];
    }
    
    if (results == NULL || [results count] == 0)
    {
        return NULL;
    }
    else 
    {
        return [results objectAtIndex:0];
    }
}


/**
 * This flag is set when a sync fails.
 * The idea is that an app can clear the flag after
 * a successful and complete sync, and then check
 * the flag before doing anything destructive that
 * might cause data loss if there's unsynced data.
 * Setting the flag happens automatically. Clearing
 * it is up to the app.
 */
- (BOOL)checkDirtyFlag
{
    return (BOOL)[_persistedData objectForKey:@"dirty"];
}

- (void)setDirtyFlag
{
    // TODO
}

- (void)clearDirtyFlag
{
    [_persistedData setObject:FALSE forKey:@"dirty"];
}


- (NSDate*)getLastSync
{
    id ls = [_persistedData objectForKey:@"lastSync"];
    if ([ls isKindOfClass:[NSDate class]])
    {
        return (NSDate*)ls;
    }
    else 
    {
        return NULL;
    }
}


- (void)savePersistedData
{
    NSString *path = [(NSString *) [NSSearchPathForDirectoriesInDomains (NSDocumentDirectory, NSUserDomainMask, YES) objectAtIndex:0] stringByAppendingPathComponent:@"SapphireSync.plist"];
    [_persistedData writeToFile:path atomically:YES]; 
}


- (void)loadPersistedData
{ 
    NSString *path = [(NSString *) [NSSearchPathForDirectoriesInDomains (NSDocumentDirectory, NSUserDomainMask, YES) objectAtIndex:0] stringByAppendingPathComponent:@"SapphireSync.plist"]; 
    if ([[NSFileManager defaultManager] fileExistsAtPath: path])
    { 
        _persistedData = [[NSMutableDictionary alloc] initWithContentsOfFile: path];       
    } 
    else
    {
        _persistedData = [[NSMutableDictionary alloc] initWithCapacity:2];
        [_persistedData setObject:[NSNull null] forKey:@"lastSync"];
        [_persistedData setObject:[NSNull null] forKey:@"dirty"];
    }
} 
                         


/**
 * Because this system requires the LastEdited
 * dates to be reasonably close, we request the
 * server time and remember the difference between
 * local and server time.
 */
- (void)updateServerTimeOffset
{
    // TODO
}

/**
 * Gets the estimated current time on the server
 * using the current local time and the server time
 * offset.
 */
- (NSDate*)getServerNow
{
    return [NSDate date];
}

                         
#pragma mark SyncDelegate methods ---------------------------


- (void)syncBatchDidFinish:(id)sender withErrors:(NSDictionary*)errors
{
    NSLog(@"SYNC: Batch finished.");
    self.isProcessing = NO;
    
    if (self.delegate && [self.delegate respondsToSelector:@selector(syncBatchDidFinish:withErrors:)])
        [self.delegate syncBatchDidFinish:self withErrors:errors];
    
    [self processQueue];
}

- (void)syncBatchDidSucceed:(id)sender
{
   if (self.delegate && [self.delegate respondsToSelector:@selector(syncBatchDidSucceed:)])
       [self.delegate syncBatchDidSucceed:self];
}

- (void)syncBatchDidFail:(id)sender withErrors:(NSDictionary*)errors
{
    if (self.delegate && [self.delegate respondsToSelector:@selector(syncBatchDidFail:withErrors:)])
        [self.delegate syncBatchDidFail:self withErrors:errors];

}


@end
