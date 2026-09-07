# 6502 Emulator in C, WebAssembly and React

A 65C02 CPU emulator written in C, compiled to WebAssembly, with a React front end.
It features a 32x32 pixel display (video RAM at `$0200`–`$05FF`) and a built-in
assembler with label support.

Live demo: https://deft-shortbread-93751e.netlify.app/

## Features

- 65C02 instruction set (including `BRA`, `PHX/PHY`, `PLX/PLY`, `STZ`, `TRB`, `TSB`, `INA`, `DEA`).
- Two-pass assembler with labels, comments and full addressing-mode support.
- Step, run, reset and a speed slider.
- CPU register and flag viewer.
- Keyboard input mapped to `$FF` (`WASD` / arrow keys).

## Project layout

- `func_web.c` / `func_web.h` — CPU core (decode + execute).
- `operations.c` / `operations.h` — ALU operations and stack handling.
- `emscripten_wrapper.c` — JavaScript bindings.
- `registers.h` — shared register/memory declarations.
- `6502-web/` — React front end.

## Building

Requires [Emscripten](https://emscripten.org/).

```bash
make web        # build emulator.js and emulator.wasm
make deploy     # copy the wasm build into 6502-web/public/
cd 6502-web && npm install && npm start
```

The front end loads the WebAssembly module from `public/emulator.js`.
