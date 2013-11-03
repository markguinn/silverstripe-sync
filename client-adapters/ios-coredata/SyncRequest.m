//
//  SyncRequest.m
//  ShilohNative
//
//  Created by Mark Guinn on 8/26/12.
//  Copyright (c) 2012 Adair Creative Group. All rights reserved.
//

#import "SyncRequest.h"
#import "SyncBatch.h"
#import "SyncClient.h"
#import "NSMutableDictionary+UrlEncoding.h"
#import "ISO8601DateFormatter.h"
#import <Foundation/NSJSONSerialization.h>
#import <dispatch/dispatch.h>

const int SYNCREQUEST_STATE_CHECK = 0;
const int SYNCREQUEST_STATE_UPDATE = 1;


@implementation SyncRequest
{
    NSMutableData *_data __strong;
    int _state;
    NSMutableArray *_localDelete;
	dispatch_queue_t backgroundQueue;
}

- (id)initWithConfig:(SyncConfig*)cfg
            forModel:(NSString*)m
           fromBatch:(SyncBatch*)b
        withDelegate:(id<SyncDelegate>)del;
{
    if ((self = [super init])) {
        self.model = m;
        self.config = cfg;
        self.batch = b;
        self.delegate = del;
		backgroundQueue = dispatch_queue_create("com.silverstripesync.processing", NULL);
    }
	
    return self;
}

- (void)dealloc
{
	dispatch_release(backgroundQueue);
}


- (NSString*)remoteModelName
{
    NSString *transformedName = nil;
    if (self.config.modelNameTransform != nil)
    {
        transformedName = [self.config.modelNameTransform valueForKey:self.model];
    }
    return (transformedName == nil) ? self.model : transformedName;
}


- (void)setValuesForLocal:(NSManagedObject*)localRec fromRemote:(NSDictionary*)remoteRec
{
    NSEntityDescription *entity = [NSEntityDescription entityForName:self.model
                                              inManagedObjectContext:self.config.context];
    NSDictionary *props = [entity propertiesByName];
    
    for (NSString *key in remoteRec)
    {
        // the local key is almost always upper-camel-cased on the server (i.e. LastEdited)
        // and on the coredata object it's lower-camel-cased. The exception is ID which
        // should always be called remoteID
        NSString* localKey;
        if ([key isEqualToString:@"ID"])
        {
            localKey = @"remoteID";
        } 
        else 
        {
            localKey = [key stringByReplacingCharactersInRange:NSMakeRange(0,1) withString:[[key substringToIndex:1] lowercaseString]];
        }        
        
        // convert type appropriately
        NSAttributeDescription* propDesc = [props valueForKey:localKey];
        if (propDesc)
        {
            NSString *className = [propDesc attributeValueClassName];
            id obj = [remoteRec valueForKey:key];
            //NSLog(@"Classes: %@ -> %@", [obj class], className);
            
            if ([className isEqualToString:@"NSDate"])
            {
                ISO8601DateFormatter *dateFormatter = [[ISO8601DateFormatter alloc] init];
                NSDate *date = [dateFormatter dateFromString:(NSString*)obj];
                [localRec setValue:date forKey:localKey];
            }
            else if ([obj isKindOfClass:[NSNull class]])
            {
                [localRec setValue:nil forKey:localKey];
            }
            else if ([className isEqualToString:@"NSNumber"] && [obj isKindOfClass:[NSString class]])
            {
                NSNumberFormatter *f = [[NSNumberFormatter alloc] init];
                [f setNumberStyle:NSNumberFormatterDecimalStyle];
                NSNumber* num = [f numberFromString:(NSString*)obj];
                [localRec setValue:num forKey:localKey];
            }
            else 
            {
                [localRec setValue:(NSValue*)obj forKey:localKey];
            }
        }
        else 
        {
            //NSLog(@"WARNING: Property %@ not found for model %@", localKey, self.model);
        }
    }
}


///
/// This is where the magic happens.
///
- (void)process
{
    NSLog(@"Syncing model: %@", self.model);
    _state = SYNCREQUEST_STATE_CHECK;
	
    dispatch_async(backgroundQueue, ^{
		// STEP 1. Assemble a list of local data to insert, check, and locally delete ::::::::::::::::::::
		
		// build the parameters
		NSMutableArray *toInsert = [[NSMutableArray alloc] initWithCapacity:100];
		NSMutableArray *toCheck = [[NSMutableArray alloc] initWithCapacity:100];
		NSMutableArray *toDelete = [[NSMutableArray alloc] initWithCapacity:100];
		NSMutableDictionary *dataOut = [[NSMutableDictionary alloc] initWithCapacity:4];
		[dataOut setObject:[self remoteModelName] forKey:@"model"];

		// add in the parameters from auth if present
		if (self.config.auth != NULL) 
		{
			[dataOut addEntriesFromDictionary:self.config.auth];
		}
		
		// fetch all the records
		NSManagedObjectContext *context = self.config.context;
		NSEntityDescription *entity = [NSEntityDescription entityForName:self.model inManagedObjectContext:context];
		NSFetchRequest *fetchAll = [[NSFetchRequest alloc] init];
		[fetchAll setEntity:entity];
		NSArray *recs = [context executeFetchRequest:fetchAll error:nil];    
		if (recs == NULL)
		{
			// TODO check for error and call the error handler if needed. def call the after handler
			NSLog(@"SYNC REQUEST: Fetch error. Nil result returned. What's up?");
			[self.batch syncRequestDidFinish:self withError:nil];
			return;
		}
		
		// look at each record and add it to the appropriate list (insert, check, or delete)
		for (NSManagedObject *rec in recs) 
		{
			int remoteID = [(NSNumber*)[rec valueForKey:@"remoteID"] integerValue];
			if (remoteID > 0)
			{
				if (self.config.fullRefresh)
				{
					[toDelete addObject:rec];
				}
				else 
				{
					NSDate *edited = [rec valueForKey:@"lastEdited"];
					int timeStamp = (edited == NULL) ? 0 : [edited timeIntervalSince1970];
					
					NSDictionary *checkMe = @{
						@"ID": [NSNumber numberWithInt:remoteID],
						@"TS": [NSNumber numberWithInt:timeStamp]
					};
					
					[toCheck addObject:checkMe];
				}
			}
			else 
			{
				NSArray *keys = [[[rec entity] attributesByName] allKeys];
				NSDictionary *dict = [rec dictionaryWithValuesForKeys:keys];
				[toInsert addObject:dict];
				[toDelete addObject:rec];
			}
		}

		_localDelete = toDelete;

		// STEP 2. Send those lists to the server ::::::::::::::::::::::::::::::::::::::::::::::::::::::::
		NSError *error;
		
		NSData *jsonData = [NSJSONSerialization dataWithJSONObject:toInsert options:kNilOptions error:&error];
		NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
		[dataOut setObject:jsonString forKey:@"insert"];
		
		jsonData = [NSJSONSerialization dataWithJSONObject:toCheck options:kNilOptions error:&error];
		jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
		[dataOut setObject:jsonString forKey:@"check"];

		NSMutableURLRequest *request = [[NSMutableURLRequest alloc] 
										initWithURL:[NSURL URLWithString:self.config.apiUrl]];
		
		[request setHTTPMethod:@"POST"];
		
		NSString *postString = [dataOut urlEncodedString];
		//NSLog(@"post: %@ to: %@", postString, self.config.apiUrl);
		[request setValue:[NSString stringWithFormat:@"%d", [postString length]] 
				forHTTPHeaderField:@"Content-length"];
		
		[request setHTTPBody:[postString dataUsingEncoding:NSUTF8StringEncoding]];
		
		NSURLConnection *conn = [[NSURLConnection alloc] initWithRequest:request 
																delegate:self];
		CFRunLoopRun();
	});
}


-(void)connection:(NSURLConnection*)connection didReceiveResponse:(NSURLResponse*)response
{
    //NSLog(@"Response starting.");
    _data = [[NSMutableData alloc] init]; // _data being an ivar
}

-(void)connection:(NSURLConnection*)connection didReceiveData:(NSData*)data
{
    //NSLog(@"Received data: %@", [[NSString alloc] initWithData:data encoding:NSASCIIStringEncoding]);
    [_data appendData:data];
}

-(void)connection:(NSURLConnection*)connection didFailWithError:(NSError*)error
{
    NSLog(@"SYNC REQUEST: Request failed: %@ (state=%d)", error, _state);
    if (_state == SYNCREQUEST_STATE_CHECK)
    {
        [self sendFailWithError:error];
    }
	CFRunLoopStop(CFRunLoopGetCurrent());
}

-(void)connectionDidFinishLoading:(NSURLConnection*)connection
{
    //NSLog(@"Request finished: %d, model=%@", _state, self.model);
    CFRunLoopStop(CFRunLoopGetCurrent());
    if (_state == SYNCREQUEST_STATE_CHECK)
    {
        NSError *error;
        NSMutableDictionary* dataIn = [NSJSONSerialization JSONObjectWithData:_data options:kNilOptions error:&error];
        SyncClient *client = self.batch.client;
        NSEntityDescription *entity = [NSEntityDescription entityForName:self.model
                                                  inManagedObjectContext:self.config.context];
        
        // check for ok=0 (connection succeeded, but operation failed on server
        if ([(NSNumber*)[dataIn valueForKey:@"ok"] intValue] == 0)
        {
            NSLog(@"SYNC REQUEST: Request failed. reason=%@", [dataIn valueForKey:@"statusMessage"]);
            [self sendFailWithError:[dataIn valueForKey:@"statusMessage"]];
        }
        
        // STEP 3. Send back any requested records :::::::::::::::::::::::::::::::::::::::::::::::::::
        _state = SYNCREQUEST_STATE_UPDATE;
        NSMutableArray* toUpdate = [[NSMutableArray alloc] initWithCapacity:100];
        // TODO
        
        // STEP 4. Update anything that's changed ::::::::::::::::::::::::::::::::::::::::::::::::::::
        NSArray *remoteUpdate = (NSArray*)[dataIn valueForKey:@"update"];
        if ([remoteUpdate count] > 0)
        {
            for (NSDictionary* remoteRec in remoteUpdate)
            {
                int remoteID = [(NSNumber*)[remoteRec valueForKey:@"ID"] intValue];
                NSManagedObject* localRec = [client findModel:self.model byID:remoteID];
                if (localRec != nil) 
                {
                    NSLog(@"SYNC REQUEST: Updating record #%@", [localRec valueForKey:@"remoteID"]);
                    [self setValuesForLocal:localRec fromRemote:remoteRec];
                }
            }
        }
        
        // STEP 5. Delete anything the server asked us to delete :::::::::::::::::::::::::::::::::::::
        [_localDelete addObjectsFromArray:(NSArray*)[dataIn valueForKey:@"del"]];
        if ([_localDelete count] > 0)
        {
            for (id remoteID in _localDelete)
            {
                NSManagedObject* localRec;
                
                if ([remoteID isKindOfClass:[NSNumber class]])
                {                    
                    localRec = [client findModel:self.model byID:[(NSNumber*)remoteID intValue]];
                }
                else 
                {
                    localRec = (NSManagedObject*)remoteID;
                }
                
                if (localRec != nil) 
                {
                    NSLog(@"SYNC REQUEST: Deleting record #%@", [localRec valueForKey:@"remoteID"]);
                    [self.config.context deleteObject:localRec];
                }
            }
        }
        
        // STEP 6. Insert new records from the server ::::::::::::::::::::::::::::::::::::::::::::::::
        NSArray *remoteInsert = (NSArray*)[dataIn valueForKey:@"insert"];
        if ([remoteInsert count] > 0)
        {
            for (NSDictionary* remoteRec in remoteInsert)
            {
                NSManagedObject* localRec = [[NSManagedObject alloc] 
                                             initWithEntity:entity 
                             insertIntoManagedObjectContext:self.config.context];
                [self setValuesForLocal:localRec fromRemote:remoteRec];
                NSLog(@"SYNC REQUEST: Inserting record #%@", [localRec valueForKey:@"remoteID"]);
            }
        }
        
        // commit changes to the local store
		// NOTE: there may be a better way to do this, but we first check
		// if MagicalRecord is in use because it doesn't seem to actually
		// save the data unless we use it's own save methods.
		if ([self.config.context respondsToSelector:@selector(MR_saveToPersistentStoreWithCompletion:)])
		{
			[self.config.context MR_saveToPersistentStoreWithCompletion:nil];
		}
		else
		{
			BOOL r = [self.config.context save:&error];
			if (r == NO) 
			{
				[self sendFailWithError:error];
				return;
			}
		}
		
		dispatch_async(dispatch_get_main_queue(), ^{
			// send it to the batch
			if (self.batch != nil && [self.batch respondsToSelector:@selector(syncRequestDidSucceed:)])
				[self.batch syncRequestDidSucceed:self];
			if (self.batch != nil && [self.batch respondsToSelector:@selector(syncRequestDidFinish:withError:)])
				[self.batch syncRequestDidFinish:self withError:nil];
			
			// if a delegate is present, send it there as well
			if (self.delegate != nil && [self.delegate respondsToSelector:@selector(syncRequestDidSucceed:)])
				[self.delegate syncRequestDidSucceed:self];
			if (self.delegate != nil && [self.delegate respondsToSelector:@selector(syncRequestDidFinish:withError:)])
				[self.delegate syncRequestDidFinish:self withError:nil];
		});
    }
    else 
    {
        // we don't actually need to do anything when the update succeeds (OR fails actually)
    }
}



///
/// Sends fail and finished events to all the right delegates
///
-(void)sendFailWithError:(id)stringOrError
{
    NSError *error;
    
    // build the error object if needed
    if ([stringOrError isKindOfClass:[NSString class]])
    {
        NSMutableDictionary *errorDetail = [NSMutableDictionary dictionary];
        [errorDetail setValue:stringOrError forKey:NSLocalizedDescriptionKey];
        error = [NSError errorWithDomain:@"SapphireSync" code:100 userInfo:errorDetail];
    }
    else 
    {
        error = (NSError*)stringOrError;
    }

	dispatch_async(dispatch_get_main_queue(), ^(void) {
		// send it to the batch
		if (self.batch != nil && [self.batch respondsToSelector:@selector(syncRequestDidFail:withError:)])
			[self.batch syncRequestDidFail:self withError:error];
		if (self.batch != nil && [self.batch respondsToSelector:@selector(syncRequestDidFinish:withError:)])
			[self.batch syncRequestDidFinish:self withError:error];
		
		// if a delegate is present, send it there as well
		if (self.delegate != nil && [self.delegate respondsToSelector:@selector(syncRequestDidFail:withError:)])
			[self.delegate syncRequestDidFail:self withError:error];
		if (self.delegate != nil && [self.delegate respondsToSelector:@selector(syncRequestDidFinish:withError:)])
			[self.delegate syncRequestDidFinish:self withError:error];
	});
}




@end
