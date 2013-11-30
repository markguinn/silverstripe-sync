Silverstripe Sync
=================

Sync selected models from a silverstripe installation with a client (usually a mobile
application).

See docs folder for setup examples.


Features
--------
- Any DataObject can be synced.
- Any set of fields, properties, or methods can be sent (not limited to the database).
- Sync can be bi-directional or one-way either direction.
- A single silverstripe install can have multiple configurations for syncing, in the case
  that a single database needs to power several apps or views of the data.
- Sync is based on LastEdited timestamp


Adapters
--------
- Sencha Touch 1.x
- Sencha Touch 2.x
- iOS CoreData
- Android Sync Adapter + Content Provider (usually wrapping a sqlite db)

NOTE: Both the iOS and Android adapters are missing functionality at present. Both do
downward syncing from the server but are missining the upward and bi-directional modes.


Developer(s)
------------
- Mark Guinn <mark@adaircreative.com>

Contributions welcome by pull request and/or bug report.
Please follow Silverstripe code standards.


License (MIT)
-------------
Copyright (c) 2013 Mark Guinn

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so, subject
to the following conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.