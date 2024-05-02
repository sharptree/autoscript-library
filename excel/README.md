# Introduction
Maximo provides the ability to export a result set from the List tab, but it is limited to the columns included on the list, which can be quite limiting. The `SHARPTREE.EXCEL` script provides a flexible library for exporting MboSets and JDBC ResultSet objects to Excel and then provides functions to either download or email the resulting Excel workbook for the user.

# Inline Import
After deploying the `SHARPTREE.EXCEL` script, to include it into your script include the following two lines at the beginning of your script.  This will import the script directly into your current script inline with your other source.

```javascript
// Import the ScriptCache Java class.
ScriptCache = Java.type('com.ibm.tivoli.maximo.script.ScriptCache');

// Load the Excel library inline with the current script.
load({ script: ScriptCache.getInstance().getScriptInfo('SHARPTREE.EXCEL').getScriptSource(), name: 'SHARPTREE.EXCEL' });
```

The `ScriptCache = Java.type('com.ibm.tivoli.maximo.script.ScriptCache');` line imports the Maximo ScriptCache class so we can access the name and source for the `SHARPTREE.EXCEL` automation script.  The `load({ script: ScriptCache.getInstance().getScriptInfo('SHARPTREE.EXCEL').getScriptSource(), name: 'SHARPTREE.EXCEL' });` line loads the the `SHARPTREE.EXCEL` source inline with the current script.

# Imported Functions
The `SHARPTREE.EXCEL` script provides a function for exporting a Maximo MboSet or JDBC ResultSet, a function for sending a workbook as an email attachment and a function to download the workbook directly from the script request.

## exportSet
The `exportSet` function takes either a JDBC `java.sql.ResultSet` or a Maximo `psdi.mbo.MboSet` to export to an Excel spreadsheet and an `ExportOptions` Javascript object.

### ExportOptions
The `ExportOptions` provides options for how the workbook should be exported.

| Attribute       | Description                                                                             |
|:----------------|:---------------------------------------------------------------------------------------|
| sheetName       | The name of the sheet in the workbook. (optional)                                      |
| attributes      | A list of attributes to export from an MboSet.  Required when exporting an MboSet.     |
| autosize        | Auto size the column widths, defaults to `true` (optional)                             |
| boldHeaders     | Bold the header titles, defaults to `true` (optional)                                  |

#### Example ExportOptions
```
'sheetName': 'The workbook sheet name',
    'attributes': [
        'attribute1',
        'attribute2'
    ],
    'autosize': true,
    'boldHeaders' : false
```

## sendEmail
The `sendEmail` function takes a to email address, a from email address, a subject, a message and the exported workbook to attach to the email.  Optionally an attachment name can be provided, otherwise the attachment will be named as the MboSet name or the table of the first column in the ResultSet with `.xlsx` appended.

## downloadWorkbook
The `downloadWorkbook` function is intended to be invoked from a direct web request where the `request` implicit variable is available, however it can be invoked with an optional `com.ibm.tivoli.maximo.oslc.provider.OslcRequest` object manually provided.  

The function takes the workbook, an optional file name and an optional `com.ibm.tivoli.maximo.oslc.provider.OslcRequest` object.

# Examples

## Export Person Table and Download with MboSet.
``` javascript
// Import the ScriptCache Java class.
ScriptCache = Java.type('com.ibm.tivoli.maximo.script.ScriptCache');

// Load the Excel library inline with the current script.
load({ script: ScriptCache.getInstance().getScriptInfo('SHARPTREE.EXCEL').getScriptSource(), name: 'SHARPTREE.EXCEL' });


// Use the main function pattern
main();

function main(){
    // Define the MboSet variable.
    var personSet;
    try {
        // Get a reference to the PERSON MboSet.
        personSet = MXServer.getMXServer().getMboSet('PERSON', userInfo);

        // Call "exportSet" to export the MboSet to a workbook, then call "exportWorkbook" to download the workbook.
        downloadWorkbook(exportSet(personSet, {
            'sheetName': 'People',
            'attributes': [
                'personid',
                'displayname'
            ],
            'autosize': true,
        }), 'person.xlsx');
        return;
    } finally {
        personSet.close();
        personSet.cleanup();
    }
}

var scriptConfig = {
    'autoscript': 'SHARPTREE.EXCEL.PERSONEXPORT',
    'description': 'Sharptree excel export script.a',
    'version': '',
    'active': true,
    'logLevel': 'ERROR'
};

```

## Export Person Table and Email with JDBC
``` javascript
// Import the ScriptCache Java class.
ScriptCache = Java.type('com.ibm.tivoli.maximo.script.ScriptCache');

// Load the Excel library inline with the current script.
load({ script: ScriptCache.getInstance().getScriptInfo('SHARPTREE.EXCEL').getScriptSource(), name: 'SHARPTREE.EXCEL' });


// Use the main function pattern
main();

function main(){
    // Define the MboSet variable.
    var db = new DBShortcut();
    try {
        // Get a reference to the PERSON MboSet.
        db.connect(MXServer.getMXServer().getSystemUserInfo().getConnectionKey());
        var rs = db.executeQuery("select personid, displayname from person");
        
        // Call "exportSet" to export the MboSet to a workbook, then call "sendEmail" to download the workbook.        
        sendEmail(
            "demo_email@sharptree.io", 
            "maximo@sharptree.io", 
            "Export of Person Table", 
            "Jason,\n\nPlease find attached an export of the Maximo person table.\n\nRegards,\nMaximo", 
            exportSet(rs,{
            'sheetName': 'People',
            'autosize': true,}),
            'person.xlsx');

        downloadWorkbook(exportSet(personSet, {
            'sheetName': 'People',
            'autosize': true,
        }), 'person.xlsx');
        return;
    } finally {
        db.close();
    }
}

var scriptConfig = {
    'autoscript': 'SHARPTREE.EXCEL.PERSONEMAIL',
    'description': 'Sharptree excel export script.a',
    'version': '',
    'active': true,
    'logLevel': 'ERROR'
};

```

## Export Inspection Results
Using the VS Code Maximo Development Tools extension found here: [marketplace.visualstudio.com/items?itemName=sharptree.maximo-script-deploy](marketplace.visualstudio.com/items?itemName=sharptree.maximo-script-deploy)
 the `workorder.export.inspresult.js` script can be deployed and the companion `workorder.export.inspresult.deploy.js` script will automatically create the required Maximo Launch in Context configuration to enable exporting Work Order Tracking inspection results from the List or a single work order record.