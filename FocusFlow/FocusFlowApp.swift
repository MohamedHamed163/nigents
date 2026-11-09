import SwiftUI

@main
struct FocusFlowApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var popover: NSPopover!
    var timerManager = TimerManager.shared
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "brain.head.profile", accessibilityDescription: "FocusFlow")
            button.image?.size = NSSize(width: 20, height: 20)
            button.action = #selector(togglePopover)
        }
        
        let contentView = ContentView()
        popover = NSPopover()
        popover.contentSize = NSSize(width: 360, height: 520)
        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: contentView)
        
        timerManager.onTick = { [weak self] in
            self?.updateStatusItem()
        }
        timerManager.onStateChange = { [weak self] in
            self?.updateStatusItem()
        }
        
        updateStatusItem()
    }
    
    @objc func togglePopover() {
        if let button = statusItem.button {
            if popover.isShown {
                popover.performClose(nil)
            } else {
                popover.show(relativeTo: button.bounds, of: button, preferredEdge: NSRectEdge.minY)
            }
        }
    }
    
    func updateStatusItem() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let button = self.statusItem.button else { return }
            switch self.timerManager.state {
            case .idle:
                button.image = NSImage(systemSymbolName: "brain.head.profile", accessibilityDescription: "FocusFlow")
                button.title = ""
            case .focusing:
                let mins = self.timerManager.remainingSeconds / 60
                let secs = self.timerManager.remainingSeconds % 60
                button.image = NSImage(systemSymbolName: "brain.head.profile.fill", accessibilityDescription: "Focusing")
                button.title = String(format: " %d:%02d", mins, secs)
            case .shortBreak:
                let mins = self.timerManager.remainingSeconds / 60
                let secs = self.timerManager.remainingSeconds % 60
                button.image = NSImage(systemSymbolName: "cup.and.saucer.fill", accessibilityDescription: "Break")
                button.title = String(format: " %d:%02d", mins, secs)
            case .longBreak:
                let mins = self.timerManager.remainingSeconds / 60
                let secs = self.timerManager.remainingSeconds % 60
                button.image = NSImage(systemSymbolName: "leaf.fill", accessibilityDescription: "Long Break")
                button.title = String(format: " %d:%02d", mins, secs)
            }
        }
    }
}
