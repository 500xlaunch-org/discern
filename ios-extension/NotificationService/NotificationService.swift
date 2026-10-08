// Discern's notification service: before an iPhone shows a push, fetch the
// picture it names (the severity's image, fcm_options.image) and attach it, so
// the notification shows how serious it is, as on Android. Nothing else is
// touched; if the picture cannot be fetched in time, the push shows as sent.
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    private var handler: ((UNNotificationContent) -> Void)?
    private var content: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        handler = contentHandler
        content = request.content.mutableCopy() as? UNMutableNotificationContent
        guard let content = content,
              let options = request.content.userInfo["fcm_options"] as? [String: Any],
              let link = options["image"] as? String, let url = URL(string: link), url.scheme == "https" else {
            contentHandler(request.content); return
        }
        URLSession.shared.downloadTask(with: url) { file, response, _ in
            defer { contentHandler(content) }
            guard let file = file, (response as? HTTPURLResponse)?.statusCode == 200 else { return }
            let kept = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            try? FileManager.default.moveItem(at: file, to: kept)
            if let picture = try? UNNotificationAttachment(identifier: "severity", url: kept, options: nil) {
                content.attachments = [picture]
            }
        }.resume()
    }

    // out of time: show what there is, without the picture
    override func serviceExtensionTimeWillExpire() {
        if let handler = handler, let content = content { handler(content) }
    }
}
