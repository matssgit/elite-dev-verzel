import process from 'node:process';
// Disabled before reading stdin or starting any child. Terminal tool inputs can
// be retained outside the process even when the terminal itself does not echo.
process.stderr.write('Disabled: configure credentials directly in protected provider settings. Do not send secrets through terminal input.\n');
process.exitCode=1;
