# Introduction
Outlook calendar invites are sent as multipart Multipurpose Internet Mail Extensions (MIME) messages with body in iCalendar format.  More information on the iCalendar format can be found at [https://icalendar.org/](https://icalendar.org/). The following script contains a function called `sendInvite` that takes a number of parameters to create and send the desired calendar invite. There is an additional internal function called `_getMailSession` that creates a JavaMail `Session` object that we will then use to send our multipart MIME message.  As covered in the previous post on JavaScript functions that can be found [here](https://sharptree.io/blog/2021/2021-11-03-js-functions/), prefixing the function with an underscore indicates it is an internal function and should not be called from outside the script.  

The script is well commented so if you are interested in the details they are there to be inspected, but for the purpose of this post we are going to skip that step.

# Invoking a Script

## Hardcoded Values
For this example we are going to create a new Automation Script named `SEND.INVITE`.  Once that is complete, we can call the `sendInvite` method from any other script where that is needed.  Starting with an example with hard coded values, here we are sending an invite to `jason@sharptree.io` from `noreply@sharptree.io` for a meeting that will occur on January 1st, 2022 at 3:00PM GMT, adjusted then to the user's local timezone.  As we covered in our post about invoking library scripts, which can be found [here](/blog/2021-11-29-js-invoke-library), we use the `service` implicit variable to load the script and then invoke the `sendInvite` function, passing in the required variables.

```javascript
SimpleDateFormat = Java.type("java.text.SimpleDateFormat")

// call the main function of this script.
main()

function main() {

    var f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
    f.setTimeZone(userInfo.getTimeZone())

    // this is a Date type, from an MBO you can Mbo.getDate("DATEATTRIBUTE")
    var startTime = f.parse("2022-01-01T13:00:00Z")
    var endTime = f.parse("2022-01-01T14:00:00Z")

    // test the sendInvite function with
    service.invokeScript("SEND.INVITE").sendInvite(
        userInfo,
        "noreply@sharptree.io",
        "jason@sharptree.io",
        "This is a meeting request",
        "Here are details about our meeting.",
        startTime,
        endTime
    );
}
```

## Work Order Values
A more realistic version of this is sending an invite based on a Maximo event and data. In the example below when a work order status is changed to `APPR` we send an invite to the owner with the start and end dates set to the target start and target end of the work order and the title and message from the description and long description respectively.  In Maximo we create a new Attribute Launch Point for the `WORKORDER` object and `STATUS` attribute with the following script. 

```javascript
// call the main function of this script.
main()

function main() {
    // Check that mbo is available and that it is a WORKORDER.
    if (typeof mbo !== 'undefined' && mbo.getName().equals('WORKORDER')) {        
        if (mbo.getString("STATUS").equals('APPR')) {
            // send if the target start,target finish and owner field have been set
            if (!mbo.isNull("TARGSTARTDATE") && !mbo.isNull("TARGCOMPDATE") && !mbo.isNull("OWNER")) {
                //if the owner has an email then send the invite.
                if (!mbo.isNull("OWNERPERSON.PRIMARYEMAIL")) {
                    // test the sendInvite function with
                    service.invokeScript("SEND.INVITE").sendInvite(
                        mbo.getUserInfo(),
                        "noreply@sharptree.io",
                        mbo.getString("OWNERPERSON.PRIMARYEMAIL"),
                        mbo.getString("DESCRIPTION"),
                        mbo.getString("DESCRIPTION_LONGDESCRIPTION"),
                        mbo.getDate("TARGSTARTDATE"),
                        mbo.getDate("TARGCOMPDATE")
                    );
                }
            }
        }
    }
}
```