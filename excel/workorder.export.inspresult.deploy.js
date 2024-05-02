MboConstants = Java.type("psdi.mbo.MboConstants");
MboSet = Java.type("psdi.mbo.MboSet");

SqlFormat = Java.type("psdi.mbo.SqlFormat");
MXServer = Java.type("psdi.server.MXServer");

install();

function install() {
    _setupLaunchInContext("WOTRACK", "EXPINSPRES", "/maximo/oslc/script/workorder.export.inspresult", "Export Inspection Result", "nav_icon_export.gif");

    var adminGroup = MXServer.getMXServer().lookup("MAXVARS").getString("ADMINGROUP", null);
    _addPermission(adminGroup, "WOTRACK", "EXPINSPRES");
}

function _setupLaunchInContext(app, name, url, description, icon) {
    var maxLaunchEntrySet;

    try {
        maxLaunchEntrySet = MXServer.getMXServer().getMboSet("MAXLAUNCHENTRY", MXServer.getMXServer().getSystemUserInfo());
        var sqlFormat = new SqlFormat("launchentryname = :1");
        sqlFormat.setObject(1, "MAXLAUNCHENTRY", "LAUNCHENTRYNAME", name);

        maxLaunchEntrySet.setWhere(sqlFormat.format());

        if (maxLaunchEntrySet.isEmpty()) {
            maxLaunchEntry = maxLaunchEntrySet.add();
            maxLaunchEntry.setValue("LAUNCHENTRYNAME", name);
            maxLaunchEntry.setValue("DISPLAYNAME", "Export work order inspection result");
            maxLaunchEntry.setValue("CONSOLEURL", url);
            maxLaunchEntry.setValue("TARGETWINDOW", "_blank");
            maxLaunchEntrySet.save();
        }

        _addSigOption(app, name, description, false, name);
        _setupToolbarMenu(app, name, icon);
    } finally {
        _close(maxLaunchEntrySet);
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

function _setupToolbarMenu(app, optionName, image) {
    var maxMenuSet;
    try {
        maxMenuSet = MXServer.getMXServer().getMboSet("MAXMENU", MXServer.getMXServer().getSystemUserInfo());

        var sqlFormat = new SqlFormat("moduleapp = :1 and menutype = :2 and keyvalue = :3");
        sqlFormat.setObject(1, "MAXMENU", "MODULEAPP", app);
        sqlFormat.setObject(2, "MAXMENU", "MENUTYPE", "APPTOOL");
        sqlFormat.setObject(3, "MAXMENU", "KEYVALUE", optionName);
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
            maxMenu.setValue("KEYVALUE", optionName);
            maxMenu.setValue("IMAGE", image);
            maxMenu.setValue("POSITION", newPosition);
            maxMenu.setValue("SUBPOSITION", "0");
            maxMenu.setValue("TABDISPLAY", "ALL");
            maxMenu.setValue("ELEMENTTYPE", "OPTION");
            maxMenuSet.save();
        }
    } finally {
        _close(maxMenuSet);
    }
}

function _addPermission(group, app, option) {
    service.log_info("Adding the " + option + " option for the " + app + " application to the " + group + " security group.");
    var appAuthSet;
    try {
        appAuthSet = MXServer.getMXServer().getMboSet("APPLICATIONAUTH", MXServer.getMXServer().getSystemUserInfo());

        // Query to see if the option has already been assigned to the group.
        var sqlFormat = new SqlFormat("groupname = :1 and app = :2 and optionname = :3");
        sqlFormat.setObject(1, "APPLICATIONAUTH", "GROUPNAME", group);
        sqlFormat.setObject(2, "APPLICATIONAUTH", "APP", app);
        sqlFormat.setObject(3, "APPLICATIONAUTH", "OPTIONNAME", option);

        appAuthSet.setWhere(sqlFormat.format());

        // If the group does not have the option then add it.
        if (appAuthSet.isEmpty()) {
            var appAuth = appAuthSet.add();
            appAuth.setValue("GROUPNAME", group);
            appAuth.setValue("APP", app, MboConstants.NOVALIDATION);
            appAuth.setValue("OPTIONNAME", option);

            appAuthSet.save();
            service.log_info("Added the " + option + " option for the " + app + " application to the " + group + " security group.");
            return true;
        } else {
            service.log_info("The " + option + " option for the " + app + " application to the " + group + " security group was already assigned, skipping.");
            return false;
        }
    } finally {
        _close(appAuthSet);
    }
}

function _close(set) {
    if (set) {
        set.cleanup();
        set.close();
    }
}

var scriptConfig = {
    "autoscript": "WORKORDER.EXPORT.INSPRESULT.DEPLOY",
    "description": "Export work order inspection results",
    "version": "1.0.0",
    "active": true,
    "logLevel": "ERROR"    
};
