//
//  NSMutableDictionary+UrlEncoding.h
//  ShilohNative
//
//  Created by Mark Guinn on 9/2/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//
// Taken from: http://blog.ablepear.com/2008/12/urlencoding-category-for-nsdictionary.html
//

#import <Foundation/Foundation.h>

@interface NSMutableDictionary (UrlEncoding)

-(NSString*) urlEncodedString;

@end
