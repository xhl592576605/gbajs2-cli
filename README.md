# GBA Node.js Emulator

A Node.js headless Game Boy Advance emulator that can run GBA ROMs and save video output to specified folders without requiring a browser environment.

## Features

- 🎮 **Pure Node.js**: Runs entirely in Node.js environment
- 📸 **Frame Capture**: Save frames as PNG or JPEG files
- ⚡ **High Performance**: Optimized for batch processing
- 🔧 **CLI Interface**: Command-line tool with rich options
- 📁 **Flexible Output**: Configurable output directories and formats
- 🧪 **Testing Ready**: Perfect for automated testing and CI/CD

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd gbajs2-cli

# Install dependencies
npm install

# Make CLI executable
chmod +x src/cli.js
```

## Usage

### Basic Usage

```bash
# Basic frame capture
node src/cli.js game.gba --output ./frames

# With custom settings
node src/cli.js game.gba --output ./results --fps 30 --duration 5

# JPEG output with quality setting
node src/cli.js game.gba --format jpeg --quality 85
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `<rom>` | Path to GBA ROM file | Required |
| `-o, --output <dir>` | Output directory for frames | `./frames` |
| `-f, --fps <number>` | Frame rate (1-60) | `60` |
| `-d, --duration <seconds>` | Duration in seconds | `10` |
| `--format <format>` | Output format (png\|jpeg) | `png` |
| `--quality <number>` | JPEG quality (1-100) | `95` |
| `-c, --config <file>` | Configuration file path | - |
| `--no-progress` | Disable progress output | - |
| `--verbose` | Enable verbose logging | - |

### Configuration File

Create a `config.json` file:

```json
{
  "output": "./my-frames",
  "fps": 30,
  "duration": 5,
  "format": "png",
  "quality": 90
}
```

Use with:
```bash
node src/cli.js game.gba --config config.json
```

## Output Structure

```
output-directory/
├── frame_000001.png
├── frame_000002.png
├── ...
├── frame_003000.png
└── metadata.json
```

### metadata.json
```json
{
  "startTime": "2024-01-01T12:00:00.000Z",
  "endTime": "2024-01-01T12:00:10.000Z",
  "totalFrames": 3000,
  "duration": 10000,
  "format": "png",
  "quality": 95,
  "frames": [
    {
      "number": 1,
      "filename": "frame_000001.png",
      "size": 24576,
      "timestamp": 0
    }
  ]
}
```

## Development

### Project Structure

```
src/
├── cli.js              # CLI entry point
├── environment.js      # Environment detection
├── node-gba.js         # Main emulator wrapper
├── adapters/
│   ├── canvas.js       # Canvas adapter
│   ├── audio.js        # Audio adapter
│   └── input.js        # Input adapter
└── fs/
    ├── rom-loader.js   # ROM loading utilities
    └── frame-writer.js # Frame output utilities
```

### Running Tests

```bash
npm test
```

### Code Formatting

```bash
npm run format
```

## Technical Details

### Requirements

- **Node.js**: 16.0.0 or higher
- **Canvas Support**: Requires canvas native dependencies

### Platform Support

- ✅ **Linux** (Ubuntu 18.04+, CentOS 7+)
- ✅ **macOS** (10.15+)
- ✅ **Windows** (Windows 10+)

### Canvas Dependencies

The `canvas` package requires native dependencies. On most systems, these are installed automatically. If you encounter issues:

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

**macOS:**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Windows:**
Native dependencies are included in the package.

## Examples

### Batch Processing

Process multiple ROMs:

```bash
#!/bin/bash
for rom in *.gba; do
    node src/cli.js "$rom" --output "./output/${rom%.*}" --fps 30 --duration 5
done
```

### Integration with FFmpeg

Convert frames to video:

```bash
# After generating frames
ffmpeg -framerate 60 -i frames/frame_%06d.png -c:v libx264 -pix_fmt yuv420p output.mp4
```

## API Usage

### Programmatic Usage

```javascript
const { NodeGameBoyAdvance } = require('./src/node-gba');
const ROMLoader = require('./src/fs/rom-loader');
const FrameWriter = require('./src/fs/frame-writer');

async function processROM(romPath, outputDir) {
    const gba = new NodeGameBoyAdvance();
    const romData = await ROMLoader.loadROM(romPath);
    const frameWriter = new FrameWriter(outputDir);
    
    await frameWriter.initialize();
    
    // Use gba.canvas, gba.audio, gba.input for emulation
    // ...
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

BSD-2-Clause - See [COPYING](COPYING) file for details.

## Troubleshooting

### Common Issues

**Canvas installation fails:**
- Ensure you have the required native dependencies installed
- Try: `npm rebuild canvas`

**Permission errors:**
- Ensure output directory has write permissions
- Use absolute paths for better reliability

**Memory issues:**
- Reduce FPS or duration for large captures
- Monitor memory usage with `--verbose` flag