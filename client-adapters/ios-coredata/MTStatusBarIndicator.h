//
//  MTStatusBarIndicator.h
//  ShilohNative
//
//  Created by Mark Guinn on 10/5/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "SyncDelegate.h"

@interface MTStatusBarIndicator : NSObject <SyncDelegate>

- (id)init;
- (void)syncIndicatorChange:(id)sender withMessage:(NSString*)msg withProgress:(float)progress;
- (void)syncBatchDidFinish:(id)sender withErrors:(NSDictionary*)errors;

@end
