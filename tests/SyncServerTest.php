<?php
/**
 * Test cases for the server-side part of the sync.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 8.15.11
 * @package sync
 */
class SyncServerTest extends FunctionalTest {
	static $fixture_file = 'sync/tests/SyncTests.yml';
	
	/**
	 * create our particular contexts
	 */
	function setUpOnce() {
		SyncContext::add(array(
			'test' => array(
				'Page' => array(
					'type'	=> SYNC_FULL
				),
			),
			
			'test2' => array(
				'Page'	=> array('type' => SYNC_NONE),
			),
		));
	}
	
	
	/**
	 * Test that the different contexts are working and enforcing permissions
	 */
	function testAllowedToSync() {
		// try the default syncing mode 
		$r = Director::test('sync', array(
			'model'		=> 'Page',
		));
		$this->assertEquals($r->getStatusCode(), 403);

		// try the test1 syncing mode 
		$r = Director::test('sync/test', array(
			'model'		=> 'Page',
		));
		$this->assertEquals($r->getStatusCode(), 200);

		// try the test2 syncing mode 
		$r = Director::test('sync/test2', array(
			'model'		=> 'Page',
		));
		$this->assertEquals($r->getStatusCode(), 403);
	}
	
}