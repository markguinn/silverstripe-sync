//
//  SyncConfig.m
//  SapphireSync
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "SyncConfig.h"

@implementation SyncConfig

@synthesize apiUrl, serverTimeUrl, auth, models, context, indicator, maskTpl, 
            fullRefresh, modelNameTransform;

/**
 * Copies values from defaults for any that are missing in this config.
 */
- (void)fillWithDefaults:(SyncConfig*)defaults
{
    if (self.apiUrl == nil)        self.apiUrl         = defaults.apiUrl;
    if (self.serverTimeUrl == nil) self.serverTimeUrl  = defaults.serverTimeUrl;
    if (self.auth == nil)          self.auth           = defaults.auth;
    if (self.models == nil)        self.models         = defaults.models;
    if (self.modelNameTransform == nil) self.modelNameTransform = defaults.modelNameTransform;
    if (self.context == nil)       self.context        = defaults.context;
    if (self.indicator == nil)     self.indicator      = defaults.indicator;
    if (self.maskTpl == nil)       self.maskTpl        = defaults.maskTpl;
    
    // not really sure what to do with these. right now they're just set every time
    //if (self.showMask == NULL)      self.showMask       = defaults.showMask;
    //if (self.fullRefresh == NULL)   self.fullRefresh    = defaults.fullRefresh;
}

@end
