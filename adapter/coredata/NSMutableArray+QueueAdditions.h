//
//  NSMutableArray+QueueAdditions.h
//  ShilohNative
//
//  Created by Mark Guinn on 8/28/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface NSMutableArray (QueueAdditions)
- (id) dequeue;
- (void) enqueue:(id)obj;
@end
