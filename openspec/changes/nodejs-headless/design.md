# Node.js Headless Architecture Design

## Overall Architecture

### Layer Structure
```
┌─────────────────────────────────────┐
│           CLI Interface             │
├─────────────────────────────────────┤
│        Configuration Layer          │
├─────────────────────────────────────┤
│      Emulator Core (Browser)        │
├─────────────────────────────────────┤
│    Node.js Adaptation Layer         │
├─────────────────────────────────────┤
│   Canvas/Audio/Input Polyfills      │
├─────────────────────────────────────┤
│     File System Abstraction         │
└─────────────────────────────────────┘
```

### Core Components

#### 1. CLI Interface (`src/cli.js`)
- Command-line argument parsing
- Configuration file support
- Progress reporting
- Error handling

#### 2. Node.js Canvas Adapter (`src/adapters/canvas.js`)
- Replaces HTML5 Canvas with node-canvas
- Provides 2D rendering context
- Handles pixel format conversion
- Supports PNG/JPEG output

#### 3. Audio Null Adapter (`src/adapters/audio.js`)
- Replaces Web Audio API with null implementation
- Maintains API compatibility
- Optional: WAV file output

#### 4. Input Null Adapter (`src/adapters/input.js`)
- Replaces keyboard/gamepad input
- Supports pre-recorded input sequences
- Enables automated testing

#### 5. File System Layer (`src/fs/rom-loader.js`, `src/fs/frame-writer.js`)
- ROM file loading
- Frame output management
- Directory structure creation
- Progress tracking

## Technical Design Decisions

### Canvas Implementation
- **Library**: `canvas` npm package (node-canvas)
- **Format**: 240×160 native resolution, 24-bit RGB
- **Output**: PNG files with configurable quality
- **Performance**: Hardware acceleration when available

### Memory Management
- **Buffer Strategy**: Pre-allocated frame buffers
- **Garbage Collection**: Minimize allocations in render loop
- **Streaming**: Optional frame streaming for large outputs

### Error Handling
- **Graceful Degradation**: Continue emulation on non-critical errors
- **Logging**: Structured logging with levels
- **Recovery**: Automatic retry for file system operations

### Performance Considerations
- **Frame Skipping**: Configurable frame rate for performance
- **Batch Processing**: Multiple ROM processing support
- **Resource Limits**: Memory usage monitoring
- **Parallel Processing**: Worker threads for heavy operations

## Integration Points

### Browser Compatibility Layer
- Minimal changes to existing emulator core
- Polyfills for browser-specific APIs
- Conditional compilation for browser/Node.js builds

### Configuration System
- JSON configuration files
- Environment variable support
- Command-line argument override
- Default settings for common use cases

### Output Formats
- **Individual Frames**: PNG files with sequential numbering
- **Video Compilation**: Optional FFmpeg integration
- **Metadata**: JSON files with frame timing information
- **Thumbnails**: Small preview images