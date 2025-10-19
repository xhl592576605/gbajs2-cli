# Project Context

## Purpose
**gbajs2** is a Game Boy Advance emulator written in pure JavaScript using HTML5 technologies. The primary goal is to provide accurate GBA emulation that runs in any modern web browser without requiring plugins or server-side processing. This is a community fork of the original gbajs project, focused on maintaining compatibility and adding modern web standards support.

Key objectives:
- Accurate hardware emulation of the GBA system
- Cross-browser compatibility without plugins
- Real-time performance for playable gaming experience
- Save state persistence and ROM loading from local files
- Developer-friendly debugging capabilities

## Tech Stack
- **Language**: Pure JavaScript (ES6+)
- **Graphics**: HTML5 Canvas API
- **Audio**: Web Audio API
- **Input**: Keyboard events and gamepad support
- **Storage**: Local storage for save states
- **Build Tools**: None (zero-dependency frontend project)
- **Code Formatting**: Prettier with 4-space tabs, single quotes
- **Browser Support**: Modern browsers with Canvas and Web Audio support

## Project Conventions

### Code Style
- **Indentation**: 4 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Naming**: PascalCase for classes, camelCase for methods/variables, UPPER_CASE for constants
- **File Structure**: One class per file, organized by hardware component
- **Comments**: JSDoc style for public APIs, inline comments for complex logic
- **Error Handling**: Graceful degradation with user-friendly error messages

### Architecture Patterns
- **Modular Design**: Each hardware component (CPU, GPU, Audio, etc.) is a separate class
- **Memory-Mapped I/O**: GBA hardware registers mapped to specific memory addresses
- **Event-Driven**: Input handling and frame timing via browser events
- **State Management**: Centralized emulator state with save/load capabilities
- **Observer Pattern**: Components communicate through event callbacks

### Testing Strategy
- **Manual Testing**: Load ROM files and verify gameplay functionality
- **Browser Testing**: Test across Chrome, Firefox, Safari, and Edge
- **Performance Testing**: Monitor frame rates and audio latency
- **Compatibility Testing**: Test with various commercial ROMs
- **Regression Testing**: Verify save/load functionality after changes

### Git Workflow
- **Branching**: Feature branches from master, named `feature/description`
- **Commits**: Descriptive messages in present tense
- **Pull Requests**: Required for all changes, peer review encouraged
- **Releases**: Tagged releases for stable versions
- **Issues**: Use GitHub issues for bug reports and feature requests

## Domain Context

### GBA Hardware Knowledge
- **CPU**: ARM7TDMI 16.78 MHz processor with ARM and Thumb instruction sets
- **Memory**: 32KB internal RAM, 256KB external RAM, 96KB VRAM
- **Display**: 240×160 pixels, 32,768 colors, 60 FPS
- **Audio**: 6-channel PCM/ADPCM with stereo output
- **Input**: D-pad, A/B buttons, L/R triggers, Start/Select
- **Cartridge**: Up to 32MB ROM with battery-backed SRAM for saves

### Emulation Concepts
- **Cycle Accuracy**: Timing-sensitive operations must match real hardware
- **Memory Banking**: ROM access patterns affect performance
- **Interrupt Handling**: VBlank, HBlank, and serial interrupts
- **DMA Transfers**: Direct memory access for efficient data movement
- **Sprite Rendering**: OAM (Object Attribute Memory) for sprites
- **Tile-Based Graphics**: Background layers using tile maps and character data

## Important Constraints
- **Browser Security**: Cannot access local files without user interaction
- **Performance**: Must maintain 60 FPS on modern hardware
- **Memory**: Limited by browser JavaScript heap size
- **Audio Latency**: Web Audio API has minimum latency requirements
- **Legal**: Cannot distribute copyrighted BIOS or ROM files
- **Compatibility**: Must handle edge cases in commercial games

## External Dependencies
- **GBA BIOS**: Required 16KB system ROM (user must provide)
- **Game ROMs**: Commercial game files (user must provide legally)
- **Browser APIs**: Canvas 2D context, Web Audio API, FileReader API
- **No External Services**: Runs entirely client-side with no server dependencies
