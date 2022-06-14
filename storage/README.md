# Introduction
When developing solutions with automation scripts there are situations where you need to store configuration or state information that is more complex that can be comfortably provided with simple Maximo properties, but you may not want to add a custom table because of the down time requirements or other restrictions. 

This is a script that Sharptree developed to handle this case, providing simple REST and script invocation interfaces for creating, reading, updating and deleting (CRUD) complex data structures within an automation script. Not only does this approach provide a means to store complex configuration and state information, it also makes it portable by saving it as an automation script that can be viewed, copied and managed with standard Maximo tools.

# Store Name
## HTTP
The `sharptree.storage` script stores the information in one or more storage automation scripts as a JSON object named `config`.  The store name allows configuration or state information to be segregated into separate storage scripts, the default name is `sharptree.storage.configuration`. If a storage script does not exist, it will be created upon the first request for the store. To specify a non-default store name using an HTTP request you can provide a value for the `store` query parameter, such as `https://maximo.acme.com/maximo/oslc/scripts/sharptree.storage?store=mycustomstore`.  

## Script
When invoking the script as a library script, provide a value for the `store` script context variable.

```javascript
HashMap = Java.type("java.util.HashMap");

var ctx = new HashMap();
ctx.put("store", "mycustomstore");

service.invokeScript("sharptree.storage", ctx);
```

By default the `store` name is prefixed the `sharptree.storage.` to easily group and identify storage scripts, however if the `store` name contains a `.` character a storage script will be created using the exact name provided with no prefix.

# Storage Path
## HTTP
The storage path specifies an entry within the storage area defined by the `store` name. When using an HTTP request the path following `sharptree.storage` is used to identify the storage path, for example with `https://maximo.acme.com/maximo/oslc/scripts/sharptree.storage/example/one?store=mycustomstore` the value `example/one` defines the storage path within the `mycustomstore` storage area.

## SCript
When invoking the script as a library script, provide the `path` context variable.

```javascript
HashMap = Java.type("java.util.HashMap");

var ctx = new HashMap();
ctx.put("store", "mycustomstore");
ctx.put("path", "example/one");

service.invokeScript("sharptree.storage", ctx);
```

# Creating

## HTTP
To create a new value in a store using HTTP perform a POST with the JSON content to store. The query parameter `unique` may optionally be included to ensure the path is unique and not overwriting an existing value. If this is not specified, the POST will create the value if it does not exist or update it if it does.

As an example, performing a POST to `https://maximo.acme.com/maximo/oslc/scripts/sharptree.storage/example/one?store=mycustomstore` with the following value:

```json
{
    "value":"A stored value",
    "example": true
}
```

will create a new script named `mycustomstore` with the following value:

```json
config={
    "example/one": {
        "value": "A stored value",
        "example": true
    }
};
```

Performing a second POST to `https://maximo.acme.com/maximo/oslc/scripts/sharptree.storage/example/two?store=mycustomstore` with the following value:

```json
{
    "value":"A second stored value",
    "example": true
}
```

will create a new entry in the script named `mycustomstore` with the resulting following value:

```json
config={
    "example/one": {
        "value": "A stored value",
        "example": true
    },
    "example/two": {
        "value": "A second stored value",
        "example": true
    }
};
```

A JSON response is returned with a `status` value that indicates success with the value of `success` or an error with the value of `error` and a message describing the error condition.

```json
{
    "status": "success"
}
```

## Script
When invoking the script as a library script, provide the `path`, `store`, `action` and `content` as context variables. The `action` variable is set to `POST`, mirroring the HTTP request and the content is the stringified contents of the JSON object. The result can then be read from the context `result` variable.

```javascript
HashMap = Java.type("java.util.HashMap");

var content = {"value":"A stored value","example":true};

var ctx = new HashMap();
ctx.put("store", "mycustomstore");
ctx.put("path", "example/one");
ctx.put("action", "POST");
ctx.put("content", JSON.stringify(content));

service.invokeScript("sharptree.storage", ctx);

var result = ctx.get("result");

if(result.status == "success"){
    // do something on success
}else if (result.status == "error"){
    // do  something on error
}
```

# Reading
## HTTP
To read a value from the store use an HTTP GET request with the item path and optionally, the store query parameter. For example to read the first value that was created in the previous section, we would perform an HTTP GET for the following URL `https://maximo.acme.com/maximo/oslc/scripts/sharptree.storage/example/one?store=mycustomstore`, which will return the following value.

```json
{
    "value": "A stored value",
    "example": true
}
```

## Script
When invoking the script as a library script, provide the `path`, `store`, and `action` context variables, where the `action` variable has a value of `GET` to mirror the HTTP request. The result can then be read from the context `result` variable.

```javascript
HashMap = Java.type("java.util.HashMap");

var content = {"value":"A stored value","example":true};

var ctx = new HashMap();
ctx.put("store", "mycustomstore");
ctx.put("path", "example/one");
ctx.put("action", "GET");

service.invokeScript("sharptree.storage", ctx);

var result = ctx.get("result");

```
# Updating
## HTTP
Performing an update is very similar to create, but uses the `PUT` HTTP method.

As an example, performing a PUT to `https://maximo.acme.com/maximo/oslc/scripts/sharptree.storage/example/one?store=mycustomstore` with the following value:

```json
{
    "value":"Updated stored value",
    "example": true
}
```

will update the value with the with the storage path of `example/one` with the provided value, resulting in the following:

```json
config={
    "example/one": {
        "value": "Updated stored value",
        "example": true
    },
    "example/two": {
        "value": "A second stored value",
        "example": true
    }
};
```

A JSON response is returned with a `status` value that indicates success with the value of `success` or an error with the value of `error` and a message describing the error condition.

```json
{
    "status": "success"
}
```

If the provided path does not exist and error will be returned.

## Script
When invoking the script as a library script, provide the `path`, `store`, `action` and `content` as context variables. The `action` variable is set to `PUT`, mirroring the HTTP request and the content is the stringified contents of the JSON object. The result can then be read from the context `result` variable.

```javascript
HashMap = Java.type("java.util.HashMap");

var content = {"value":"Updated stored value","example":true};

var ctx = new HashMap();
ctx.put("store", "mycustomstore");
ctx.put("path", "example/one");
ctx.put("action", "PUT");
ctx.put("content", JSON.stringify(content));

service.invokeScript("sharptree.storage", ctx);

var result = ctx.get("result");

if(result.status == "success"){
    // do something on success
}else if (result.status == "error"){
    // do  something on error
}
```
# Deleting
## HTTP
To delete a stored value perform a `POST` HTTP request the with storage path, store and a body with the following JSON.  

```json
{
    "_action":"delete"
}
```
This is because Maximo explicitly does not support the `DELETE` HTTP method, so we have followed the example of the standard OSLC REST interface.

As with the other operations, a JSON response is returned with a `status` value that indicates success with the value of `success` or an error with the value of `error` and a message describing the error condition.

```json
{
    "status": "success"
}
```
## Script
When invoking the script as a library script, provide the `path`, `store` and `action`  as context variables. The `action` variable is set to `DELETE`, mirroring the HTTP request. The result can then be read from the context `result` variable.

```javascript
HashMap = Java.type("java.util.HashMap");

var ctx = new HashMap();
ctx.put("store", "mycustomstore");
ctx.put("path", "example/one");
ctx.put("action", "DELETE");

service.invokeScript("sharptree.storage", ctx);

var result = ctx.get("result");

if(result.status == "success"){
    // do something on success
}else if (result.status == "error"){
    // do  something on error
}
```