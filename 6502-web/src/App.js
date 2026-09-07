import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { assemble } from './assembler.js';

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#800080', '#FFC0CB', '#A52A2A',
  '#808080', '#90EE90', '#FFB6C1', '#E0E0E0',
];

function DisplayScreen({ pixels, width = 32, height = 32 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pixelSize = 8;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.length; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      ctx.fillStyle = COLORS[pixels[i] & 0x0F];
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }, [pixels, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width * 8}
      height={height * 8}
      className="screen-canvas"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function App() {
  const [code, setCode] = useState(`; Count from 1 to 10, store the result at $0200
      LDX #$00
loop: INX
      TXA
      STA $0200
      CMP #$0A
      BNE loop
      BRK`);

  const [output, setOutput] = useState('');
  const [registers, setRegisters] = useState({
    a: 0, x: 0, y: 0, pc: 0, sp: 0xFF, flags: 0x24
  });
  const [displayPixels, setDisplayPixels] = useState(new Array(1024).fill(0));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [executionSpeed, setExecutionSpeed] = useState(20);
  const [instructionCount, setInstructionCount] = useState(0);

  const moduleRef = useRef(null);
  const animationRef = useRef(null);
  const isRunningRef = useRef(false);
  const speedRef = useRef(executionSpeed);
  speedRef.current = executionSpeed;
  const codeRef = useRef(null);

  // Pressing Tab inserts two spaces instead of moving focus away.
  const onEditorKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = codeRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = code.slice(0, start) + '  ' + code.slice(end);
    setCode(next);
    requestAnimationFrame(() => {
      el.selectionStart = start + 2;
      el.selectionEnd = start + 2;
    });
  };

  const updateRegisters = useCallback(() => {
    if (!moduleRef.current) return;
    try {
      setRegisters({
        a: moduleRef.current.getA(),
        x: moduleRef.current.getX(),
        y: moduleRef.current.getY(),
        pc: moduleRef.current.getPC(),
        sp: moduleRef.current.getSP(),
        flags: moduleRef.current.getFlags()
      });
    } catch (err) {
      console.error('Error updating registers:', err);
    }
  }, []);

  const updateDisplay = useCallback(() => {
    if (!moduleRef.current) return;
    try {
      const newDisplay = [];
      for (let i = 0; i < 1024; i++) {
        newDisplay.push(moduleRef.current.readMem(0x0200 + i));
      }
      setDisplayPixels(newDisplay);
    } catch (err) {
      console.error('Error updating display:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setOutput('Loading WebAssembly...\n');

        if (typeof window.createEmulatorModule === 'undefined') {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = process.env.PUBLIC_URL + '/emulator.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load emulator.js'));
            document.head.appendChild(script);
          });
        }

        const Module = await window.createEmulatorModule({
          locateFile: (path) => process.env.PUBLIC_URL + '/' + path
        });

        moduleRef.current = {
          reset: Module.cwrap('js_reset', null, []),
          step: Module.cwrap('js_step', 'number', []),
          clearMem: Module.cwrap('js_clear_mem', null, []),
          writeMem: Module.cwrap('js_write_mem', null, ['number', 'number']),
          readMem: Module.cwrap('js_read_mem', 'number', ['number']),
          getA: Module.cwrap('js_get_a', 'number', []),
          getX: Module.cwrap('js_get_x', 'number', []),
          getY: Module.cwrap('js_get_y', 'number', []),
          getPC: Module.cwrap('js_get_pc', 'number', []),
          getSP: Module.cwrap('js_get_sp', 'number', []),
          getFlags: Module.cwrap('js_get_flags', 'number', [])
        };

        moduleRef.current.reset();
        setOutput('Emulator ready!\n');
        setIsLoading(false);
      } catch (err) {
        console.error('Initialization failed:', err);
        setError('Failed to load: ' + err.message);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!moduleRef.current) return;
      // Never steal keys while the user is typing in the editor.
      const el = e.target;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
        return;
      }
      const keyMap = {
        'ArrowUp': 0x80,
        'ArrowDown': 0x81,
        'ArrowLeft': 0x82,
        'ArrowRight': 0x83,
        ' ': 0x20,
        'w': 0x80,
        's': 0x81,
        'a': 0x82,
        'd': 0x83
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        moduleRef.current.writeMem(0xFF, keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const assembleAndLoad = () => {
    try {
      setError('');
      const result = assemble(code);
      if (result.error) {
        setError(result.error);
        return;
      }
      const program = result.bytes;
      if (program.length === 0) {
        setError('No instructions to load');
        return;
      }

      const startAddr = 0x1000;
      moduleRef.current.clearMem();
      program.forEach((byte, i) => {
        moduleRef.current.writeMem(startAddr + i, byte);
      });
      moduleRef.current.writeMem(0xFFFC, startAddr & 0xFF);
      moduleRef.current.writeMem(0xFFFD, (startAddr >> 8) & 0xFF);
      moduleRef.current.reset();

      setInstructionCount(program.length);
      setOutput(`Loaded ${program.length} bytes at $${startAddr.toString(16).toUpperCase()}\n`);
      updateRegisters();
      updateDisplay();
    } catch (err) {
      setError('Assembly error: ' + err.message);
    }
  };

  const step = () => {
    if (!moduleRef.current) return;
    try {
      const opcode = moduleRef.current.step();
      const pc = moduleRef.current.getPC();
      updateRegisters();
      updateDisplay();
      setOutput(prev => prev + `Step -> PC $${pc.toString(16).padStart(4, '0')}  opcode $${opcode.toString(16).padStart(2, '0')}\n`);
      if (opcode === 0x00) {
        setOutput(prev => prev + 'Program halted (BRK)\n');
      }
    } catch (err) {
      setError('Step error: ' + err.message);
    }
  };

  const run = () => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsRunning(false);
      if (animationRef.current) clearTimeout(animationRef.current);
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);
    setError('');
    setOutput(prev => prev + 'Running...\n');

    let stepCount = 0;
    const maxSteps = 1000000;

    const execute = () => {
      if (!moduleRef.current || !isRunningRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        return;
      }

      try {
        // Run a batch of instructions per tick for smoother speed control.
        const batch = 50;
        let opcode = 0;
        for (let i = 0; i < batch && isRunningRef.current; i++) {
          opcode = moduleRef.current.step();
          stepCount++;
          if (opcode === 0x00 || stepCount >= maxSteps) break;
        }

        updateRegisters();
        updateDisplay();

        if (opcode === 0x00) {
          setOutput(prev => prev + `Program completed after ${stepCount} steps\n`);
          isRunningRef.current = false;
          setIsRunning(false);
          return;
        }
        if (stepCount >= maxSteps) {
          setOutput(prev => prev + `Stopped after ${maxSteps} steps\n`);
          isRunningRef.current = false;
          setIsRunning(false);
          return;
        }

        animationRef.current = setTimeout(execute, speedRef.current);
      } catch (err) {
        setError('Runtime error: ' + err.message);
        isRunningRef.current = false;
        setIsRunning(false);
      }
    };

    execute();
  };

  const reset = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    if (animationRef.current) clearTimeout(animationRef.current);

    if (moduleRef.current) {
      moduleRef.current.reset();
      updateRegisters();
      updateDisplay();
    }

    setOutput('CPU reset\n');
    setError('');
  };

  const loadExample = (exampleName) => {
    const examples = {
      'counter': `; Count from 1 to 10, store the result at $0200
      LDX #$00
loop: INX
      TXA
      STA $0200
      CMP #$0A
      BNE loop
      BRK`,
      'rainbow': `; Fill the first 16 pixels with colors 0-15
      LDX #$00
loop: TXA
      STA $0200,X
      INX
      CPX #$10
      BNE loop
      BRK`,
      'draw': `; Draw a simple smiley face
      LDA #$0F
      STA $0228
      STA $022B
      LDA #$05
      STA $0308
      STA $0309
      STA $030A
      STA $030B
      BRK`
    };

    if (examples[exampleName]) {
      setCode(examples[exampleName]);
      setOutput(`Loaded example: ${exampleName}\n`);
      setError('');
    }
  };

  const formatFlags = (flags) => {
    return [
      { name: 'N', set: (flags & 0x80) !== 0 },
      { name: 'V', set: (flags & 0x40) !== 0 },
      { name: '-', set: (flags & 0x20) !== 0 },
      { name: 'B', set: (flags & 0x10) !== 0 },
      { name: 'D', set: (flags & 0x08) !== 0 },
      { name: 'I', set: (flags & 0x04) !== 0 },
      { name: 'Z', set: (flags & 0x02) !== 0 },
      { name: 'C', set: (flags & 0x01) !== 0 },
    ];
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-name">6502<span className="brand-dot">.wasm</span></span>
          <span className={`brand-status ${isRunning ? 'running' : ''}`}>
            <span className={`led ${isRunning ? 'on blink' : ''}`}></span>
            {isLoading ? 'BOOTING' : isRunning ? 'RUNNING' : 'READY'}
          </span>
        </div>
        <p className="tagline">
          type 6502 assembly &middot; load &middot; run &middot; video RAM $0200&ndash;$05FF drives the 32&times;32 screen
        </p>
      </header>

      <div className="container">
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            Loading WebAssembly...
          </div>
        ) : (
          <>
            <div className="panel code-panel">
              <div className="panel-header">
                <h3>Assembly Code</h3>
                <div className="buttons">
                  <button onClick={assembleAndLoad} className="btn btn-primary">
                    Load
                  </button>
                  <button onClick={step} className="btn" disabled={isRunning}>
                    Step
                  </button>
                  <button onClick={run} className={`btn ${isRunning ? 'btn-danger' : 'btn-success'}`}>
                    {isRunning ? 'Stop' : 'Run'}
                  </button>
                  <button onClick={reset} className="btn">
                    Reset
                  </button>
                </div>
              </div>

              <div className="speed-block">
                <label>
                  <span className="speed-label">SPEED&nbsp;</span>
                  <span className="speed-value">{executionSpeed}ms</span>
                  <input
                    type="range"
                    min="1"
                    max="500"
                    value={executionSpeed}
                    onChange={(e) => setExecutionSpeed(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="example-bar">
                <span className="example-hint">examples:</span>
                <button onClick={() => loadExample('counter')} className="btn">Counter</button>
                <button onClick={() => loadExample('rainbow')} className="btn">Rainbow</button>
                <button onClick={() => loadExample('draw')} className="btn">Smiley</button>
              </div>

              <textarea
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={onEditorKeyDown}
                className="code-editor"
                spellCheck={false}
                aria-label="Assembly code editor"
              />

              <div className="panel-header">
                <h3>Output</h3>
                <small className="dim-label">{instructionCount} bytes</small>
              </div>
              <pre className="output" aria-live="polite">{output}</pre>

              {error && (
                <div className="error">{error}</div>
              )}
            </div>

            <div className="panel registers-panel">
              <div className="panel-header">
                <h3>Display <span className="dim-label">32x32 px</span></h3>
                <small className="dim-label">video RAM $0200-$05FF</small>
              </div>

              <div className="screen-bezel">
                <div className="screen-crt">
                  <DisplayScreen pixels={displayPixels} />
                </div>
              </div>

              <div className="panel-header">
                <h3>CPU State</h3>
              </div>

              <div className="registers">
                <div className="register">
                  <label>A</label>
                  <div className="value">${registers.a.toString(16).padStart(2, '0').toUpperCase()}</div>
                  <div className="decimal">({registers.a})</div>
                </div>
                <div className="register">
                  <label>X</label>
                  <div className="value">${registers.x.toString(16).padStart(2, '0').toUpperCase()}</div>
                  <div className="decimal">({registers.x})</div>
                </div>
                <div className="register">
                  <label>Y</label>
                  <div className="value">${registers.y.toString(16).padStart(2, '0').toUpperCase()}</div>
                  <div className="decimal">({registers.y})</div>
                </div>
                <div className="register">
                  <label>PC</label>
                  <div className="value">${registers.pc.toString(16).padStart(4, '0').toUpperCase()}</div>
                </div>
                <div className="register">
                  <label>SP</label>
                  <div className="value">${registers.sp.toString(16).padStart(2, '0').toUpperCase()}</div>
                </div>
                <div className="register">
                  <label>Flags</label>
                  <div className="value">${registers.flags.toString(16).padStart(2, '0').toUpperCase()}</div>
                </div>
              </div>

              <div className="flags">
                {formatFlags(registers.flags).map((flag, i) => (
                  <div key={i} className={`flag ${flag.set ? 'active' : ''}`} title={flag.name}>
                    {flag.name}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
