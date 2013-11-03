/**
 * SapphireSync android java adapter. See <https://github.com/markguinn/silverstripe-sync>
 * Note that the Android adapter is very different from the other
 * client adapters in it's structure in several ways:
 * 
 * 1. It's wrapped in the built-in SyncAdapter framework
 * 2. It's built to run synchronously in a thread, which makes a lot
 *    of the callbacks and delegates and stuff unnecessary
 * 
 * @author Mark Guinn <mark@adaircreative.com>
 * @date 10.23.13 
 */
package com.adaircreative.silverstripesync;