// macOS: swift scripts/generate-icons.swift
// Preserve the supplied artwork, aspect ratio and transparent corners.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let resources = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("electron/resources")
guard let source = CGImageSourceCreateWithURL(resources.appendingPathComponent("icon-source.png") as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Cannot read icon-source.png") }
let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
let iconset = temporary.appendingPathComponent("Jimyeon.iconset")
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: temporary) }

func png(_ size: Int) -> Data {
    let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
        bytesPerRow: size * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let scale = CGFloat(size) / CGFloat(max(image.width, image.height))
    let width = CGFloat(image.width) * scale, height = CGFloat(image.height) * scale
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: (CGFloat(size) - width) / 2,
        y: (CGFloat(size) - height) / 2, width: width, height: height))
    let data = NSMutableData()
    let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    precondition(CGImageDestinationFinalize(destination))
    return data as Data
}
let sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
let images = Dictionary(uniqueKeysWithValues: sizes.map { ($0, png($0)) })
try images[1024]!.write(to: resources.appendingPathComponent("icon.png"))
for size in [16, 32, 128, 256, 512] {
    try images[size]!.write(to: iconset.appendingPathComponent("icon_\(size)x\(size).png"))
    try images[size * 2]!.write(to: iconset.appendingPathComponent("icon_\(size)x\(size)@2x.png"))
}
let converter = Process()
converter.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
converter.arguments = ["-c", "icns", iconset.path, "-o", resources.appendingPathComponent("icon.icns").path]
try converter.run(); converter.waitUntilExit()
precondition(converter.terminationStatus == 0)

// ICO embeds PNG images for each Windows icon size without additional tooling.
func word(_ value: Int, _ bytes: Int) -> Data {
    Data((0..<bytes).map { UInt8((value >> ($0 * 8)) & 255) })
}
let windowsSizes = [16, 24, 32, 48, 64, 128, 256]
var ico = word(0, 2) + word(1, 2) + word(windowsSizes.count, 2)
var offset = 6 + 16 * windowsSizes.count
for size in windowsSizes {
    let bytes = images[size]!
    ico += Data([UInt8(size % 256), UInt8(size % 256), 0, 0])
    ico += word(1, 2) + word(32, 2) + word(bytes.count, 4) + word(offset, 4)
    offset += bytes.count
}
for size in windowsSizes { ico += images[size]! }
try ico.write(to: resources.appendingPathComponent("icon.ico"))
print("Generated icon.png, icon.icns and icon.ico from the supplied logo.")
