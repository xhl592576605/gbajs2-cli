# CLI Interface Specification

## Capability: Command-Line Interface

### ADDED Requirements

#### Requirement 1: ROM Loading
**ADDED**: The CLI MUST accept ROM file paths as positional arguments.

**Scenario**: User runs `node gba-emulator.js game.gba --output ./frames`

**Acceptance Criteria**:
- Supports .gba file extension
- Validates file existence and readability
- Provides clear error messages for invalid files
- Supports relative and absolute paths

#### Scenario: ROM file loading
Given a valid .gba file path
When CLI processes the ROM
Then the file is loaded successfully
And ROM header validation passes

#### Requirement 2: Output Directory Configuration
**ADDED**: The CLI MUST allow specification of output directory via `--output` flag.

**Scenario**: User specifies `--output ./my-game-frames`

**Acceptance Criteria**:
- Creates directory if it doesn't exist
- Validates directory write permissions
- Supports nested directory creation
- Provides meaningful error for permission issues

#### Scenario: Directory creation
Given a non-existent output directory path
When CLI starts processing
Then the directory is created automatically
And write permissions are validated

#### Requirement 3: Frame Rate Control
**ADDED**: The CLI MUST support configurable frame rate via `--fps` flag.

**Scenario**: User runs with `--fps 30` to capture every other frame.

**Acceptance Criteria**:
- Accepts integer values 1-60
- Defaults to 60 FPS (capture every frame)
- Skips frames efficiently without processing overhead
- Maintains timing accuracy

#### Requirement 4: Duration Limiting
**ADDED**: The CLI MUST support `--duration` flag to limit emulation time.

**Scenario**: User runs `--duration 10` to capture 10 seconds of gameplay.

**Acceptance Criteria**:
- Accepts duration in seconds
- Supports decimal values (e.g., 0.5 for half second)
- Graceful shutdown after duration
- Progress reporting during execution

#### Requirement 5: Configuration File Support
**ADDED**: The CLI MUST support JSON configuration files via `--config` flag.

**Scenario**: User provides `--config emulator.json` with settings.

**Acceptance Criteria**:
- Validates JSON syntax
- Merges config with CLI arguments (CLI takes precedence)
- Supports all CLI options in JSON format
- Clear error messages for invalid configurations