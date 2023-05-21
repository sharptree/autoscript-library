ScriptCache = Java.type("com.ibm.tivoli.maximo.script.ScriptCache");
Boolean = Java.type("java.lang.Boolean")

ByteArrayOutputStream = Java.type('java.io.ByteArrayOutputStream');

Types = Java.type('java.sql.Types');

ZoneId = Java.type("java.time.ZoneId");

Date = Java.type("java.util.Date");
Properties = Java.type("java.util.Properties")

DataHandler = Java.type("javax.activation.DataHandler")
Message = Java.type("javax.mail.Message")
Session = Java.type("javax.mail.Session")
InternetAddress = Java.type("javax.mail.internet.InternetAddress")
MimeBodyPart = Java.type("javax.mail.internet.MimeBodyPart")
MimeMessage = Java.type("javax.mail.internet.MimeMessage")
MimeMultipart = Java.type("javax.mail.internet.MimeMultipart")
Transport = Java.type("javax.mail.Transport")
ByteArrayDataSource = Java.type("javax.mail.util.ByteArrayDataSource")

Cell = Java.type('org.apache.poi.ss.usermodel.Cell');
Row = Java.type('org.apache.poi.ss.usermodel.Row');
XSSFSheet = Java.type('org.apache.poi.xssf.usermodel.XSSFSheet');
XSSFWorkbook = Java.type('org.apache.poi.xssf.usermodel.XSSFWorkbook');
XSSFFont = Java.type('org.apache.poi.xssf.usermodel.XSSFFont');

DBShortcut = Java.type('psdi.mbo.DBShortcut');
MboConstants = Java.type('psdi.mbo.MboConstants');

MXServer = Java.type('psdi.server.MXServer');
SmtpAuthenticator = Java.type("psdi.server.MXServer$SmtpAuthenticator")
CommonUtil = Java.type("psdi.util.CommonUtil")
HTML = Java.type("psdi.util.HTML")
MXFormat = Java.type("psdi.util.MXFormat");

System = Java.type("java.lang.System");


ExportParameters.fromJson = function (json) {
    if (json) {
        if (typeof json !== 'object') {
            if (typeof json === 'string') {
                json = JSON.parse(json);
            } else {
                throw Error('The "json" parameter must be either a JSON object or a string type that can be parsed to a an ExportParameters object.');
            }
        }

        return new ExportParameters(json.attributes, json.sheetName, json.autosize, json.boldHeaders);

    } else {
        throw Error('The "json" parameter is required and must be either a string or JSON object that can be parsed to an ExportParameters object.');
    }

}

/**
 * Download the work order to the script request HTTP output.  This only works when the script is invoked directly.
 * @param {byte[]} workbook The byte array representing the POI workbook,
 * @param {String} fileName Optional name of the file to export.  If not provided "export.xlsx" is used.
 * @param {com.ibm.tivoli.maximo.oslc.provider.OslcRequest} oslcRequest optional OslcRequest object if an implicit request variable is unavailable.
 */
function downloadWorkbook(workbook, fileName, oslcRequest) {

    if (typeof request === 'undefined' && !oslcRequest) {                
        throw new Error('The exportWorkbook function can only be called from a direct script invocation with the "request" implicit variable available or with the oslcRequest provided.');
    }

    if (!workbook) {
        throw new Error('An Excel workbook is required to export.');
    }

    var response = (typeof request === 'undefined') ? oslcRequest.getHttpServletResponse() :request.getHttpServletResponse();
    response.setBufferSize(0);
    response.setContentType("application/vnd.ms-excel");
    response.setHeader("content-disposition", 'attachment; filename="' + (fileName ? fileName : 'export.xlsx') + '"');
    response.getOutputStream().write(workbook);

    response.flushBuffer();
}


/**
 * Send an email with an Excel workbook attachment. The standard MXServer.sendEMail() method cannot be used because it does not allow for direct 
 * attachment of a file, but rather requires an attached document docinfo record, which we do not want to create.
 * @param  {String} to The to email address
 * @param  {String} from The from email address
 * @param  {String} subject The subject for the email
 * @param  {String} message The message for the email
 * @param  {byte[]} workbook A Java byte array representing the Apache POI Excel workbook.
 * @param  {String} attachmentName An optional attachment name, if not included "export.xlsx" is used.
 */
function sendEmail(to, from, subject, message, workbook, attachmentName) {
    if (!to) {
        throw Error("The to email address is required.");
    }
    if (!from) {
        throw Error("The from email address is required.");
    }
    if (!subject) {
        throw Error("A subject is required.");
    }
    if (!message) {
        throw Error("A message body is required.");
    }
    if (!workbook) {
        throw Error("A workbook attachment is required.");
    }

    if (!attachmentName) {
        attachmentName = 'export.xlsx';
    }

    var session = _getMailSession();
    var mimeMessage = new MimeMessage(session);

    mimeMessage.addHeaderLine("charset=UTF-8");

    mimeMessage.setFrom(new InternetAddress(from));
    mimeMessage.addRecipient(Message.RecipientType.TO, new InternetAddress(to));
    mimeMessage.setSentDate(MXServer.getMXServer().getDate());

    var charset = MXServer.getMXServer().getProperty("mxe.email.charset");
    var charsetAvailable = typeof charset !== 'undefined' && !charset.isEmpty();

    // if the subject was provided then remove new lines
    if (typeof subject !== 'undefined' && !subject.isEmpty()) {
        subject = CommonUtil.removeNewLines(subject);

        // if the charset was available then use it, otherwise allow the system default to be used.
        if (charsetAvailable) {
            mimeMessage.setSubject(subject, charset);
        } else {
            mimeMessage.setSubject(subject);
        }
    }

    var multipart = new MimeMultipart();

    // if a non-empty message was provided then add it as the first message part.
    if (typeof message !== 'undefined' && !message.isEmpty()) {
        var mimeMessagePart = new MimeBodyPart();
        var emailContentType = MXServer.getMXServer().getConfig().getProperty("mxe.email.content.type");
        var convertToPlainText = MXServer.getMXServer().getConfig().getProperty("mxe.email.convertToPlainText");

        if (!"text/html".equalsIgnoreCase(emailContentType) && Boolean.parseBoolean(equalsIgnoreCase(convertToPlainText))) {
            message = HTML.toPlainText(message);
        } else if (!HTML.isHtml(message) || HTML.isHtml(message) && !HTML.containsHtmlBreakTags(message)) {
            message = HTML.replaceNewLineWithBR(message);
        }

        if (emailContentType) {
            if (charsetAvailable) {
                mimeMessagePart.setText(message, charset);
                mimeMessagePart.setHeader("Content-Type", emailContentType + ";charset=" + charset);
            } else {
                mimeMessagePart.setText(message);
                mimeMessagePart.setHeader("Content-Type", emailContentType);
            }
        } else if (charsetAvailable) {
            mimeMessagePart.setText(message, charset);
        } else {
            mimeMessagePart.setText(message);
        }

        // add the message part to the multipart message.
        multipart.addBodyPart(mimeMessagePart);

        var attachment = new MimeBodyPart();

        // add the Excel workbook message to the invite multi part.
        attachment.setDataHandler(new DataHandler(new ByteArrayDataSource(workbook, 'application/vnd.ms-excel;name="' + attachmentName + '"')));

        multipart.addBodyPart(attachment);
        mimeMessage.setContent(multipart);

        var sslEnabled = Boolean.parseBoolean(MXServer.getMXServer().getProperty("mail.smtp.ssl.enable"));

        // if ssl is enabled send it via https otherwise just send the message.
        if (sslEnabled) {
            var transport = session.getTransport("smtps");
            transport.connect();
            transport.sendMessage(mimeMessage, mimeMessage.getAllRecipients());
            transport.close();
        } else {
            Transport.send(mimeMessage);
        }
    }
}

/**
 * Exports a MboSet or ResultSet to an Excel workbook.
 * @param {ResultSet or MboSet} set A JDBC java.sql.ResultSet or a Maximo psdi.mbo.MboSet to export to an Excel spreadsheet.
 * @param {ExportOptions} options The export options including formatting and attributes to export.
 * @returns {byte[]} a byte array representing the Excel workbook.
 */
function exportSet(set, options) {
    if (!set) {
        throw new Error('Either a Maximo MboSet or JDBC ResultSet is required to export to an Excel workbook.');
    }

    if (!(options instanceof ExportParameters)) {
        // Parse the options if they are not already an ExportParameters object.
        options = ExportParameters.fromJson(options);
    }

    var sheetName = (typeof options !== 'undefined' && typeof options.sheetName !== 'undefined') ? options.sheetName : null;

    if (set instanceof Java.type('psdi.mbo.MboSetRemote')) {
        if (!options || typeof options.attributes === 'undefined') {
            throw new Error('The options parameter with a property of "options" containing an array of attributes to export is required.');
        }
        return exportMboSet(set, sheetName, options.attributes);
    } else if (set instanceof Java.type('java.sql.ResultSet')) {
        return exportResultSet(set, sheetName);
    } else {
        throw new Error('Only Maximo MboSet and JDBC ResultSet objects are supported, instances of ' + (Java.isJavaObject(set) ? set.getClass().getName() : 'JavaScript Objects') + ' are not supported.');
    }
}

/**
 * Export a MboSet to an Excel workbook
 * 
 * @param {psdi.mbo.MboSet} mboSet The MboSet to export to an Excel workbook.
 * @param {String} sheetName The name of the Sheet within the workbook for the exported values.
 * @param {String[]} attributes An array of attributes to export.
 * 
 * @returns A byte array representing the Excel workbook.
 */
function exportMboSet(mboSet, sheetName, attributes) {
    if (!mboSet) {
        throw new Error('A Maximo MboSet is required to export to an Excel workbook.');
    }

    if (!attributes || attributes.length == 0) {
        throw new Error('At least one attribute must be included in the attributes list of the options parameter.');
    }

    var columnCount = attributes.length;
    var columns = [];
    var types = [];

    var metadata = mboSet.getMboSetInfo();

    for (var i = 0; i < columnCount; i++) {
        var mvi = metadata.getMboValueInfo(attributes[i]);

        columns.push(mvi.getTitle());
        types.push(mvi.getMaxType());
    }

    var workbook = new XSSFWorkbook();

    var font = workbook.createFont();
    font.setBold(true);

    style = workbook.createCellStyle();
    style.setFont(font);

    var sheet = workbook.createSheet(sheetName ? sheetName : mboSet.getName());
    var headers = sheet.createRow(0);

    for (i = 0; i < columnCount; i++) {
        var header = headers.createCell(i);
        header.setCellValue(columns[i]);
        header.setCellStyle(style);
    }
    mboSet.setFlag(MboConstants.DISCARDABLE, true);
    var mbo = mboSet.moveFirst();
    var rowIndex = 1;
    while (mbo) {
        var row = sheet.createRow(rowIndex++);
        for (var j = 0; j < attributes.length; j++) {
            if (!mbo.isNull(attributes[j])) {
                row.createCell(j).setCellValue(mbo.getString(attributes[j]));
            }
        }
        mbo = mboSet.moveNext();
    }

    for (var j = 0; j < columnCount; j++) {
        sheet.autoSizeColumn(j);
    }

    var out = new ByteArrayOutputStream();

    workbook.write(out);
    workbook.close();
    return out.toByteArray();
}

/**
 * Exports the provided ResultSet to an Excel workbook.  Returns a Java byte array representing the workbook.
 * @param  {ResultSet} resultSet The Java JDBC ResultSet to export to Excel
 * @param  {String} sheetName An optional name for the workbook sheet, defaults to the table name of the first column in the result set.
 * 
 * @returns {byte[]} A byte array representing the Excel workbook.
 */
function exportResultSet(resultSet, sheetName) {
    if (!resultSet) {
        throw new Error('A JDBC ResultSet is required to export to an Excel workbook.');
    }
    var metadata = resultSet.getMetaData();
    var columnCount = metadata.getColumnCount()
    var columns = [];
    var types = [];

    for (var i = 1; i <= columnCount; i++) {
        columns.push(metadata.getColumnLabel(i));
        types.push(metadata.getColumnType(i));
    }

    var workbook = new XSSFWorkbook();

    var font = workbook.createFont();
    font.setBold(true);

    style = workbook.createCellStyle();
    style.setFont(font);

    var sheet = workbook.createSheet(sheetName ? sheetName : metadata.getTableName(1));
    var headers = sheet.createRow(0);
    for (i = 0; i < columnCount; i++) {
        var header = headers.createCell(i);
        header.setCellValue(columns[i]);
        header.setCellStyle(style);
    }

    var rowIndex = 1;

    while (resultSet.next()) {
        var row = sheet.createRow(rowIndex++);
        for (var j = 0; j < columnCount; j++) {

            var value = resultSet.getString(j + 1);

            if (value) {
                switch (types[j]) {
                    case Types.DATE:
                        row.createCell(j).setCellValue(MXFormat.dateToString(Date.from(resultSet.getDate(j + 1).toLocalDate().atStartOfDay(ZoneId.systemDefault()).toInstant())));
                        break;
                    case Types.TIMESTAMP:
                        var value = resultSet.getTimestamp(j + 1);
                        row.createCell(j).setCellValue(MXFormat.dateToString(Date.from(resultSet.getTimestamp(j + 1).toInstant())) + " " + MXFormat.timeToString(Date.from(resultSet.getTimestamp(j + 1).toInstant())));
                        break;
                    case Types.SMALLINT:
                    case Types.INTEGER:
                        row.createCell(j).setCellValue(resultSet.getInt(j + 1));
                        break;
                    case Types.BIGINT:
                        row.createCell(j).setCellValue(resultSet.getLong(j + 1));
                        break;
                    case Types.DECIMAL:
                    case Types.FLOAT:
                    case Types.NUMERIC:
                    case Types.DOUBLE:
                        row.createCell(j).setCellValue(resultSet.getDouble(j + 1));
                        break;
                    default:
                        row.createCell(j).setCellValue(value);
                        break;
                }
            }
        }
    }
    for (var j = 0; j < columnCount; j++) {
        sheet.autoSizeColumn(j);
    }

    var out = new ByteArrayOutputStream();

    workbook.write(out);
    workbook.close();
    return out.toByteArray();

}

/**
 * Use the Maximo properties to manually establish a new JavaMail session that can be used directly.
 * This is necessary because the psdi.server.MXServer.sendEMail() methods do not allow for directly adding attachments.
 * 
 * @returns {java.mail.Session} A java.mail.Session object.
 */
function _getMailSession() {

    var mailProps = new Properties();

    // Copy all the properties from the system config to a new variable that we can change.    
    mailProps.putAll(MXServer.getMXServer().getMxServerConfig());

    var smtpHost = null;
    smtpHost = MXServer.getMXServer().getProperty("mail.smtp.host");

    if (smtpHost != null && !smtpHost.isEmpty()) {
        mailProps.put("mail.smtp.host", smtpHost);
    }

    var sslEnabled = Boolean.parseBoolean(MXServer.getMXServer().getProperty("mail.smtp.ssl.enable"));

    if (sslEnabled) {
        mailProps.put("mail.transport.protocol", "smtps");
        mailProps.put("mail.smtps.ssl.enable", sslEnabled);
        mailProps.put("mail.smtps.socketFactory.port", MXServer.getMXServer().getProperty("mail.smtp.port"));
        mailProps.put("mail.smtps.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
        mailProps.put("mail.smtps.socketFactory.fallback", "false");
    }

    var user = MXServer.getMXServer().getProperty("mxe.smtp.user");
    var password = MXServer.getMXServer().getProperty("mxe.smtp.password");

    if (user != null && !user.isEmpty()) {
        mailAuth = new SmtpAuthenticator(MXServer.getMXServer(), user, password);
    } else {
        mailAuth = null;
    }

    if (mailAuth != null) {
        mailProps.put("mail.smtp.auth", "true");
    }

    var smtpTimeout = MXServer.getMXServer().getProperty("mxe.smtp.timeout");

    if (smtpTimeout != null && !smtpTimeout.isEmpty()) {
        mailProps.put("mail.smtp.timeout", smtpTimeout);
    }

    var smtpConnectionTimeout = MXServer.getMXServer().getProperty("mxe.smtp.connectiontimeout");

    if (smtpConnectionTimeout != null && !smtpConnectionTimeout.isEmpty()) {
        mailProps.put("mail.smtp.connectiontimeout", smtpConnectionTimeout);
    }

    mailProps.put("mail.smtp.sendpartial", mailProps.getProperty("mail.smtp.sendpartial").equals("0") ? "false" : "true");

    return Session.getInstance(mailProps, mailAuth);
}


/**
 * The available parameters for exporting a ResultSet or MboSet.
 * 
 * @param {Array<String>} attributes The list of attributes to export for an MboSet
 * @param {String} sheetName The name of the Sheet within the Workbook
 * @param {boolean} autosize Indicates if the columns should be auto sized.
 * @param {boolean} boldHeaders Indicates that the headers should be formatted with a bold font.
 */
function ExportParameters(attributes, sheetName, autosize, boldHeaders) {
    this.sheetName = sheetName;
    this.attributes = attributes;
    this.autosize = autosize != null ? autosize : true
    this.boldHeaders = boldHeaders != null ? boldHeaders : true
}



var scriptConfig = {
    "autoscript": "SHARPTREE.EXCEL",
    "description": "Sharptree Excel utility functions.",
    "version": "",
    "active": true,
    "logLevel": "ERROR"
};