//
//  SyncRequest.h
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "SyncConfig.h"
#import "SyncDelegate.h"

@class SyncBatch;

@interface SyncRequest : NSObject

@property (nonatomic, strong) NSString *model;
@property (nonatomic, strong) SyncConfig *config;
@property (nonatomic, strong) SyncBatch *batch;
@property (nonatomic, strong) id <SyncDelegate> delegate;

- (id)initWithConfig:(SyncConfig*)cfg 
            forModel:(NSString*)model
           fromBatch:(SyncBatch*)batch
        withDelegate:(id<SyncDelegate>)del;

- (NSString*)remoteModelName;

- (void)setValuesForLocal:(NSManagedObject*)localRec fromRemote:(NSDictionary*)remoteRec;

- (void)process;

-(void)connection:(NSURLConnection*)connection didReceiveResponse:(NSURLResponse*)response;
-(void)connection:(NSURLConnection*)connection didReceiveData:(NSData*)data;
-(void)connection:(NSURLConnection*)connection didFailWithError:(NSError*)error;
-(void)connectionDidFinishLoading:(NSURLConnection*)connection;

/**
 * Sends fail and finished events to all the right delegates
 */
-(void)sendFailWithError:(id)stringOrError;

@end
