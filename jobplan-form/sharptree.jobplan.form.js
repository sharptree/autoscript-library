SqlFormat = Java.type("psdi.mbo.SqlFormat");
MboConstants = Java.type("psdi.mbo.MboConstants");

MXServer = Java.type("psdi.server.MXServer");
StringArrayType = Java.type("java.lang.String[]");
System = Java.type("java.lang.System");

var JOB_PLAN = "";

// Green
var POSITIVE_COLOR = "#C8F08F";

// Red
var NEGATIVE_COLOR = "#FFD2DD";

// Smile
var POSITIVE_ICON = "social:mood";

// Frown
var NEGATIVE_ICON = "social:mood-bad";

var POSITIVE_DESCRIPTION = "Done";
var NEGATIVE_DESCRIPTION = "Not Done";

var activateOnDeploy = false;

main();

/**
 * Main entry point for the script.
 */
function main() {
    if (typeof request != "undefined") {
        var qJobPlan = request.getQueryParam("jp");
        if (qJobPlan) {
            JOB_PLAN = qJobPlan;
        }
        var qPositiveColor = request.getQueryParam("pc");
        if (qPositiveColor) {
            POSITIVE_COLOR = qPositiveColor;
        }
        var qPositiveDescription = request.getQueryParam("pd");
        if (qPositiveDescription) {
            POSITIVE_DESCRIPTION = qPositiveDescription;
        }

        var qPositiveIcon = request.getQueryParam("pi");
        if (qPositiveIcon) {
            POSITIVE_ICON = qPositiveIcon;
        }
        var qNegativeColor = request.getQueryParam("nc");
        if (qNegativeColor) {
            NEGATIVE_COLOR = qNegativeColor;
        }
        var qNegativeDescription = request.getQueryParam("nd");
        if (qNegativeDescription) {
            NEGATIVE_DESCRIPTION = qNegativeDescription;
        }
        var qNegativeIcon = request.getQueryParam("ni");
        if (qNegativeIcon) {
            NEGATIVE_ICON = qNegativeIcon;
        }

        activateOnDeploy = request.getQueryParam("activate") == "true";

        if (!JOB_PLAN) {
            responseBody = JSON.stringify(
                { "status": "error", "description": "A job plan number was not provided, please provide a 'jp' query parameter." },
                null,
                4
            );
        } else {
            responseBody = convertJobPlan(JOB_PLAN);
        }
    } else {
        
        if (typeof mbo !== "undefined" && mbo.isBasedOn("JOBPLAN")) {
        
            var result = JSON.parse(convertJobPlan(mbo.getString("JPNUM")));
            var session = service.webclientsession();
            
            if (session) {
                var args = new StringArrayType(1);
                args[0] = result.form;
                session.showMessageBox("jobplan", "createForm", args);
            }
        } else if (JOB_PLAN) {
            convertJobPlan(JOB_PLAN);
        }
    }
}

/**
 * Creates a new inspection form for the provided job plan number.  The latest revision of the job plan is used.
 * @param {java.lang.String} jobPlan the job plan number.
 * @returns A JSON String with the script results.
 */
function convertJobPlan(jobPlan) {
   
    var jobPlanSet;
    try {
        jobPlanSet = MXServer.getMXServer().getMboSet("JOBPLAN", MXServer.getMXServer().getSystemUserInfo());
        var sqlf = new SqlFormat("jpnum = :1 ");
        sqlf.setObject(1, "JOBPLAN", "JPNUM", jobPlan);

        jobPlanSet.setWhere(sqlf.format());
        jobPlanSet.setOrderBy("PLUSCREVNUM desc");
        if (!jobPlanSet.isEmpty()) {
            var jobPlan = jobPlanSet.moveFirst();
            System.out.println("+++++ " + jobPlan.getString("PLUSCREVNUM"));
            var inspectionForm = createFormFromJobPlan(jobPlan);
            return JSON.stringify(
                {
                    "status": "success",
                    "description": "Inspection form " + inspectionForm + " was created for job plan " + JOB_PLAN + ".",
                    "form": inspectionForm,
                },
                null,
                4
            );
        } else {
            return JSON.stringify({ "status": "error", "description": "Job plan " + JOB_PLAN + " not found." }, null, 4);
        }
    } finally {
        _close(jobPlanSet);
    }
}

/**
 * Creates an inspection form from the provided Job Plan Mbo object.
 * @param {psdi.mbo.Mbo} jobPlan the Job Plan Mbo object.
 * @returns the inspection form number if successful.
 */
function createFormFromJobPlan(jobPlan) {
    var inspectionFormSet;
    var inspQuestionSet;

    try {
        inspectionFormSet = MXServer.getMXServer().getMboSet("INSPECTIONFORM", MXServer.getMXServer().getSystemUserInfo());
        inspectionFormSet.setOrderBy("inspformnum, revision desc");

        var sqlf = new SqlFormat("name = :1 and hasrevision = :no and (status = :2 or status = :3) ");
        sqlf.setObject(1, "INSPECTIONFORM", "NAME", jobPlan.getString("DESCRIPTION"));
        sqlf.setObject(2, "INSPECTIONFORM", "STATUS", "ACTIVE");
        sqlf.setObject(3, "INSPECTIONFORM", "STATUS", "INACTIVE");

        inspectionFormSet.setWhere(sqlf.format());
        var inspectionForm;
        if (inspectionFormSet.isEmpty()) {
            sqlf.setObject(2, "INSPECTIONFORM", "STATUS", "PNDREV");
            sqlf.setObject(3, "INSPECTIONFORM", "STATUS", "DRAFT");

            inspectionFormSet.setWhere(sqlf.format());
            inspectionFormSet.reset();
            if (inspectionFormSet.isEmpty()) {
                inspectionForm = inspectionFormSet.add();

                inspectionForm.setValue("NAME", jobPlan.getString("DESCRIPTION"));
            } else {
                inspectionForm = inspectionFormSet.moveFirst();
            }
        } else {
            var sourceInspectionForm = inspectionFormSet.moveFirst();
            sourceInspectionForm.setValue("HASREVISION", true);
            inspectionForm = sourceInspectionForm.initRevision();
        }

        var inspectionFormNumber = inspectionForm.getString("INSPFORMNUM");

        inspectionForm.setValue("TYPE", "Inspection");
        inspectionForm.setValue("DESCRIPTION_LONGDESCRIPTION", jobPlan.getString("DESCRIPTION_LONGDESCRIPTION"));

        var formNum = inspectionForm.getString("INSPFORMNUM");
        var revision = inspectionForm.getInt("REVISION");

        inspQuestionSet = inspectionForm.getMboSet("INSPQUESTION");

        inspQuestionSet.deleteAll();

        var jobTaskSet = jobPlan.getMboSet("JOBTASK");
        jobTaskSet.setOrderBy("tasksequence, jptask");

        var jobTask = jobTaskSet.moveFirst();

        var sequence = 0;
        while (jobTask) {
            sequence++;
            if (jobTask.isNull("NESTEDJPNUM")) {
                var inspQuestion = inspQuestionSet.add();
                inspQuestion.setValue("INSPFORMNUM", formNum);
                inspQuestion.setValue("REVISION", revision);
                inspQuestion.setValue("DESCRIPTION", jobTask.getString("DESCRIPTION"));
                inspQuestion.setValue("SEQUENCE", sequence);
                inspQuestion.setValue("GROUPSEQ", sequence);

                createInspectionField(inspQuestion);
                if(!jobTask.isNull("METERNAME")){
                    var meterName = jobTask.getString("METERNAME");
                    var meterType = jobTask.getMboSet("$meter","METER","metername=:metername").moveFirst().getString("METERTYPE");
                    createMeterField(inspQuestion, meterName, meterType);
                }
            } else {
                var childJobTaskSet = jobTask.getMboSet("JOBPLAN").moveFirst().getMboSet("JOBTASK");
                var childJobTask = childJobTaskSet.moveFirst();

                while (childJobTask) {
                    var inspQuestion = inspQuestionSet.add();
                    inspQuestion.setValue("INSPFORMNUM", formNum);
                    inspQuestion.setValue("REVISION", revision);
                    inspQuestion.setValue("DESCRIPTION", childJobTask.getString("DESCRIPTION"));
                    inspQuestion.setValue("SEQUENCE", sequence);
                    inspQuestion.setValue("GROUPSEQ", sequence);
                    createInspectionField(inspQuestion);
                    if(!childJobTask.isNull("METERNAME")){
                        var meterName = childJobTask.getString("METERNAME");
                        var meterType = childJobTask.getMboSet("$meter","METER","metername=:metername").moveFirst().getString("METERTYPE");
                        createMeterField(inspQuestion, meterName, meterType);
                    }
                    childJobTask = childJobTaskSet.moveNext();
                }
            }
            jobTask = jobTaskSet.moveNext();
        }

        if (inspectionFormSet) {
            if (typeof activateOnDeploy !== "undefined" && activateOnDeploy) {
                var id = inspectionForm.getUniqueIDValue();

                inspectionFormSet.save();

                _close(inspectionFormSet);

                inspectionFormSet = MXServer.getMXServer().getMboSet("INSPECTIONFORM", userInfo);
                inspectionForm = inspectionFormSet.getMboForUniqueId(id);

                inspectionForm.changeFormStatus("ACTIVE");

                inspectionFormSet.save();
            } else {
                inspectionFormSet.save();
            }            
        }

        return inspectionFormNumber;
    } finally {
        _close(inspectionFormSet);
    }
}

/**
 * Creates a new inspection field for the inspection question.
 * @param {psdi.mbo.Mbo} inspQuestion the inspection question Mbo object.
 */
function createInspectionField(inspQuestion) {
    var inspFieldSet = inspQuestion.getMboSet("INSPFIELD");

    var inspField = inspFieldSet.add();
    inspField.setValue("INSPFORMNUM", inspQuestion.getString("INSPFORMNUM"));
    inspField.setValue("REVISION", inspQuestion.getString("REVISION"));
    inspField.setValue("INSPQUESTIONNUM", inspQuestion.getString("INSPQUESTIONNUM"));
    inspField.setValue("FIELDTYPE", "SO");
    inspField.setValue("DESCRIPTION", inspQuestion.getString("DESCRIPTION"));
    inspField.setValue("SEQUENCE", 1);
    inspField.setValue("REQUIRED", false);
    inspField.setValue("VISIBLE", true);

    var inspFieldOptionSet = inspField.getMboSet("INSPFIELDOPTION");

    var inspFieldOption = inspFieldOptionSet.add();

    inspFieldOption.setValue("INSPFORMNUM", inspQuestion.getString("INSPFORMNUM"));
    inspFieldOption.setValue("REVISION", inspQuestion.getString("REVISION"));
    inspFieldOption.setValue("INSPQUESTIONNUM", inspQuestion.getString("INSPQUESTIONNUM"));
    inspFieldOption.setValue("INSPFIELDNUM", inspField.getString("INSPFIELDNUM"));
    inspFieldOption.setValue("SEQUENCE", 1);
    inspFieldOption.setValue("DESCRIPTION", POSITIVE_DESCRIPTION);
    inspFieldOption.setValue("COLOR", POSITIVE_COLOR);
    inspFieldOption.setValue("ICON", POSITIVE_ICON);

    inspFieldOption = inspFieldOptionSet.add();

    inspFieldOption.setValue("INSPFORMNUM", inspQuestion.getString("INSPFORMNUM"));
    inspFieldOption.setValue("REVISION", inspQuestion.getString("REVISION"));
    inspFieldOption.setValue("INSPQUESTIONNUM", inspQuestion.getString("INSPQUESTIONNUM"));
    inspFieldOption.setValue("INSPFIELDNUM", inspField.getString("INSPFIELDNUM"));
    inspFieldOption.setValue("SEQUENCE", 2);
    inspFieldOption.setValue("DESCRIPTION", NEGATIVE_DESCRIPTION);
    inspFieldOption.setValue("COLOR", NEGATIVE_COLOR);
    inspFieldOption.setValue("ICON", NEGATIVE_ICON);    
}

/**
 * Adds a meter inspection field to the inspection question.
 * @param {*} inspQuestion the inspection question to add the meter to.
 * @param {java.lang.String} meterName the meter name.
 * @param {java.lang.String} meterType  the meter type.
 */
function createMeterField(inspQuestion, meterName, meterType){
    var inspFieldSet = inspQuestion.getMboSet("INSPFIELD");

    var inspField = inspFieldSet.add();
    inspField.setValue("INSPFORMNUM", inspQuestion.getString("INSPFORMNUM"));
    inspField.setValue("REVISION", inspQuestion.getString("REVISION"));
    inspField.setValue("INSPQUESTIONNUM", inspQuestion.getString("INSPQUESTIONNUM"));
    inspField.setValue("FIELDTYPE", "MM");
    inspField.setValue("DESCRIPTION", "Record " + meterName);
    inspField.setValue("METERNAME", meterName);
    inspField.setValue("METERTYPE", meterType);
    inspField.setValue("SEQUENCE", 2);
    inspField.setValue("REQUIRED", false);
    inspField.setValue("VISIBLE", true);
}


/**
 * Creates the Create Inspection Form menu option for the Job Plan application.
 */
function _createMenu() {    
    _addSigOption("JOBPLAN", "CREATEFORM", "Create Inspection Form", true);    
    _addActionLaunchPoint("CREATEFORM", "Create Inspection Form", "SHARPTREE.JOBPLAN.FORM");
    _setupToolbarMenu("JOBPLAN", "CREATEFORM");    
    _addOrUpdateMessage("BMXZZ", "I", "jobplan", "createForm", "MSGBOX", 2, "Inspection form {0} created.");    
}

function _addOrUpdateMessage(prefix, suffix, group, key, displayMethod, options, message) {    
    var maxMessageSet;
    try {
        maxMessageSet = MXServer.getMXServer().getMboSet("MAXMESSAGES", MXServer.getMXServer().getSystemUserInfo());

        sqlFormat = new SqlFormat("msgkey =:2 and msggroup=:3");

        sqlFormat.setObject(2, "MAXMESSAGES", "MSGKEY", key);
        sqlFormat.setObject(3, "MAXMESSAGES", "MSGGROUP", group);

        maxMessageSet.setWhere(sqlFormat.format());

        var maxMessage;

        if (maxMessageSet.isEmpty()) {
            service.log_info("Message with prefix " + prefix + ", group " + group + ", and key " + key + " does not exist, creating it.");
            maxMessage = maxMessageSet.add();
            maxMessage.setValue("MSGGROUP", group);
            maxMessage.setValue("MSGKEY", key);
        } else {
            service.log_info("Message with prefix " + prefix + ", group " + group + ", and key " + key + " exist, getting it to update.");
            maxMessage = maxMessageSet.getMbo(0);
        }

        maxMessage.setValue("DISPLAYMETHOD", displayMethod);
        maxMessage.setValue("MSGIDSUFFIX", suffix);
        maxMessage.setValue("MSGIDPREFIX", prefix);
        
        

        if (options == 28) {
            maxMessage.setValue("YES", true);
            maxMessage.setValue("NO", true);
            maxMessage.setValue("CANCEL", true);
            maxMessage.setValue("OK", false);
        } else {
            maxMessage.setValue("OPTIONS", options);
        }

        maxMessage["setValue(String, String)"]("VALUE", message);

        maxMessageSet.save();
    } finally {
        _close(maxMessageSet);
    }
}

function _addActionLaunchPoint(action, description, script) {
    var autoScriptSet;

    try {
        autoScriptSet = MXServer.getMXServer().getMboSet("AUTOSCRIPT", MXServer.getMXServer().getSystemUserInfo());
        var sqlf = new SqlFormat("autoscript = :1");
        sqlf.setObject(1, "AUTOSCRIPT", "AUTOSCRIPT", script);

        autoScriptSet.setWhere(sqlf.format());

        var autoscript = autoScriptSet.moveFirst();

        if (autoscript) {
            var autoScriptId = autoscript.getUniqueIDValue();

            scriptLaunchPointSet = autoscript.getMboSet("SCRIPTLAUNCHPOINT");
            scriptLaunchPointSet.deleteAll();

            autoScriptSet.save();

            //Refetch the auto script
            autoScriptSet.reset();
            autoscript = autoScriptSet.getMboForUniqueId(autoScriptId);

            var scriptLaunchPointSet = autoscript.getMboSet("SCRIPTLAUNCHPOINT");
            var scriptLaunchPoint = scriptLaunchPointSet.add();

            scriptLaunchPoint.setValue("LAUNCHPOINTNAME", action);
            scriptLaunchPoint.setValue("LAUNCHPOINTTYPE", "ACTION", MboConstants.NOACCESSCHECK);
            scriptLaunchPoint.setValue("ACTIVE", true);
            scriptLaunchPoint.setValue("DESCRIPTION", description);
            scriptLaunchPoint.setValue("ACTIONNAME", action);
            scriptLaunchPoint.setValue("OBJECTNAME", "JOBPLAN");
            autoScriptSet.save();
        }
    } finally {
        _close(autoScriptSet);
    }
}

function _addSigOption(app, optionName, description, withAction, launchEntry) {
    try {
        sigOptionSet = MXServer.getMXServer().getMboSet("SIGOPTION", MXServer.getMXServer().getSystemUserInfo());

        var sqlFormat = new SqlFormat("app = :1 and optionname = :2");
        sqlFormat.setObject(1, "SIGOPTION", "APP", app);
        sqlFormat.setObject(2, "SIGOPTION", "OPTIONNAME", optionName);

        sigOptionSet.setWhere(sqlFormat.format());

        if (sigOptionSet.isEmpty()) {
            var sigoption = sigOptionSet.add();
            sigoption.setValue("APP", app);
            sigoption.setValue("OPTIONNAME", optionName);
            sigoption.setValue("DESCRIPTION", description);
            sigoption.setValue("ESIGENABLED", false);
            sigoption.setValue("VISIBLE", true);

            if (withAction) {
                var sigOptionFlag = sigoption.getMboSet("SIGOPTFLAG").add();
                sigOptionFlag.setValue("OPTIONNAME", optionName);
                sigOptionFlag.setValue("APP", app);
                sigOptionFlag.setValue("FLAGNAME", "WFACTION");
            } else if (launchEntry) {
                var sigOptionFlag = sigoption.getMboSet("SIGOPTFLAG").add();
                sigOptionFlag.setValue("OPTIONNAME", optionName);
                sigOptionFlag.setValue("APP", app);
                sigOptionFlag.setValue("FLAGNAME", "LAUNCHENTRY");
                sigOptionFlag.setValue("VALUE", launchEntry);
            }

            sigOptionSet.save();
        }
    } finally {
        _close(sigOptionSet);
    }
}

function _setupToolbarMenu(app, option) {
    var maxMenuSet;
    try {
        maxMenuSet = MXServer.getMXServer().getMboSet("MAXMENU", MXServer.getMXServer().getSystemUserInfo());

        var sqlFormat = new SqlFormat("moduleapp = :1 and menutype = :2 and keyvalue = :3");
        sqlFormat.setObject(1, "MAXMENU", "MODULEAPP", app);
        sqlFormat.setObject(2, "MAXMENU", "MENUTYPE", "APPTOOL");
        sqlFormat.setObject(3, "MAXMENU", "KEYVALUE", option);
        maxMenuSet.setWhere(sqlFormat.format());

        if (maxMenuSet.isEmpty()) {
            sqlFormat = new SqlFormat("moduleapp = :1 and menutype = :2");
            sqlFormat.setObject(1, "MAXMENU", "MODULEAPP", app);
            sqlFormat.setObject(2, "MAXMENU", "MENUTYPE", "APPTOOL");
            maxMenuSet.setWhere(sqlFormat.format());
            maxMenuSet.setOrderBy("position desc");
            maxMenuSet.reset();

            var newPosition = maxMenuSet.moveFirst().getInt("POSITION") + 1;
            var maxMenu = maxMenuSet.add();
            maxMenu.setValue("MENUTYPE", "APPTOOL");
            maxMenu.setValue("MODULEAPP", app);
            maxMenu.setValue("KEYVALUE", option);
            maxMenu.setValue("POSITION", newPosition);
            maxMenu.setValue("SUBPOSITION", "0");
            maxMenu.setValue("TABDISPLAY", "MAIN");
            maxMenu.setValue("ELEMENTTYPE", "OPTION");
            maxMenu.setValue("IMAGE", "nav_icon_createfollowup.gif");

            maxMenuSet.save();
        }
    } finally {
        _close(maxMenuSet);
    }
}

function _close(set) {
    try {
        if (set) {
            set.close();
            set.cleanup();
        }
    } catch (ignore) {}
}

var scriptConfig={
    "autoscript": "SHARPTREE.JOBPLAN.FORM",
    "description": "Migrate Job Plan to Inspection",
    "version": "1.0.0",
    "active": true,
    "logLevel": "ERROR",
    "onDeploy": "_createMenu"
};