import SwiftUI
import AVFoundation

struct ContentView: View {
    @ObservedObject var timerManager = TimerManager.shared
    @State private var selectedSound: AmbientSound = .none
    @State private var soundVolume: Float = 0.5
    @State private var showingSettings = false
    @State private var audioPlayer: AVAudioPlayer?
    
    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            timerSection
            Divider()
            controlsSection
            Divider()
            ambientSection
            Divider()
            statsSection
        }
        .frame(width: 360, height: 520)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    private var header: some View {
        HStack {
            Image(systemName: "brain.head.profile.fill")
                .foregroundColor(.accentColor)
                .font(.title3)
            Text("FocusFlow")
                .font(.headline)
                .fontWeight(.bold)
            Spacer()
            Button(action: { showingSettings.toggle() }) {
                Image(systemName: "gearshape")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showingSettings) {
                SettingsView()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
    
    private var timerSection: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.15), lineWidth: 8)
                    .frame(width: 160, height: 160)
                
                Circle()
                    .trim(from: 0, to: timerManager.progress)
                    .stroke(
                        timerManager.state == .focusing ? Color.accentColor : Color.green,
                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                    )
                    .frame(width: 160, height: 160)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: timerManager.progress)
                
                VStack(spacing: 4) {
                    Text(timerManager.formattedTime)
                        .font(.system(size: 42, weight: .bold, design: .monospaced))
                        .foregroundColor(.primary)
                    
                    Text(stateLabel)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(stateColor)
                }
            }
            .padding(.top, 8)
            
            if timerManager.state == .idle {
                HStack(spacing: 8) {
                    Button("Focus 25m") { timerManager.startFocus() }
                        .buttonStyle(FocusButtonStyle(color: .accentColor))
                    Button("Short 5m") { timerManager.startShortBreak() }
                        .buttonStyle(FocusButtonStyle(color: .green))
                    Button("Long 15m") { timerManager.startLongBreak() }
                        .buttonStyle(FocusButtonStyle(color: .blue))
                }
            }
        }
        .padding(.vertical, 12)
    }
    
    private var controlsSection: some View {
        HStack(spacing: 20) {
            Button(action: {
                if timerManager.state != .idle {
                    timerManager.pause()
                }
            }) {
                Label("Pause", systemImage: "pause.fill")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .disabled(timerManager.state == .idle)
            
            Button(action: {
                if timerManager.state == .idle {
                    timerManager.startFocus()
                } else {
                    timerManager.resume()
                }
            }) {
                Image(systemName: timerManager.state == .idle ? "play.fill" : "play.fill")
                    .font(.title2)
                    .foregroundColor(.accentColor)
            }
            .buttonStyle(.plain)
            
            Button(action: { timerManager.skip() }) {
                Label("Skip", systemImage: "forward.fill")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .disabled(timerManager.state == .idle)
            
            Button(action: { timerManager.stop() }) {
                Label("Stop", systemImage: "stop.fill")
                    .foregroundColor(.red)
            }
            .buttonStyle(.plain)
            .disabled(timerManager.state == .idle)
        }
        .padding(.vertical, 10)
    }
    
    private var ambientSection: some View {
        VStack(spacing: 8) {
            Text("Ambient Sound")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(AmbientSound.allCases.filter { $0 != .none }, id: \.self) { sound in
                        AmbientSoundButton(sound: sound, isSelected: selectedSound == sound) {
                            toggleSound(sound)
                        }
                    }
                }
            }
            
            if selectedSound != .none {
                HStack {
                    Image(systemName: "speaker.wave.2")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Slider(value: $soundVolume, in: 0...1) { editing in
                        if !editing {
                            audioPlayer?.volume = soundVolume
                        }
                    }
                    .controlSize(.small)
                    Image(systemName: "speaker.wave.3.fill")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
    
    private var statsSection: some View {
        HStack {
            StatBadge(icon: "checkmark.circle.fill", value: "\(timerManager.completedPomodoros)", label: "Sessions", color: .green)
            Divider().frame(height: 30)
            StatBadge(icon: "clock.fill", value: "\(timerManager.totalFocusMinutes)", label: "Minutes", color: .accentColor)
            Divider().frame(height: 30)
            StatBadge(icon: "flame.fill", value: streakText, label: "Streak", color: .orange)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
    
    private var stateLabel: String {
        switch timerManager.state {
        case .idle: return "Ready"
        case .focusing: return "Focus Time"
        case .shortBreak: return "Short Break"
        case .longBreak: return "Long Break"
        }
    }
    
    private var stateColor: Color {
        switch timerManager.state {
        case .idle: return .secondary
        case .focusing: return .accentColor
        case .shortBreak: return .green
        case .longBreak: return .blue
        }
    }
    
    private var streakText: String {
        timerManager.completedPomodoros >= 4 ? "\(timerManager.completedPomodoros / 4)" : "0"
    }
    
    private func toggleSound(_ sound: AmbientSound) {
        if selectedSound == sound {
            selectedSound = .none
            audioPlayer?.stop()
            audioPlayer = nil
        } else {
            selectedSound = sound
            playSound(sound)
        }
    }
    
    private func playSound(_ sound: AmbientSound) {
        audioPlayer?.stop()
        guard sound != .none else { return }
        
        if let url = sound.fileURL {
            do {
                audioPlayer = try AVAudioPlayer(contentsOf: url)
                audioPlayer?.numberOfLoops = -1
                audioPlayer?.volume = soundVolume
                audioPlayer?.play()
            } catch {
                print("Failed to play sound: \(error)")
            }
        }
    }
}

enum AmbientSound: String, CaseIterable {
    case none = "None"
    case rain = "Rain"
    case cafe = "Cafe"
    case fire = "Fire"
    case birds = "Birds"
    case waves = "Waves"
    case wind = "Wind"
    
    var icon: String {
        switch self {
        case .none: return "speaker.slash"
        case .rain: return "cloud.rain.fill"
        case .cafe: return "cup.and.saucer.fill"
        case .fire: return "flame.fill"
        case .birds: return "bird.fill"
        case .waves: return "water.waves"
        case .wind: return "wind"
        }
    }
    
    var fileURL: URL? { nil }
}

struct AmbientSoundButton: View {
    let sound: AmbientSound
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: sound.icon)
                    .font(.title3)
                    .frame(width: 44, height: 44)
                    .background(isSelected ? Color.accentColor.opacity(0.2) : Color.gray.opacity(0.1))
                    .cornerRadius(10)
                Text(sound.rawValue)
                    .font(.caption2)
                    .foregroundColor(isSelected ? .accentColor : .secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

struct StatBadge: View {
    let icon: String
    let value: String
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.caption)
                Text(value)
                    .font(.system(.callout, weight: .bold))
            }
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct FocusButtonStyle: ButtonStyle {
    let color: Color
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(color.opacity(configuration.isPressed ? 0.7 : 0.15))
            .foregroundColor(color)
            .cornerRadius(8)
    }
}

struct SettingsView: View {
    @ObservedObject var timerManager = TimerManager.shared
    @State private var focusMinutes: Int = 25
    @State private var shortBreakMinutes: Int = 5
    @State private var longBreakMinutes: Int = 15
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings")
                .font(.headline)
            
            LabeledContent("Focus (minutes)") {
                Stepper("\(focusMinutes)", value: $focusMinutes, in: 1...120)
                    .onChange(of: focusMinutes) { newVal in
                        timerManager.focusDuration = newVal * 60
                    }
            }
            
            LabeledContent("Short Break (minutes)") {
                Stepper("\(shortBreakMinutes)", value: $shortBreakMinutes, in: 1...30)
                    .onChange(of: shortBreakMinutes) { newVal in
                        timerManager.shortBreakDuration = newVal * 60
                    }
            }
            
            LabeledContent("Long Break (minutes)") {
                Stepper("\(longBreakMinutes)", value: $longBreakMinutes, in: 1...60)
                    .onChange(of: longBreakMinutes) { newVal in
                        timerManager.longBreakDuration = newVal * 60
                    }
            }
        }
        .padding(20)
        .frame(width: 280, height: 200)
    }
}
