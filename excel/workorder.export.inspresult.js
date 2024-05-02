// Import the ScriptCache Java class.
ScriptCache = Java.type("com.ibm.tivoli.maximo.script.ScriptCache");

// Load the Excel library inline with the current script.
load({ script: ScriptCache.getInstance().getScriptInfo("SHARPTREE.EXCEL").getScriptSource(), name: "SHARPTREE.EXCEL" });

main();


function main() {
    // only execute if we are running in the context of a direct web script invocation.
    if (typeof request !== "undefined") {
        // get the current web client session.
        var wcs;
        var session = request.getHttpServletRequest().getSession();
        var names = session.getAttributeNames();

        while (names.hasMoreElements()) {
            var name = names.nextElement();
            if (name.startsWith("webclientsession")) {
                wcs = session.getAttribute(name);
                break;
            }
        }

        // Return an error if the web client session was not found.
        if (!wcs) {
            responseBody = JSON.stringify({ "status": "error", "message": "Could not retrieve the current user WebClientSession." }, null, 4);
            return;
        }

        // Return an error if the current app cannot be determined.
        if (!wcs.getCurrentApp()) {
            responseBody = JSON.stringify(
                { "status": "error", "message": "Could not determine the current application from the user WebClientSession." },
                null,
                4
            );
            return;
        }

        // Get the DataBean to export, return an error if it cannot be found.
        var dataBean = wcs.getCurrentApp().getAppBean();
        if (!dataBean) {
            responseBody = JSON.stringify({ "status": "error", "message": "The app DataBean was not found." }, null, 4);
            return;
        }

        var onListTab = wcs.getCurrentApp().onListTab();

        if (onListTab) {
            // This is an arbitrary limitation that can be changed based on system capabilities.
            if (dataBean.getMboSet().count() > 10000) {
                responseBody = JSON.stringify(
                    { "status": "error", "message": "Cannot export more that 10,000 records, please reduce the size of the result set to export." },
                    null,
                    4
                );
                return;
            }
        }

        // Define the MboSet variable.
        var db = new DBShortcut();
        try {
            if (dataBean.getMbo() && dataBean.getMbo().isBasedOn("WORKORDER")) {
                var sql;
                // Get a reference to the PERSON MboSet.
                db.connect(MXServer.getMXServer().getSystemUserInfo().getConnectionKey());
                var workOrders = [];
                if (onListTab) {
                    var workOrderWhere = wcs.getCurrentApp().getDataBean("results_showlist").getMboSet().getCompleteWhere();

                    sql =
                        "SELECT r.REFERENCEOBJECTID AS wonum, f.DESCRIPTION AS Question,fr.ENTEREDBY ,fr.ENTEREDDATE ,fr.TXTRESPONSE, fr.TXTRESPONSE, fr.NUMRESPONSE , fr.DATERESPONSE " +
                        "FROM INSPFIELDRESULT fr " +
                        "JOIN INSPFIELD f ON f.INSPFIELDNUM  = fr.INSPFIELDNUM  " +
                        "JOIN INSPECTIONRESULT r ON r.RESULTNUM  = fr.RESULTNUM " +
                        "WHERE r.STATUS  = 'COMPLETED' AND f.FIELDTYPE !='FU'and r.REFERENCEOBJECTID  in (select wonum from workorder where " +
                        workOrderWhere +
                        ")" +
                        " AND r.SITEID = '" +
                        dataBean.getString("SITEID") +
                        "' " +
                        'ORDER  BY r.RESULTNUM, f."SEQUENCE" ';
                } else {
                    sql =
                        "SELECT r.REFERENCEOBJECTID AS wonum, f.DESCRIPTION AS Question,fr.ENTEREDBY ,fr.ENTEREDDATE , fr.TXTRESPONSE, fr.NUMRESPONSE , fr.DATERESPONSE " +
                        "FROM INSPFIELDRESULT fr " +
                        "JOIN INSPFIELD f ON f.INSPFIELDNUM  = fr.INSPFIELDNUM  " +
                        "JOIN INSPECTIONRESULT r ON r.RESULTNUM  = fr.RESULTNUM " +
                        "WHERE r.STATUS  = 'COMPLETED' AND f.FIELDTYPE !='FU'and r.REFERENCEOBJECTID  = '" +
                        dataBean.getString("WONUM") +
                        "' AND r.SITEID = '" +
                        dataBean.getString("SITEID") +
                        "' " +
                        'ORDER  BY r.RESULTNUM, f."SEQUENCE" ';
                }
          
                var rs = db.executeQuery(sql);

                downloadWorkbook(
                    exportSet(rs, {
                        "sheetName": "Inspection Results",
                        "autosize": true
                    }),
                    "inspection_results.xlsx"
                );
            }
            return;
        } finally {
            db.close();
        }
    }
}

var scriptConfig = {
    "autoscript": "WORKORDER.EXPORT.INSPRESULT",
    "description": "Export work order inspection results",
    "version": "1.0.0",
    "active": true,
    "logLevel": "ERROR"    
};
