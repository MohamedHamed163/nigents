// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FocusFlow",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "FocusFlow",
            path: "."
        )
    ]
)
