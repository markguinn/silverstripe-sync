<?php
/**
 * A sync context allows you to define different rules for different settings.
 * For example, you might send a different subset of data and have different
 * security restrictions for an iphone application vs. a management portal.
 *
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 8.15.11
 * @package silverstripe-sync
 */
class SyncContext
{
	/**
	 * cache of instances keyed by id's
	 */
	protected static $instances = array('default' => true);
	
	
	/**
	 * @var array $modelConfig - configuration overrides for each model (key=model, val=cfg)
	 */
	protected $modelConfig;
	
	
	/**
	 * Adds a context to the available options. Can pass an array or an instance.
	 * @param string $id
	 * @param array|SyncContext $data
	 * @return SyncContext
	 * @throws Exception
	 */
	public static function add($id, $data=null) {
		// instantiate many from a single array if needed
		if (is_array($id)) {
			foreach ($id as $k => $v) {
				self::add($k, $v);
			}
			return;
		}
		
		// instantiate from array if needed
		if (is_array($data)) {
			$data = new SyncContext($data);
		}
		
		// don't allow duplicates
		if (isset(self::$instances[$id])) {
			throw new Exception("SyncContext '$id' is already in use.");
		}
		
		// add it to the array
		self::$instances[$id] = $data;
		
		// just for good measure
		return $data;
	}
	
	
	/**
	 * Returns an instance from an id
	 * @param string $id
	 * @return SyncContext
	 */
	public static function get($id) {
		if ($id && isset(self::$instances[$id])) {
			if (self::$instances[$id] === true) self::$instances[$id] = new SyncContext(array());
			return self::$instances[$id];
		} else {
			return null;
		}
	}
	
	
	/**
	 * Returns the actual instance of the current context if appropriate (or null)
	 * @return SyncContext
	 */
	public static function current() {
		return self::get(self::current_id());
	}
	
	
	/**
	 * Returns the 'id' of the current context or null if
	 * we're not currently doing a sync action
	 * @return string
	 */
	public static function current_id() {
		$ctl = Controller::curr();
		if ($ctl instanceof SyncController) {
			$id = $ctl->getRequest()->param('SyncContext');
			if (!$id) $id = 'default';
			return isset(self::$instances[$id]) ? $id : null;
		} else {
			return null;
		}
	}
	
	
	/**
	 * Creates a new syncing context
	 * @param array $modelConfig
	 */
	public function __construct(array $modelConfig = array()) {
		$this->modelConfig = $modelConfig;
	}
	
	
	/**
	 * Returns a merging of the model's default syncing configuration
	 * and the context configuration for this model
	 *
	 * @param string $model
	 * @return array
	 */
	public function getConfig($model) {
		$default = null;
		if (class_exists($model)) {
			if (class_exists('Config')) {
				$default = Config::inst()->get($model, 'sync');
			} else {
				$default = Object::get_static($model, 'sync');
			}
		}
		if (!is_array($default)) $default = array();
		
		$override = isset($this->modelConfig[$model]) ? $this->modelConfig[$model] : array();
		
		return array_merge($default, $override);
	}
	
	
	/**
	 * this is just a hook to be overridden if special authentication is required
	 */
	public function checkAuth(array $vars) {
		if (isset($this->modelConfig['_auth'])) {
			return call_user_func($this->modelConfig['_auth']);
		} else {
			return true;
		}
	}
	
	
	/**
	 * Returns an array where the keys are "variables" such as {StoreID}
	 * that can be used in the filter section of the cfg
	 *
	 * @param array $vars - the contents of post
	 * @return array
	 */
	public function getFilterVariables(array $vars) {
		if (isset($this->modelConfig['_vars'])) {
			return call_user_func($this->modelConfig['_vars']);
		} else {
			return array();
		}
	}
	
}
