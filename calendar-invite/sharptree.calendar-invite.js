Boolean = Java.type("java.lang.Boolean");
StringBuilder = Java.type("java.lang.StringBuilder");
SimpleDateFormat = Java.type("java.text.SimpleDateFormat");
Properties = Java.type("java.util.Properties");
TimeZone = Java.type("java.util.TimeZone");
UUID = Java.type("java.util.UUID");
DataHandler = Java.type("javax.activation.DataHandler");
Message = Java.type("javax.mail.Message");
Session = Java.type("javax.mail.Session");
InternetAddress = Java.type("javax.mail.internet.InternetAddress");
MimeBodyPart = Java.type("javax.mail.internet.MimeBodyPart");
MimeMessage = Java.type("javax.mail.internet.MimeMessage");
MimeMultipart = Java.type("javax.mail.internet.MimeMultipart");
Transport = Java.type("javax.mail.Transport");
ByteArrayDataSource = Java.type("javax.mail.util.ByteArrayDataSource");
MXServer = Java.type("psdi.server.MXServer");
SmtpAuthenticator = Java.type("psdi.server.MXServer$SmtpAuthenticator");
CommonUtil = Java.type("psdi.util.CommonUtil");
HTML = Java.type("psdi.util.HTML");
Version = Java.type("psdi.util.Version");

function sendInvite(userInfo, from, to, subject, message, startTime, endTime, organizer, location) {

    // Get the JavaMail session from the Maximo properties.
    var session = _getMailSession();

    // A calendar invite is a MimeMessage - Multipurpose Internet Mail Extensions (MIME) https://en.wikipedia.org/wiki/MIME
    var mimeMessage = new MimeMessage(session);

    // Add headers identifying the message as a calendar invite.
    mimeMessage.addHeaderLine("method=REQUEST");
    mimeMessage.addHeaderLine("charset=UTF-8");
    mimeMessage.addHeaderLine("component=VEVENT");

    // Set the from address
    mimeMessage.setFrom(new InternetAddress(from));

    // Set the to address
    mimeMessage.addRecipient(Message.RecipientType.TO, new InternetAddress(to));

    // Set the date as the Maximo server's date.
    mimeMessage.setSentDate(MXServer.getMXServer().getDate());

    // Use the Maximo character encoding
    var charset = MXServer.getMXServer().getProperty("mxe.email.charset");
    var charsetAvailable = typeof charset !== 'undefined' && !charset.isEmpty();
    // if the subject was provided then 
    if (typeof subject !== 'undefined' && !subject.isEmpty()) {

        // use the psdi.util.CommonUtil class to remove any spaces.
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
    }

    // Create a formatter and set the time zone to the user's timezone.
    var formatter = new SimpleDateFormat("yyyyMMdd HHmmss");
    formatter.setTimeZone(userInfo.getTimeZone());

    // Create a formatter for timestamps and set the time zone to the user's timezone.
    var timestampFormatter = new SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'");
    timestampFormatter.setTimeZone(userInfo.getTimeZone());

    // build an iCalendar message, specifications here: https://icalendar.org/
    var builder = new StringBuilder();

    builder.append("BEGIN:VCALENDAR\n")
        .append("METHOD:REQUEST\n")
        .append("PRODID:Microsoft Exchange Server 2010\n")
        .append("VERSION:2.0\n")
        .append("BEGIN:VTIMEZONE\n")
        .append("TZID:").append(userInfo.getTimeZone().getID()).append("\n")
        .append("END:VTIMEZONE\n")
        .append("BEGIN:VEVENT\n")
        .append("ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:MAILTO:").append(to).append("\n")
        .append(organizer ? ("ORGANIZER;CN=" + organizer + ":MAILTO:" + from + "\n") : "")
        .append("ORGANIZER:MAILTO:").append(from).append("\n")
        .append("DESCRIPTION;LANGUAGE=en-US:").append(message).append("\n")
        .append("UID:").append(UUID.randomUUID().toString()).append("\n")
        .append("SUMMARY;LANGUAGE=en-US:").append(subject).append("\n")
        .append("DTSTART:").append(formatter.format(startTime).replace(" ", "T")).append("\n")
        .append("DTEND:").append(formatter.format(endTime).replace(" ", "T")).append("\n")
        .append("CLASS:PUBLIC\n")
        .append("PRIORITY:5\n")
        .append("DTSTAMP:").append(timestampFormatter.format(MXServer.getMXServer().getDate())).append("\n")
        .append("TRANSP:OPAQUE\n")
        .append("STATUS:CONFIRMED\n")
        .append("SEQUENCE:$sequenceNumber\n")
        .append(location ? ("LOCATION;LANGUAGE=en-US: " + location + "\n") : "")
        .append("BEGIN:VALARM\n")
        .append("DESCRIPTION:REMINDER\n")
        .append("TRIGGER;RELATED=START:-PT15M\n")
        .append("ACTION:DISPLAY\n")
        .append("END:VALARM\n")
        .append("END:VEVENT\n")
        .append("END:VCALENDAR");

    // Create the invite part of the message.
    var invite = new MimeBodyPart();

    invite.setHeader("Content-Class", "urn:content-classes:calendarmessage");
    invite.setHeader("Content-ID", "calendar_message");

    // add the iCalendar message to the invite multi part.
    invite.setDataHandler(new DataHandler(
        new ByteArrayDataSource(builder.toString(), "text/calendar;method=REQUEST;name=\"invite.ics\"")));

    multipart.addBodyPart(invite);
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

// Use the Maximo properties to manually establish a new JavaMail session that can be used directly.
function _getMailSession() {

    var mailProps = new Properties();

    // Copy all the properties from the system config to a new variable that we can change.
    // MXServer.getMXServer().getConfig() is deprecated in 7.6.1+ systems so use the appropriate form.
    mailProps.putAll((Version.majorVersion === '7' && Version.minorVersion === '6' && Version.modLevel === '0') ? MXServer.getMXServer().getConfig() : MXServer.getMXServer().getMxServerConfig());

    var smtpHost = null;
    smtpHost = MXServer.getMXServer().getProperty("mail.smtp.host");

    if (smtpHost != null && !smtpHost.isEmpty()) {
        mailProps.put("mail.smtp.host", smtpHost);
    }

    var sslEnabled = Boolean.parseBoolean(MXServer.getMXServer().getProperty("mail.smtp.ssl.enable"));

    if (sslEnabled) {
        mailProps.put("mail.transport.protocol", "smtps");
        mailProps.put("mail.smtps.ssl.enable", sslEnabled);
        mailProps.put("mail.smtps.socketFactory.port", 465);
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