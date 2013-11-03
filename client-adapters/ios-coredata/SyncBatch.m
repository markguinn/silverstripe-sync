//
//  SyncBatch.m
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "SyncBatch.h"
#import "SyncRequest.h"
#import "SyncClient.h"
#import "NSMutableArray+QueueAdditions.h"

@implementation SyncBatch
{
    NSMutableArray *_queue __strong;
    NSMutableDictionary *_errors __strong;
    int _totalModels;        // set at the beginning so we know how to calc %
}

@synthesize config, client, delegate, isProcessing;


/** 
 * Initializes the object with a configuration class 
 */
- (id)initWithConfig:(SyncConfig*)cfg 
           forClient:(SyncClient*)c 
        withDelegate:(id)del
{
    if ((self = [super init])) {
        self.config = cfg;
        self.client = c;
        self.delegate = del;
        _errors = [[NSMutableDictionary alloc] initWithCapacity:[cfg.models count]];
    }
    return self;
}


/**
 * Processes the batch of requests. Returns immediately.
 */
- (void)process
{
    // initialize the queue
    _totalModels = [self.config.models count];
    _queue = [[NSMutableArray alloc] initWithCapacity:_totalModels];

    // fill the queue
    for (NSString *m in self.config.models) {
        [self createRequest:self.config
                   forModel:m
               withDelegate:self.delegate];
    }
    
    // send some delegate messages
    if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncBatchWillStart:)]) 
        [self.config.indicator syncBatchWillStart:self];
    
    // process the queue
    [self processQueue];
}


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
{
    // create the request
    SyncRequest *req = [[SyncRequest alloc] initWithConfig:cfg 
                                                  forModel:model
                                                 fromBatch:self 
                                              withDelegate:del];
    
    // add it to the queue
    [_queue enqueue:req];
    
    return req;
}


/**
 * Queue management methods. Not needed in normal use.
 */
- (void)clearQueue;
{
    [_queue removeAllObjects];
}

- (SyncRequest*)processQueue
{
    //NSLog(@"BATCH: Processing queue. isprocessing=%@ length=%d", isProcessing?@"YES":@"NO", [_queue count]);
    if (self.isProcessing != NO) return Nil;

    // update the indicator if present
    if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncIndicatorChange:withMessage:withProgress:)]) 
        [self.config.indicator syncIndicatorChange:self 
                                       withMessage:[self indicatorLabel] 
                                      withProgress:[self indicatorProgress]];

    // is the batch complete?
    if ([_queue count] == 0)
    {
        // send messages it to the client and delegate (if needed)
        if ([_errors count] == 0)
        {
            if ([self.client respondsToSelector:@selector(syncBatchDidSucceed:)]) 
                [self.client syncBatchDidSucceed:self];
            if (self.delegate && [self.delegate respondsToSelector:@selector(syncBatchDidSucceed:)]) 
                [self.delegate syncBatchDidSucceed:self];
            if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncBatchDidSucceed:)]) 
                [self.config.indicator syncBatchDidSucceed:self];
        }
        else 
        {
            if ([self.client respondsToSelector:@selector(syncBatchDidFail:withErrors:)]) 
                [self.client syncBatchDidFail:self withErrors:_errors];
            if (self.delegate && [self.delegate respondsToSelector:@selector(syncBatchDidFail:withErrors:)]) 
                [self.delegate syncBatchDidFail:self withErrors:_errors];
            if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncBatchDidFail:withErrors:)]) 
                [self.config.indicator syncBatchDidFail:self withErrors:_errors];
        }
        
        if ([self.client respondsToSelector:@selector(syncBatchDidFinish:withErrors:)]) 
            [self.client syncBatchDidFinish:self withErrors:_errors];
        if (self.delegate && [self.delegate respondsToSelector:@selector(syncBatchDidFinish:withErrors:)]) 
            [self.delegate syncBatchDidFinish:self withErrors:_errors];
        if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncBatchDidFinish:withErrors:)]) 
            [self.config.indicator syncBatchDidFinish:self withErrors:_errors];
        
        return Nil;
    }
    
    self.isProcessing = YES;
    
    SyncRequest *request = [_queue dequeue];
    [request process];
    
    return request;
}


- (NSString*)indicatorLabel
{
    int pct = (int)([self indicatorProgress] * 100);
    return [NSString stringWithFormat:self.config.maskTpl, pct, nil];
}

- (float)indicatorProgress
{
    if (_totalModels == 0) return 0.0;
    return (float)(_totalModels - [_queue count]) / (float)_totalModels;
}

#pragma mark SyncDelegate methods

- (void)syncRequestDidFinish:(id)sender withError:(NSError*)error;
{
    //NSLog(@"batch:request finished");
    self.isProcessing = NO;

    // send it to the client and delegate (if needed)
    if ([self.client respondsToSelector:@selector(syncRequestDidFinish:withError:)]) 
        [self.client syncRequestDidFinish:self withError:error];
    if (self.delegate && [self.delegate respondsToSelector:@selector(syncRequestDidFinish:withError:)]) 
        [self.delegate syncRequestDidFinish:self withError:error];
    if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncRequestDidFinish:withError:)]) 
        [self.config.indicator syncRequestDidFinish:self withError:error];
    
    // process the next request
    [self processQueue];
}

- (void)syncRequestDidSucceed:(id)sender
{
    //NSLog(@"batch:request succeeded");

    // send it to the client and delegate (if needed)
    if ([self.client respondsToSelector:@selector(syncRequestDidSucceed:)]) 
        [self.client syncRequestDidSucceed:self];
    if (self.delegate && [self.delegate respondsToSelector:@selector(syncRequestDidSucceed:)]) 
        [self.delegate syncRequestDidSucceed:self];
    if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncRequestDidSucceed:)]) 
        [self.config.indicator syncRequestDidSucceed:self];
}

- (void)syncRequestDidFail:(id)sender 
                 withError:(NSError*)error
{
    NSLog(@"SYNC BATCH: request failed %@", error);
    
    // remember the error
    SyncRequest* req = (SyncRequest*)sender;
    [_errors setValue:error forKey:req.model];
    
    // send it to the client and delegate (if needed)
    if ([self.client respondsToSelector:@selector(syncRequestDidFail:withError:)]) 
        [self.client syncRequestDidFail:self withError:error];
    if (self.delegate && [self.delegate respondsToSelector:@selector(syncRequestDidFail:withError:)]) 
        [self.delegate syncRequestDidFail:self withError:error];    
    if (self.config.indicator && [self.config.indicator respondsToSelector:@selector(syncRequestDidFail:withError:)]) 
        [self.config.indicator syncRequestDidFail:self withError:error];    
}


@end
