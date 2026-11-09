import Foundation
import Combine
import UserNotifications

enum TimerState: Equatable {
    case idle
    case focusing
    case shortBreak
    case longBreak
}

class TimerManager: ObservableObject {
    static let shared = TimerManager()
    
    @Published var state: TimerState = .idle
    @Published var remainingSeconds: Int = 0
    @Published var completedPomodoros: Int = 0
    @Published var totalFocusMinutes: Int = 0
    
    var onTick: (() -> Void)?
    var onStateChange: (() -> Void)?
    
    private var timer: Timer?
    private var totalSeconds: Int = 0
    
    var focusDuration: Int = 25 * 60
    var shortBreakDuration: Int = 5 * 60
    var longBreakDuration: Int = 15 * 60
    var pomodorosBeforeLongBreak: Int = 4
    
    var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
    }
    
    var formattedTime: String {
        let mins = remainingSeconds / 60
        let secs = remainingSeconds % 60
        return String(format: "%d:%02d", mins, secs)
    }
    
    func startFocus() {
        state = .focusing
        totalSeconds = focusDuration
        remainingSeconds = focusDuration
        startTimer()
        onStateChange?()
    }
    
    func startShortBreak() {
        state = .shortBreak
        totalSeconds = shortBreakDuration
        remainingSeconds = shortBreakDuration
        startTimer()
        onStateChange?()
    }
    
    func startLongBreak() {
        state = .longBreak
        totalSeconds = longBreakDuration
        remainingSeconds = longBreakDuration
        startTimer()
        onStateChange?()
    }
    
    func pause() {
        timer?.invalidate()
        timer = nil
    }
    
    func resume() {
        guard remainingSeconds > 0 else { return }
        startTimer()
    }
    
    func stop() {
        timer?.invalidate()
        timer = nil
        state = .idle
        remainingSeconds = 0
        totalSeconds = 0
        onStateChange?()
    }
    
    func skip() {
        timer?.invalidate()
        timer = nil
        handleTimerComplete()
    }
    
    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }
    
    private func tick() {
        remainingSeconds -= 1
        onTick?()
        
        if remainingSeconds <= 0 {
            timer?.invalidate()
            timer = nil
            handleTimerComplete()
        }
    }
    
    private func handleTimerComplete() {
        switch state {
        case .focusing:
            completedPomodoros += 1
            totalFocusMinutes += focusDuration / 60
            sendNotification(title: "Focus Session Complete!", body: "Time for a break. You've completed \(completedPomodoros) session(s).")
            
            if completedPomodoros % pomodorosBeforeLongBreak == 0 {
                startLongBreak()
            } else {
                startShortBreak()
            }
            
        case .shortBreak, .longBreak:
            sendNotification(title: "Break is Over!", body: "Ready to focus again?")
            state = .idle
            remainingSeconds = 0
            totalSeconds = 0
            onStateChange?()
            
        case .idle:
            break
        }
    }
    
    private func sendNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
