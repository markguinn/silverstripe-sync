//package com.adaircreative.silverstripesync;
//
//import java.util.LinkedList;
//
///**
// * This is the main interface class if you're not using the adapter.
// * 
// * Usage:
// *  SyncClient c = new SyncClient(cfg);
// *  c.createBatch();
// * 
// * @author Mark Guinn <mark@adaircreative.com>
// * @date Oct 24, 2013
// * @package com.adaircreative.silverstripesync
// */
//public class SyncClient {
//	private SyncConfig mConfig;
//	private LinkedList<SyncBatch> mQueue;
//	private boolean mIsProcessing = false;
//	
//	public SyncClient(SyncConfig cfg) {
//		mConfig = cfg;
//		mQueue = new LinkedList<SyncBatch>();
//	}
//	
//	public SyncBatch createBatch() {
//		return this.createBatch(mConfig, true);
//	}
//	
//	public SyncBatch createBatch(SyncConfig cfg) {
//		return this.createBatch(cfg, true);
//	}
//	
//	public SyncBatch createBatch(SyncConfig cfg, boolean processNow) {
//		SyncBatch batch = new SyncBatch(this, cfg);
//		mQueue.addLast(batch);
//		if (processNow) this.processQueue();
//		return batch;
//	}
//	
//	public void clearQueue() {
//		mQueue.removeAll(null); // does this do what I think it does?
//	}
//	
//	public SyncBatch processQueue() {
//		if (mIsProcessing) return null;
//		if (mQueue.isEmpty()) return null;
//		mIsProcessing = true;
//		SyncBatch batch = mQueue.removeFirst();
//		
//	}
//}
