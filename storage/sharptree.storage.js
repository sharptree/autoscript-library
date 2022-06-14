RESTRequest = Java.type("com.ibm.tivoli.oslc.RESTRequest");

String = Java.type("java.lang.String");
System = Java.type("java.lang.System");

HashMap = Java.type("java.util.HashMap");

DigestUtils = Java.type("org.apache.commons.codec.digest.DigestUtils");

SqlFormat = Java.type("psdi.mbo.SqlFormat");
MXServer = Java.type("psdi.server.MXServer");
MXLoggerFactory = Java.type("psdi.util.logging.MXLoggerFactory");

var logger = MXLoggerFactory.getLogger("maximo.script." + service.getScriptName());

var prefix = "SHARPTREE.STORAGE";

var isHttpRequest = typeof request != 'undefined';

var result;

main();

function main() {


    try {
        var store = validateAndGetStoreName();

        var configPath = validateAndGetConfigPath();

        log_debug("Got configuration name " + configPath);

        _initConfig(store);

        if (!isHttpRequest) {
            httpMethod = action;
        }

        switch (httpMethod) {
            case 'GET':
                var internalFilter = undefined;

                if (isHttpRequest) {
                    internalFilter = request.getQueryParam("filter");
                    if (!internalFilter && (typeof requestBody !== 'undefined')) {
                        var params = JSON.parse(requestBody);
                        internalFilter = params.filter;
                    }
                } else if (typeof filter != 'undefined') {
                    internalFilter = filter;
                }

                if (internalFilter) {
                    responseBody = filterResponse(internalFilter, store);
                    break;
                } else {
                    responseBody = read(configPath, store);
                    break;
                }
            case 'PUT':
                var internalContent = undefined;
                if (typeof content != 'undefined') {
                    internalContent = content;
                }

                if (isHttpRequest) {
                    internalContent = JSON.parse(requestBody);
                }
                responseBody = update(configPath, internalContent, store);
                break;
            case 'POST':

                var internalContent = undefined;
                var internalMustBeUnique = false;

                if (typeof content != 'undefined') {
                    internalContent = content;
                }
                if (typeof mustBeUnique != 'undefined') {
                    internalMustBeUnique = mustBeUnique;
                }

                if (isHttpRequest) {
                    internalContent = JSON.parse(requestBody);
                    internalMustBeUnique = request.getQueryParam("unique")

                    if (internalContent._action && internalContent._action.toLowerCase() == 'delete') {
                        responseBody = remove(configPath, store);
                        break;
                    }
                }

                responseBody = create(configPath, internalContent, store, internalMustBeUnique);
                break;
            case 'DELETE':
                responseBody = remove(configPath, store);
                break;
            default:
                if (isHttpRequest) {
                    log_error('The configuration automation script does not support the HTTP method ' + httpMethod + ', supportted HTTP methods are GET, PUT, POST and DELETE.');
                    throw new ConfigError('unhandled_method', 'The configuration automation script does not support the HTTP method ' + httpMethod + ', support HTTP methods are GET, PUT, POST and DELETE.');
                } else {
                    log_error('The configuration automation script does not support the action ' + httpMethod + ', support actions are GET, PUT, POST and DELETE.');
                    throw new ConfigError('unhandled_method', 'The configuration automation script does not support the action ' + httpMethod + ', supported actions are GET, PUT, POST and DELETE.');
                }
        }

        if (!isHttpRequest) {
            result = JSON.parse(responseBody);
        }

    } catch (error) {
        var response = {};
        response.status = 'error';
        if (error instanceof Error) {
            response.message = error.message;
        } else if (error instanceof ConfigError) {
            response.message = error.message;
            response.reason = error.reason;
        } else {
            response.cause = error;
        }
        service.log_error("An error occurred " + error);
        responseBody = JSON.stringify(response);

        if (isHttpRequest) {
            responseBody = JSON.stringify(response);
            return;
        } else {
            result = response;
            return;
        }
    }
}

function validateAndGetStoreName() {
    if (isHttpRequest) {
        var store = request.getQueryParam("store");

        if (!store && (typeof requestBody !== 'undefined')) {
            var params = JSON.parse(requestBody);
            store = params.store;
        }
    }

    if (!store) {
        return prefix + ".CONFIGURATION"
    } else {
        if (store.contains(".")) {
            return store.toUpperCase();
        } else {
            return prefix + "." + store.toUpperCase();
        }
    }
}

function filterResponse(filter, store) {

    filter = filter.toUpperCase();
    if (!filter.contains(".")) {
        filter = prefix + "." + filter;
    }

    var scriptSet;

    try {
        scriptSet = MXServer.getMXServer().getMboSet("AUTOSCRIPT", userInfo);
        var sqlf = new SqlFormat("autoscript = :1");
        sqlf.setObject(1, "AUTOSCRIPT", "AUTOSCRIPT", filter);
        scriptSet.setWhere(sqlf.format());

        if (scriptSet.isEmpty()) {
            throw new ConfigError("missing_filter", "The filter " + filter + " is not available.");
        }

        var filterScript = service.invokeScript(filter);

        if (typeof filterScript.filter === 'function') {
            return filterScript.filter(service, userInfo, store);
        } else {
            throw new ConfigError("filter_does_not_implement_filter", "The filter " + filter + " does not implement the filter(service, userInfo, store) function.");
        }

    } finally {
        _close(scriptSet);
    }
}

function validateAndGetConfigPath() {
    if (isHttpRequest) {
        if (typeof httpMethod == 'undefined') {
            throw new ConfigError('missing_http_method', 'The configuration automation script must be invoked from an Http request and the httpMethod must be available.')
        }

        if (typeof request == 'undefined') {
            throw new ConfigError('missing_oslc_request', 'The configuration automation script must be invoked from an Http request and the OSLC request object must be available.');
        }


        if (httpMethod == "PUT" || httpMethod == 'POST') {
            if (typeof requestBody == 'undefined') {
                throw new ConfigError('missing_request_body', 'The configuration automation script request body cannot be empty for POST and PUT actions.');
            }
        }

        var field = RESTRequest.class.getDeclaredField("request");
        field.setAccessible(true);
        var httpRequest = field.get(request);

        var requestURI = httpRequest.getRequestURI();
        var contextPath = httpRequest.getContextPath();
        var resourceReq = requestURI;

        if (contextPath && contextPath !== '') {
            resourceReq = requestURI.substring(contextPath.length());
        }

        if (!resourceReq.startsWith("/")) {
            resourceReq = "/" + resourceReq;
        }

        if (!resourceReq.toUpperCase().startsWith('/OSLC/SCRIPT/' + service.scriptName.toUpperCase())) {
            throw new ConfigError('invalid_script_invocation', 'The configuration automation script must be invoked as an HTTP OSLC script request in the form of /oslc/script/' + service.scriptName + ' .');
        }

        var baseReqPath = '/oslc/script/' + service.scriptName;

        var path = resourceReq.substring(baseReqPath.length);
        if (path.startsWith("/")) {
            path = path.substring(1);
        }

        // allow GET requests to have no name
        if (httpMethod !== 'GET' && (!path || path.trim() === '')) {
            throw new ConfigError('missing_configuration_name', 'The configuration automation script request must be in the form of ' + baseReqPath + '/{configuration-name}.');
        }
        return path;
    } else {
        if (action !== "GET" && (!path || path.trim() === '')) {
            throw new ConfigError('missing_configuration_name', 'The configuration automation script must be invoked with the "path" variable for all actions other than "GET".');
        }
        return path;
    }
}

function _initConfig(store) {
    var autoScriptSet;
    try {
        autoScriptSet = MXServer.getMXServer().getMboSet("AUTOSCRIPT", MXServer.getMXServer().getSystemUserInfo());
        var sqlf = new SqlFormat("autoscript = :1");
        sqlf.setObject(1, "AUTOSCRIPT", "AUTOSCRIPT", store);
        autoScriptSet.setWhere(sqlf.format());

        if (autoScriptSet.isEmpty()) {
            var autoscript = autoScriptSet.add();
            autoscript.setValue("AUTOSCRIPT", store);
            autoscript.setValue("DESCRIPTION", "Storage Automation Script");
            autoscript.setValue("SCRIPTLANGUAGE", "javascript");
            autoscript.setValue("SOURCE", "config={};");
            autoScriptSet.save();
        }


    } finally {
        _close(autoScriptSet);
    }
}

function _saveConfig(config, store) {
    log_debug("saving configuration");
    var autoScriptSet;
    try {
        autoScriptSet = MXServer.getMXServer().getMboSet("AUTOSCRIPT", MXServer.getMXServer().getSystemUserInfo());
        var sqlf = new SqlFormat("autoscript = :1");
        sqlf.setObject(1, "AUTOSCRIPT", "AUTOSCRIPT", store);
        autoScriptSet.setWhere(sqlf.format());

        if (autoScriptSet.isEmpty()) {
            throw ConfigError('missing_config', 'The configuration automation script ' + store + ' does not exist.');
        } else {
            var autoscript = autoScriptSet.getMbo(0);

            var orderedConfig = Object.keys(config).sort().reduce(
                function (obj, key) {
                    obj[key] = config[key];
                    return obj;
                }, {}
            );

            autoscript.setValue("SOURCE", "config=" + JSON.stringify(orderedConfig, null, 4) + ";");

            autoScriptSet.save();
        }

    } finally {
        _close(autoScriptSet);
    }
}

function create(name, config, store, mustBeUnique) {

    var serverConfig = service.invokeScript(store).config;

    if (mustBeUnique && serverConfig[name]) {
        throw new ConfigError("config_exists", 'The ' + name + ' configuration already exists and must be unique.');
    }

    serverConfig[name] = config;

    try {
        _saveConfig(serverConfig, store);
    } catch (error) {
        if (error instanceof Java.type("psdi.util.MXException")) {
            // if the error is that a record has been updated by another user then try again because we are inserting a new block.
            if (error.getErrorGroup() == "system" && error.getErrorKey() == "rowupdateexception") {
                create(name, config);
            }
        }
    }

    var result = { "status": "success" };
    return JSON.stringify(result, null, 4);
}

function list(store) {
    var config = service.invokeScript(store).config

    if (typeof config === 'undefined') {
        throw new ConfigError('missing_config', "The config variable does not does not exists in the " + store + " store.");
    }

    var keys = Object.keys(config);

    return JSON.stringify(keys, null, 4);
}

function read(name, store) {
    var config = service.invokeScript(store).config

    if (name) {

        var result = config[name];

        if (typeof result === 'undefined') {
            throw new ConfigError('missing_config', 'The key name ' + name + ' does not exists in the configuration.');
        }
        return JSON.stringify(result, null, 4);
    } else {
        return list(store);
    }
}

function update(name, config, store) {

    if (typeof config == 'undefined') {
        throw new ConfigError('undefined_config', 'The configuration value for the configuration path ' + name + ' was not provided, if you want to delete a value, use the DELETE HTTP Method or action variable.');
    }

    var serverConfig = service.invokeScript(store).config
    var result = serverConfig[name];

    if (typeof result === 'undefined') {
        throw new ConfigError('missing_config', 'The configuration path ' + name + ' does not exists in the configuration.');
    }

    var preSignature = _calculateSignature(result);

    delete serverConfig[name];

    serverConfig[name] = config;

    try {
        _saveConfig(serverConfig, store);
    } catch (error) {
        if (error instanceof Java.type("psdi.util.MXException")) {
            // if the error is that a record has been updated by another user then try again if the block we're saving wasn't modified.
            if (error.getErrorGroup() == "system" && error.getErrorKey() == "rowupdateexception") {

                var checkServerConfig = service.invokeScript(store).config
                var checkResult = checkServerConfig[name];

                if (typeof checkResult === 'undefined') {
                    throw new ConfigError('missing_config', 'The key name ' + name + ' does not exists in the configuration.');
                }

                //if the part that we are updating hasn't changed then go ahead and try again.
                if (_calculateSignature(checkResult) === preSignature) {
                    update(name, config);
                }
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    }

    var result = { "status": "success" };
    return JSON.stringify(result, null, 4);
}

// used remove because delete is a reserved word.
function remove(name, store) {
    var serverConfig = service.invokeScript(store).config
    var result = serverConfig[name];

    if (typeof result === 'undefined') {
        throw new ConfigError('missing_config', 'The key name ' + name + ' does not exists in the configuration.');
    }

    delete serverConfig[name];

    try {
        _saveConfig(serverConfig, store);
    } catch (error) {
        if (error instanceof Java.type("psdi.util.MXException")) {
            // if the error is that a record has been updated by another user then try again because we are removing the block
            if (error.getErrorGroup() == "system" && error.getErrorKey() == "rowupdateexception") {
                remove(name);
            }
        }
    }

    var result = { "status": "success" };
    return JSON.stringify(result, null, 4);
}

function _calculateSignature(config) {
    // This is the ES5 version of Object.assign since Nashorn is not ES6 compatible.
    var evalConfig = JSON.parse(JSON.stringify(config))

    // remove an existing signature so it isn't included in the hash
    delete evalConfig.signature;
    return DigestUtils.shaHex(JSON.stringify(evalConfig, null, 4));
}

function ConfigError(reason, message) {
    Error.call(this, message)
    this.reason = reason;
    this.message = message;
}

// ConfigurationError derives from Error
ConfigError.prototype = Object.create(Error.prototype);
ConfigError.prototype.constructor = ConfigError;

// Cleans up the MboSet connections and closes the set.
function _close(set) {
    if (set) {
        set.cleanup();
        set.close();
    }
}

// Logging functions provided for compatibility with older versions where service.log_xxxx is not available.
function log_debug(msg) {
    logger.debug(msg);
}

function log_info(msg) {
    logger.info(msg);
}

function log_warn(msg) {
    logger.warn(msg);
}

function log_error(msg) {
    logger.error(msg);
}

var scriptConfig = {
    "autoscript": "SHARPTREE.STORAGE",
    "description": "Script to store data in an automation script",
    "version": "1.0.0",
    "active": true,
    "logLevel": "ERROR"
};