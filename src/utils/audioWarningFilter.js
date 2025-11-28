let installed = false;

const CORE_AUDIO_PATTERNS = [
  /coreaudio\.c:\d+.*buffer underflow/i,
  /coreaudio\.c:\d+.*FindNextComponent failed/i
];

export const installAudioWarningFilter = () => {
  if (installed || !process?.stderr?.write) {
    installed = true;
    return;
  }
  const originalWrite = process.stderr.write.bind(process.stderr);
  let warned = false;
  process.stderr.write = (chunk, encoding, cb) => {
    try {
      const text = typeof chunk === 'string' ? chunk : chunk?.toString(encoding || 'utf8');
      if (text && CORE_AUDIO_PATTERNS.some((regex) => regex.test(text))) {
        if (!warned) {
          process.stdout?.write?.('[audio] CoreAudio warning suppressed\n');
          warned = true;
        }
        if (typeof cb === 'function') {
          cb();
        }
        return true;
      }
    } catch {
      // fall through
    }
    return originalWrite(chunk, encoding, cb);
  };
  installed = true;
};

export default installAudioWarningFilter;
