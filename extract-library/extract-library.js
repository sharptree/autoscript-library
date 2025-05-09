var ByteArrayOutputStream = Java.type("java.io.ByteArrayOutputStream");
var File = Java.type("java.io.File");
var FileInputStream = Java.type("java.io.FileInputStream");
var FileOutputStream = Java.type("java.io.FileOutputStream");

var InputStreamReader = Java.type("java.io.InputStreamReader");

var StandardCharsets = Java.type("java.nio.charset.StandardCharsets");

var Files = Java.type("java.nio.file.Files");
var FileVisitResult = Java.type("java.nio.file.FileVisitResult");
var Paths = Java.type("java.nio.file.Paths");
var SimpleFileVisitor = Java.type("java.nio.file.SimpleFileVisitor");

var JarEntry = Java.type("java.util.jar.JarEntry");
var JarFile = Java.type("java.util.jar.JarFile");
var JarOutputStream = Java.type("java.util.jar.JarOutputStream");

var ZipEntry = Java.type("java.util.zip.ZipEntry");
var ZipOutputStream = Java.type("java.util.zip.ZipOutputStream");

var MaximoOslcProviderServlet = Java.type("com.ibm.tivoli.maximo.oslc.provider.MaximoOslcProviderServlet");

var Mbo = Java.type("psdi.mbo.Mbo");

var Version = Java.type("psdi.util.Version");

var WebClientSession = Java.type("psdi.webclient.system.session.WebClientSession");

ByteArrayType = Java.type("byte[]");

var version = Version.majorVersion + "." + Version.minorVersion + "." + Version.modLevel + "." + Version.patch;

/**
 * Finds the business objects jar, the web client jar, and the common web jar and then processes them into a zip file.
 * The zip file is then sent to the requesting client as a response.
 *
 */

/**
 * Call the main function to enter the script.
 */
main();

/**
 * The main function for the script, provided so there is a single entry point to the script.
 */
function main() {
    // check if there is a request object
    var response = typeof request === "undefined" ? oslcRequest.getHttpServletResponse() : request.getHttpServletResponse();

    // throw an error if the request object is not available, meaning it wasn't called from a web request.
    if (response == null) {
        throw new Error("The script was not called from a valid context. The request object is not available.");
    }

    // set the buffer size to 0 to avoid buffering the response
    response.setBufferSize(0);
    // set the content type for a zip file
    response.setContentType("application/zip");
    // set the content disposition to attachment with a filename
    response.setHeader("content-disposition", 'attachment; filename="manage-' + version + '.zip"');

    // create a zip output stream to write the zip file to the response output stream
    var tempFile = File.createTempFile("tmpZip", ".zip"); // "" for suffix, null for default dir

    var zos = new ZipOutputStream(new FileOutputStream(tempFile));

    // collect the files to be zipped
    var files = [];
    files.push({ "name": "webclient-" + version + ".jar", "path": findWebClientJar() });
    files.push({ "name": "asset-management-" + version + ".jar", "path": findBusinessObjectsJar() });
    files.push({ "name": "commonweb-" + version + ".jar", "path": findCommonWeb() });

    // zip the files to the output stream
    zipFiles(zos, files);

    // flush the output stream to ensure all data is written
    zos.flush();

    // Clean up temporary files that might have been created during the process
    files.forEach(function (filePath) {
        if (filePath.path.startsWith(tmpPath)) {
            var file = new File(filePath.path);

            // implement a SimpleFileVisitor class to delete files and directories
            DeleteFileVisitor = Java.extend(SimpleFileVisitor, {
                visitFile: function (file, attrs) {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                },
                postVisitDirectory: function (dir, exc) {
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });

            // if the file's parent directory exists and is not the temporary path itself, but is a child, delete the directory
            if (file.getParentFile() != null && file.getParentFile().exists() && file.getParentFile().getAbsolutePath() != tmpPath) {
                Files.walkFileTree(Paths.get(file.getParentFile().getAbsolutePath()), new DeleteFileVisitor());
            }
        }
    });

    var input = new FileInputStream(tempFile);
    var output = response.getOutputStream();

    // Create a buffer to read data in chunks
    var buffer = new ByteArrayType(1024);
    var bytesRead;

    // Read from the input stream and write to the output stream
    while ((bytesRead = input.read(buffer)) != -1) {
        output.write(buffer, 0, bytesRead);
    }

    input.close();
    tempFile.delete();

    // flush the HttpServletResponse to ensure lock the headers, including the content type so Maximo doesn't force it back to json.
    response.flushBuffer();
}

/**
 * Zips the files to the provided ZipOutputStream.
 * @param {ZipOutputStream} zos the zip output stream to write the files to
 * @param {Array} files an array of objects that contain the name and path of the files to be zipped
 */
function zipFiles(zos, files) {
    // iterate over the files and add them to the zip output stream
    for (var i = 0; i < files.length; i++) {
        filePath = files[i];

        // check if the file exists and is not a directory
        var file = new File(filePath.path);
        if (file.exists() && !file.isDirectory()) {
            // create a new ZipEntry for the file and add it to the zip output stream
            var zipEntry = new ZipEntry(filePath.name);
            // put the entry in the zip output stream
            zos.putNextEntry(zipEntry);
            // create a FileInputStream to read the file from the server
            var fis = new FileInputStream(file);
            // create a buffer to read the file in chunks, note this needs to be a byte array to avoid issues with JavaScript's typing
            var buffer = new ByteArrayType(1024);
            var length;
            // loop through the file and write it to the zip output stream
            while ((length = fis.read(buffer)) > 0) {
                zos.write(buffer, 0, length);
            }
            // close the FileInputStream
            fis.close();
            // close the ZipEntry
            zos.closeEntry();
        }
    }
    // finish the zip output stream to ensure all data is written
    zos.finish();
}

/**
 * Checks for the com.ibm.tivoli.maximo.oslc.provider.MaximoOslcProviderServlet.class file in the classpath and returns the path to the commonweb.jar file.
 * The class may exist in multiple locations, so this method returns the one found within a Jar file and not within the maximouiweb.war file.
 * @returns {String} the path to the commonweb.jar file.
 */
function findCommonWeb() {
    // get the paths for the MaximoOslcProviderServlet.class file.
    var paths = MaximoOslcProviderServlet.class.getClassLoader().getResources("/com/ibm/tivoli/maximo/oslc/provider/MaximoOslcProviderServlet.class");

    // iterate over the paths and check if they are in a Jar file
    while (paths.hasMoreElements()) {
        var path = paths.nextElement().getPath();
        // if the path starts with "file:" and contains "!", it is a Jar file
        if (path !== null && path.startsWith("file:") && path.indexOf("!") > 0) {
            return path.substring(5, path.indexOf("!"));
        }
    }
}

/**
 * Gets the path to the business objects jar file.
 * @returns {String} the path to the business objects jar file.
 */
function findBusinessObjectsJar() {
    return Mbo.class.getProtectionDomain().getCodeSource().getLocation().getPath();
}

/**
 * Gets the path to the webclient jar file. If this is Maximo 7.6.1 or higher, it will be in the WEB-INF/classes directory and these files will be zipped into a webclient.jar.
 * If this is Maximo Application Suite, it will be in the maximouiweb.war file, which will be extracted and then zip the WEB-INF.classes directory and these files will be zipped into a webclient.jar.
 * @returns {String} the path to the webclient jar file.
 */
function findWebClientJar() {
    // get the path to the WebClientSession.class file
    var path = WebClientSession.class.getResource("/psdi/webclient/system/session/WebClientSession.class").getPath();

    // if the path starts with "file:", it is a Jar/War file
    if (path.startsWith("file:")) {
        // get the path to the web client jar file
        var webClientJar = new File(WebClientSession.class.getProtectionDomain().getCodeSource().getLocation().getPath());
        // create a temp folder by deleting the file and creating a new directory
        var tempFile = File.createTempFile("tempDir", "", null); // "" for suffix, null for default dir
        tempFile.delete();
        if (tempFile.mkdir()) {
            // get the web client jar file as a JarFile
            var jarFile = new JarFile(webClientJar);
            var entries = jarFile.entries();

            // write the elements to the temp directory
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                var destFile = new File(tempFile, entry.getName());
                if (entry.isDirectory()) {
                    destFile.mkdirs();
                } else {
                    var parent = destFile.getParentFile();
                    if (!parent.exists()) {
                        parent.mkdirs();
                    }
                    var input = jarFile.getInputStream(entry);
                    var output = new FileOutputStream(destFile);
                    var buffer = new ByteArrayType(1024);
                    var length;
                    while ((length = input.read(buffer)) > 0) {
                        output.write(buffer, 0, length);
                    }
                    input.close();
                    output.close();
                }
            }
            jarFile.close();

            // create a Jar file for the WEB-INF/classes directory
            return createJar(
                tempFile.getAbsolutePath() + File.separator + File.separator + "WEB-INF" + File.separator + "classes",
                tempFile.getAbsolutePath() +
                    File.separator +
                    "webclient-" +
                    Version.majorVersion +
                    "." +
                    Version.minorVersion +
                    "." +
                    Version.modLevel +
                    "." +
                    Version.patch +
                    ".jar"
            );
        }
    } else {
        // find the path to the WEB-INF/classes directory within the exploded maximouiweb.war file
        path = path.substring(0, path.indexOf("WEB-INF/classes") + 15);

        // create a temp folder to zip the files into
        var tempFile = File.createTempFile("tempDir", "", null);
        tempFile.delete();

        if (tempFile.mkdir()) {
            // cfreate a Jar file for the WEB-INF/classes directory
            return createJar(path, tempFile.getAbsolutePath() + File.separator + "webclient-" + ".jar");
        }
    }
}

/**
 * Creates a Jar file from the specified source directory.
 * @param {String} sourceDirPath the path to the source directory to be zipped
 * @param {String} jarFilePath the path to the jar file to be created
 * @returns the path to the jar file created
 */
function createJar(sourceDirPath, jarFilePath) {
    // check if the source directory exists and is a directory
    var sourceDir = new File(sourceDirPath);
    if (!sourceDir.exists() || !sourceDir.isDirectory()) {
        throw new IllegalArgumentException("Source directory does not exist or is not a directory: " + sourceDirPath);
    }

    // create the jar file
    var fos = new FileOutputStream(jarFilePath);
    var jarOut = new JarOutputStream(fos);

    // add the source directory to the jar file
    addDirectoryToJar(sourceDir, sourceDir, jarOut);
    // close the jar output stream
    jarOut.close();
    fos.close();
    // close the resulting Jar file path
    return jarFilePath;
}

/**
 * Adds a directory and its contents to the JarOutputStream.
 * @param {String} sourceDir the source directory to be zipped
 * @param {*} currentDir the current directory to be zipped
 * @param {*} jarOut the JarOutputStream to write the files to
 * @returns {void}
 */
function addDirectoryToJar(sourceDir, currentDir, jarOut) {
    var files = currentDir.listFiles();

    // skip if the directory is empty
    if (files == null) {
        return;
    }

    // iterate over the files in the directory
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        entryName = getEntryName(sourceDir, file);

        // if the file is a directory, add it to the jar output stream as a JarEntry
        if (file.isDirectory()) {
            // Add directory entry (with trailing slash)
            var entry = new JarEntry(entryName + "/");
            jarOut.putNextEntry(entry);
            jarOut.closeEntry();
            // recursively add the directory to the jar output stream
            addDirectoryToJar(sourceDir, file, jarOut);
        } else {
            // Create a JarEntry for the file and add it to the jar output stream
            var entry = new JarEntry(entryName);
            jarOut.putNextEntry(entry);
            var fis = new FileInputStream(file);
            var buffer = new ByteArrayType(1024);
            var length;
            while ((length = fis.read(buffer)) > 0) {
                jarOut.write(buffer, 0, length);
            }
            // close the FileInputStream
            fis.close();
            // close the JarEntry
            jarOut.closeEntry();
        }
    }
}

/**
 * Remove the leading slash from the entry name if it exists.
 * @param {String} sourceDir the source directory to get the entry name for.
 * @param {java.io.File} file the file to get the entry name for.
 * @returns
 */
function getEntryName(sourceDir, file) {
    var name = file.getAbsolutePath().substring(sourceDir.getAbsolutePath().length()).replace("\\", "/");
    if (name.startsWith("/")) {
        name = name.substring(1);
    }
    return name;
}

var scriptConfig = {
    "autoscript": "EXTRACT.LIBRARY",
    "description": "Extracts the business objects jar, web client jar, and common web jar and processes them into a zip file.",
    "version": "1.0.0",
    "active": true,
    "logLevel": "ERROR",
    "allowInvokingScriptFunctions": false
};
