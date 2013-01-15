//
//  SyncDelegate.h
//  ShilohNative
//
//  Created by Mark Guinn on 9/2/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

@protocol SyncDelegate <NSObject>

@optional
- (void)syncBatchWillStart:(id)sender;
- (void)syncBatchDidSucceed:(id)sender;
- (void)syncBatchDidFail:(id)sender withErrors:(NSDictionary*)errors;
- (void)syncBatchDidFinish:(id)sender withErrors:(NSDictionary*)errors;
- (void)syncRequestDidSucceed:(id)sender;
- (void)syncRequestDidFail:(id)sender withError:(NSError*)error;
- (void)syncRequestDidFinish:(id)sender withError:(NSError*)error;
- (void)syncIndicatorChange:(id)sender withMessage:(NSString*)msg withProgress:(float)progress;

@end
