SqlFormat = Java.type("psdi.mbo.SqlFormat");
MboConstants = Java.type("psdi.mbo.MboConstants");
MXServer = Java.type("psdi.server.MXServer");
EventListener = Java.type("psdi.server.event.EventListener");

ObjectArray = Java.type("java.lang.Object[]")
System = Java.type("java.lang.System");

Date = Java.type("java.util.Date");
HashMap = Java.type("java.util.HashMap");

var BULLETIN_KEY = "CONFLICT_DETECTION";

// Set an email address to email the error details to.
var email;

/**
 * Implementation of the Maximo EventListener class to capture transaction details.
 */
Listener = Java.extend(EventListener, {
    eventValidate: function (event) {

        var eventName = event.getEventName();
        if (eventName == "maximo.txnend") {
            var b = MXServer.getMXServer().getBulletin();
            var userData = b.get(BULLETIN_KEY);
            if (userData) {
                userData[0].remove(event.getTxnId());
            }
        } else if (event && event.getEventObject() instanceof Java.type("psdi.mbo.Mbo")) {
            var txnId = event.getEventObject().getMXTransaction().getID();

            var b = MXServer.getMXServer().getBulletin();
            var userDataArray = b.get(BULLETIN_KEY);
            var userData = new HashMap();

            if (userDataArray) {
                userData = userDataArray[0];
            }

            var mboSets = userData.get(txnId);

            if (!mboSets) {
                mboSets = [];
            }

            mboSets.push(event.getEventObject())

            userData.put(txnId, mboSets);

            var array = [userData, new Date()];
            var objectArray = Java.to(array, ObjectArray);
            b.put(BULLETIN_KEY, objectArray);
        }

    },
    preSaveEventAction: function (event) {
    },
    eventAction: function (event) {
    },
    postCommitEventAction: function (event) {
    },
    toString: function () {
        return "RowUpdateExceptionHandler";
    }
});

/**
 * Call the main entry point for the script.
 */
main();


/**
 * The main function entry point for the script.
 */
function main() {
    try {

        var eventTopic = MXServer.getEventTopicTree().findEventTopic("maximo.*");
        var listener;
        var listeners = eventTopic.getListeners();

        listeners.forEach(function (key, value) {
            try {
                if (value.toString() == "RowUpdateExceptionHandler") {
                    listener = value;
                }
            } catch (ignored) {/** ignored error */ }
        });

        if (!listener) {
            MXServer.getEventTopicTree().register("maximo.*", new Listener());
            mxerrormsg = "\n\nA diagnostic listener has been added, retry the transaction to obtain error details.";
        }
        var b = MXServer.getMXServer().getBulletin();

        var userData = b.get(BULLETIN_KEY)[0];
        if (userData) {
            var conflictFound = false;
            userData.forEach(function (key, mboSets) {
                if (!conflictFound) {
                    mboSets.forEach(function (mbo) {

                        if (!conflictFound) {
                            var updatedMboSets = new HashMap();
                            var result = [];
                            var conflicts = identifyUpdateConflict(mbo, updatedMboSets, result);
                            if (conflicts.length > 0) {
                                conflictFound = true;
                                service.log_error("Record has been updated by another user details: \n" + JSON.stringify(conflicts, null, 4));
                                mxerrormsg = "\n\nRecord conflict details have been written to the Maximo log.";

                                listeners = eventTopic.getListeners();
                                listeners.forEach(function (key, value) {
                                    MXServer.getEventTopicTree().unregister("maximo.*", key);
                                });

                                b.remove(BULLETIN_KEY);

                                if (email) {
                                    MXServer.sendEMail(email, MXServer.getMXServer().getProperty("mxe.adminEmail"), "Record updated by another user error", "<html><pre>User " + mbo.getUserInfo().getUserName() + " encountered a record has been updated by another user error.\n\nDiagnostic Details: \n" + JSON.stringify(conflicts, null, 4) + "</pre></html>");
                                }
                            }
                        }
                    });
                }

            })
        }
    } catch (error) {
        service.log_error(error);
    }
}

/**
 * Identifies relationship with conflicting relationship updates.
 * @param {psdi.mbo.Mbo} thisMbo the current evaluated Maximo Business Object (Mbo).
 * @param {java.util.HashMpa} updatedMboSets a HashMap of related MboSets from the base Mbo.
 * @param {Array} result An array of conflict results.
 * @returns an array of conflicting modifications made through different Mbo relationships.
 */
function identifyUpdateConflict(thisMbo, updatedMboSets, result) {
    if (thisMbo && thisMbo instanceof Java.type("psdi.mbo.Mbo")) {
        var relatedSets = getRelatedMboSets(thisMbo);

        var relationships = [];

        if (relatedSets) {
            relatedSets.keySet().forEach(function (relationship) {
                relationships.push(relationship);
            })
        }

        relationships.forEach(function (relationship) {
            var mboSet = thisMbo.getExistingMboSet(relationship);

            if (mboSet) {
                var index = 0;
                var mbo = mboSet.getMbo(index);
                while (mbo) {

                    if (mbo.thisToBeUpdated()) {
                        var mboName = mboSet.getName();
                        if (mboSet.getMboSetInfo().getHierarchyList() != null) {
                            var mboName = mboSet.getMboSetInfo().getHierarchyList().get(0);
                        }
                        var modifiedAttributes = getModifiedAttributes(mbo);
                        var relationshipsInfo = mboSet.getMboSetInfo().getRelationsInfo();
                        var relationshipInfo;
                        while (relationshipsInfo.hasNext() && !relationshipInfo) {
                            var ri = relationshipsInfo.next();
                            if (ri.getName() == relationship) {
                                relationshipInfo = ri;
                            }
                        }

                        var updateDetails = {
                            "recordId": mbo.getRecordIdentifer(),
                            "relationship": relationship,
                            "parent": relationshipInfo ? relationshipInfo.getSrc() : mbo.getOwner().getName(),
                            "child": relationshipInfo ? relationshipInfo.getDest() : mboSet.getName(),
                            "modifiedAttributes": modifiedAttributes,
                            "stacktrace": stackTrace
                        }

                        if (updatedMboSets.containsKey(mboName)) {
                            var index = 0;
                            var existingResults = result.filter(function (result) {
                                index++;
                                return result.objectName == mboName
                            });

                            if (existingResults && existingResults.length > 0) {
                                var existingResult = existingResults[0];

                                var duplicate = false;

                                Object.keys(existingResult).forEach(function (key) {
                                    if (!duplicate && key.startsWith("objectDetails")) {
                                        var er = existingResult[key];
                                        duplicate = (er.recordId == updateDetails.recordId && er.parent == updateDetails.parent && er.child == updateDetails.child && er.relationship == updateDetails.relationship);
                                    }
                                });

                                if (!duplicate) {
                                    existingResult["objectDetails" + (Object.keys(existingResult).length)] = updateDetails;
                                }
                            } else {
                                result.push({
                                    "objectName": mboName,
                                    "objectDetails1": updateDetails
                                });
                            }
                        } else {
                            updatedMboSets.put(mboName, updateDetails);
                        }
                    }

                    identifyUpdateConflict(mbo, updatedMboSets, result);
                    try {
                        mbo = mboSet.getMbo(index++);
                    } catch (ignore) {
                        mbo = null;
                    }
                }
            }
        });

    }

    return result;
}

/**
 * Identifies the modified attributes on the provided Mbo.
 * @param {psdi.mbo.Mbo} thisMbo the current Mbo being evaluated.
 * @returns an array of modified attribute key value pairs.
 */
function getModifiedAttributes(thisMbo) {
    var values = thisMbo.getThisMboSet().getMboSetInfo().getMboValuesInfo();
    var result = [];
    while (values.hasMoreElements()) {
        var mv = thisMbo.getMboValue(values.nextElement().getName());
        if (mv.isModified()) {
            result.push(mv.getName() + " = " + mv.getString());
        }
    }

    return result;
}

/**
 * Gets the related MboSets for the provided Mbo. Uses reflection to break encapsulation.
 * @param {psdi.mbo.Mbo} thisMbo the current Mbo being evaluated.
 * @returns an array of relationships for the Mbo.
 */
function getRelatedMboSets(thisMbo) {
    if (thisMbo && thisMbo instanceof Java.type("psdi.mbo.Mbo")) {
        var evalClass = thisMbo.getClass();
        var method;
        while (evalClass) {
            var m = evalClass.getDeclaredMethods();
            for (var i = 0; i < m.length; i++) {
                if (m[i].getName() == "getRelatedSets") {
                    method = m[i];
                    break;
                }
            }
            if (method) {
                break;
            }
            evalClass = evalClass.getSuperclass();
        }
        if (method) {
            method.setAccessible(true);
            return method.invoke(thisMbo);
        } else {
            return null;
        }
    }
}


var scriptConfig = {
    "autoscript": "MXERR.SYSTEM.ROWUPDATEEXINFO",
    "description": "Row update exception handler",
    "version": "",
    "active": true,
    "logLevel": "ERROR"
};