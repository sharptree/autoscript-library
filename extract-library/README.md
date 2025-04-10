# Introduction
To develop Java customizations for Maximo or to examine the Maximo business objects API, the library Jar files for the business objects and web components are required. In the case of developing Java customizations, these Jar files must be on the classpath for the development environment and therefore must be available on the local development environment.

In Maximo 7.6 and prior, it was a simple matter of copying the files from the server to the local environment. However, in Maximo Application Suite, developers may not have access to the underlying infrastructure and therefore cannot copy the files from the Pod to their local development environment. The `EXTRACT.LIBRARY` automation script, finds the main libraries for Maximo development (businessobject.jar, renamed asset-management.jar for consistency), the webclient.jar, which is the classes in the Maximo UI Web `WEB-INF/classes` folder jarred, and the commonweb.jar, then zips them into a single file and delivers the file to the requesting client.


# Install
The `EXTRACT.LIBRARY` script contains the `scriptConfig` deployment variable used by Sharptree's deployment tools.  If you use our VS Code extension, deploying the script will automatically create the script with the name `EXTRACT.LIBRARY`.

> The VS Code extension and documentation can be found here [https://marketplace.visualstudio.com/items?itemName=sharptree.maximo-script-deploy](https://marketplace.visualstudio.com/items?itemName=sharptree.maximo-script-deploy)

# Usage
To download the Maximo development library jars, simply log into Maximo then navigate to the https://[hostname]/maximo/oslc/script/extract.library.  The script will take about 30 seconds to create the file and then will download it directly from the browser.
