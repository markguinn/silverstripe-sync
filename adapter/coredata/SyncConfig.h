//
//  SyncConfig.h
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "SyncDelegate.h"

@interface SyncConfig : NSObject
//{
//    NSString *apiUrl;
//    NSString *serverTimeUrl;
//    NSDictionary *auth;
//    
//    NSArray *models;
//    NSDictionary *stores;
//    NSManagedObjectContext *context;
//    
//    BOOL showMask;
//    NSString *maskTpl;
//}

@property (nonatomic, strong) NSString *apiUrl;
@property (nonatomic, strong) NSString *serverTimeUrl;
@property (nonatomic, strong) NSDictionary *auth;

@property (nonatomic, strong) NSArray *models;
@property (nonatomic, strong) NSManagedObjectContext *context;

/**
 * If present, this will allow different names for local models
 * versus server models. Key=local, Value=server
 */
@property (nonatomic, strong) NSDictionary *modelNameTransform;

@property (nonatomic) BOOL fullRefresh;

@property (nonatomic, strong) id <SyncDelegate> indicator;
@property (nonatomic, strong) NSString *maskTpl;


/**
 * Copies values from defaults for any that are missing in this config.
 */
- (void)fillWithDefaults:(SyncConfig*)defaults;


@end
