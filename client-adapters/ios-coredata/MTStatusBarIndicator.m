//
//  MTStatusBarIndicator.m
//  ShilohNative
//
//  Created by Mark Guinn on 10/5/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "MTStatusBarIndicator.h"
#import "MTStatusBarOverlay.h"

@implementation MTStatusBarIndicator
{
    MTStatusBarOverlay *_overlay;
}


- (id)init
{
    if ((self = [super init])) {
        _overlay = [MTStatusBarOverlay sharedInstance];
        _overlay.animation = MTStatusBarOverlayAnimationShrink;
    }
    return self;
}


- (void)syncIndicatorChange:(id)sender withMessage:(NSString*)msg withProgress:(float)progress
{
    NSLog(@"====== %@", msg);
    _overlay.progress = progress;

    if (progress == 0.0)
    {
        [_overlay postMessage:msg animated:YES];
    }
    else if (progress == 1.0)
    {
        [_overlay postImmediateFinishMessage:msg duration:2 animated:YES];
    }
    else 
    {
        [_overlay postImmediateMessage:msg animated:YES];
    }
}


- (void)syncBatchDidFinish:(id)sender withErrors:(NSDictionary*)errors
{
    NSLog(@"====== HIDING INDICATOR");
    if (errors != nil && [errors count] > 0) [_overlay hide];
}


@end
