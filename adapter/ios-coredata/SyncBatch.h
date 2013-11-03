//
//  SyncBatch.h
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "SyncConfig.h"
#import "SyncRequest.h"
#import "SyncDelegate.h"

@class SyncClient;

@interface SyncBatch : NSObject <SyncDelegate>

@property (nonatomic, strong) SyncConfig *config;
@property (nonatomic, weak) SyncClient *client;
@property (nonatomic, weak) id <SyncDelegate> delegate;
@property BOOL isProcessing;


/** 
 * Initializes the object with a configuration class 
 */
- (id)initWithConfig:(SyncConfig*)cfg 
           forClient:(SyncClient*)client 
        withDelegate:(id <SyncDelegate>)delegate;

/**
 * Initiates processing of this batch
 */
- (void)process;

/** 
 * Creates a new request, adds it to the queue, and starts it if we're not in the 
 * middle of something already.
 * @param cfg - optionally used to override global cfg settings 
 * @param model
 * @param delegate - if present, the batch will notify it on success, failure, and completion
 */
- (SyncRequest*)createRequest:(SyncConfig*)cfg 
                     forModel:(NSString*)model
                 withDelegate:(id)del;

/**
 * Queue management methods. Not needed in normal use.
 */
- (void)clearQueue;
- (SyncRequest*)processQueue;


- (NSString*)indicatorLabel;
- (float)indicatorProgress;

- (void)syncRequestDidSucceed:(id)sender;
- (void)syncRequestDidFail:(id)sender withError:(NSError *)error;
- (void)syncRequestDidFinish:(id)sender withError:(NSError*)error;

@end
