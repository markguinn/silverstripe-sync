<?php
/**
 * Test cases for the server-side part of the sync.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 8.15.11
 * @package SapphireSync
 */
define('SYNC_TEST_FIXTURE_PATH', SYNC_MODULE_FOLDER . '/tests/SyncTests.yml');

class SyncServerTest extends FunctionalTest
{
    public static $fixture_file = SYNC_TEST_FIXTURE_PATH;
    
    /**
     * create our particular contexts
     */
    public function setUpOnce()
    {
        SyncContext::add(array(
            'test' => array(
                'Page'    => array(
                    'type'        => SYNC_FULL,
                    'fields'    => 'ID,LastEdited,Title',
                ),
                'File'    => array(
                    'type'        => SYNC_UP,
                    'fields'    => 'ID,LastEdited,Name,Title,Filename',
                ),
            ),
            
            'test2' => array(
                'Page'    => array('type' => SYNC_NONE),
            ),
        ));
    }
    
    
    /**
     * Test that the different contexts are working and enforcing permissions
     */
    public function testAllowedToSync()
    {
        // try the default syncing mode 
        $r = Director::test('sync', array(
            'model'        => 'Page',
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $this->assertEquals($r->getBody(), '{"ok":0,"statusMessage":"Access denied","statusCode":403}');

        // try the test1 syncing mode 
        $r = Director::test('sync/test', array(
            'model'        => 'Page',
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody());
        $this->assertEquals($data->ok, 1);

        // try the test2 syncing mode 
        $r = Director::test('sync/test2', array(
            'model'        => 'Page',
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $this->assertEquals($r->getBody(), '{"ok":0,"statusMessage":"Access denied","statusCode":403}');
    }
    
    
    /**
     * Test that a basic series of operations are working correctly
     */
    public function testBasic()
    {
        $r = Director::test('sync/test', array(
            'model'        => 'Page',
            'insert'    => json_encode(array(array('Title'=>'My Inserted Page'))),
            'check'        => json_encode(array()),
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody(), true);
        $this->assertEquals($data['ok'], 1);
        $this->assertEquals(count($data['insert']), 5);
        $this->assertEquals(count($data['update']), 0);
        $this->assertEquals(count($data['send']), 0);
        $this->assertEquals(count($data['del']), 0);

        // check that the record was actually inserted
        $recs = DataObject::get('Page');
        $this->assertEquals($recs->Count(), 5);
        $myRec = DataObject::get_one('Page', "Title = 'My Inserted Page'");
        $this->assertTrue($myRec instanceof Page);

        // check that changes on the client get updated on the server
        $newTS = time();
        $r = Director::test('sync/test', array(
            'model'        => 'Page',
            'check'        => json_encode(array(array(
                'ID'    => $myRec->ID,
                'TS'    => $newTS+10,
            )))
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody(), true);
        $this->assertEquals($data['ok'], 1);
        $this->assertEquals(count($data['send']), 1);
        $this->assertEquals(count($data['update']), 0);
        $this->assertEquals(count($data['insert']), 4);
        $this->assertEquals(count($data['del']), 0);

        // send the changes and check that they stick
        Director::test('sync/test', array(
            'model'        => 'Page',
            'update'    => json_encode(array(array(
                'ID'    => $myRec->ID,
                'Title'    => 'My Updated Inserted Page',
            )))
        ));
        $myRec2 = DataObject::get_by_id('Page', $myRec->ID);
        $this->assertTrue($myRec2 instanceof Page);
        $this->assertEquals('My Updated Inserted Page', $myRec2->Title);

        // check that changes on the server get sent properly to the client
        $r = Director::test('sync/test', array(
            'model'        => 'Page',
            'check'        => json_encode(array(array(
                'ID'    => $myRec->ID,
                'TS'    => $newTS-10,
            )))
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody(), true);
        $this->assertEquals($data['ok'], 1);
        $this->assertEquals(count($data['send']), 0);
        $this->assertEquals(count($data['update']), 1);
        $this->assertEquals(count($data['insert']), 4);
        $this->assertEquals(count($data['del']), 0);

        // check that being deleted on the server gets sent to the client
        $myRec->delete();
        $r = Director::test('sync/test', array(
            'model'        => 'Page',
            'check'        => json_encode(array(array(
                'ID'    => $myRec->ID,
                'TS'    => $newTS,
            )))
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody(), true);
        $this->assertEquals($data['ok'], 1);
        $this->assertEquals(count($data['send']), 0);
        $this->assertEquals(count($data['update']), 0);
        $this->assertEquals(count($data['insert']), 4);
        $this->assertEquals(count($data['del']), 1);
    }


    /**
     * Test how SYNC_UP behaves
     */
    public function testSyncUp()
    {
        // check a simple insert
        $r = Director::test('sync/test', array(
            'model'        => 'File',
            'insert'    => json_encode(array(array('Title'=>'My Inserted File'))),
            'check'        => json_encode(array()),
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody(), true);
        $this->assertEquals($data['ok'], 1);
        $this->assertEquals(count($data['insert']), 0);
        $this->assertEquals(count($data['update']), 0);
        $this->assertEquals(count($data['send']), 0);
        $this->assertEquals(count($data['del']), 0);

        // check that the record was actually inserted
        $recs = DataObject::get('File');
        $this->assertEquals($recs->Count(), 1);
        $myRec = DataObject::get_one('File', "Title = 'My Inserted File'");
        $this->assertTrue($myRec instanceof File);

        // check that existing client records are deleted in SYNC_UP mode
        $r = Director::test('sync/test', array(
            'model'        => 'File',
            'insert'    => json_encode(array()),
            'check'        => json_encode(array(array(
                'ID'    => $myRec->ID,
                'TS'    => time()+10,
            )))
        ));
        $this->assertEquals($r->getStatusCode(), 200);
        $data = json_decode($r->getBody(), true);
        $this->assertEquals($data['ok'], 1);
        $this->assertEquals(count($data['insert']), 0);
        $this->assertEquals(count($data['update']), 0);
        $this->assertEquals(count($data['send']), 0);
        $this->assertEquals(count($data['del']), 1);
    }
}
