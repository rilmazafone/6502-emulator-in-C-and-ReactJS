import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

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
      const colorIndex = pixels[i] & 0x0F;

      ctx.fillStyle = COLORS[colorIndex];
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }, [pixels, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width * 8}
      height={height * 8}
      style={{
        border: '2px solid #667eea',
        borderRadius: '4px',
        imageRendering: 'pixelated',
        width: '256px',
        height: '256px'
      }}
    />
  );
}

function App() {
  const [code, setCode] = useState(`; Draw a pixel at center
LDA #$01
STA $0310
BRK`);

  const [output, setOutput] = useState('');
  const [registers, setRegisters] = useState({
    a: 0, x: 0, y: 0, pc: 0, sp: 0xFF, flags: 0x20
  });
  const [displayPixels, setDisplayPixels] = useState(new Array(1024).fill(0));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [executionSpeed, setExecutionSpeed] = useState(100);

  const moduleRef = useRef(null);
  const animationRef = useRef(null);
  const isRunningRef = useRef(false);

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
          init: Module.cwrap('js_init', null, []),
          reset: Module.cwrap('js_reset', null, []),
          step: Module.cwrap('js_step', 'number', []),
          writeMem: Module.cwrap('js_write_mem', null, ['number', 'number']),
          readMem: Module.cwrap('js_read_mem', 'number', ['number']),
          getA: Module.cwrap('js_get_a', 'number', []),
          getX: Module.cwrap('js_get_x', 'number', []),
          getY: Module.cwrap('js_get_y', 'number', []),
          getPC: Module.cwrap('js_get_pc', 'number', []),
          getSP: Module.cwrap('js_get_sp', 'number', []),
          getFlags: Module.cwrap('js_get_flags', 'number', []),
          setPC: Module.cwrap('js_set_pc', null, ['number'])
        };

        moduleRef.current.init();
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
      const program = [];
      const lines = code.split('\n');

      const opcodes = {
        'LDA #$': 0xA9,
        'STA $': 0x8D,
        'ADC #$': 0x69,
        'SBC #$': 0xE9,
        'LDX #$': 0xA2,
        'LDY #$': 0xA0,
        'STX $': 0x8E,
        'STY $': 0x8C,
        'CMP #$': 0xC9,
        'CPX #$': 0xE0,
        'CPY #$': 0xC0,
        'AND #$': 0x29,
        'ORA #$': 0x09,
        'EOR #$': 0x49,
        'TAX': 0xAA,
        'TAY': 0xA8,
        'TXA': 0x8A,
        'TYA': 0x98,
        'INX': 0xE8,
        'INY': 0xC8,
        'DEX': 0xCA,
        'DEY': 0x88,
        'INA': 0x1A,
        'DEA': 0x3A,
        'PHA': 0x48,
        'PLA': 0x68,
        'PHP': 0x08,
        'PLP': 0x28,
        'BRK': 0x00,
        'NOP': 0xEA,
        'ASL': 0x0A,
        'LSR': 0x4A,
        'ROL': 0x2A,
        'ROR': 0x6A,
        'SEC': 0x38,
        'CLC': 0x18,
        'SEI': 0x78,
        'CLI': 0x58,
        'SED': 0xF8,
        'CLD': 0xD8,
        'CLV': 0xB8,
        'RTS': 0x60,
        'RTI': 0x40
      };

      for (const line of lines) {
        const trimmed = line.split(';')[0].trim();
        if (!trimmed) continue;

        let found = false;
        for (const [pattern, opcode] of Object.entries(opcodes)) {
          if (trimmed.toUpperCase().startsWith(pattern.replace('$', ''))) {
            program.push(opcode);

            if (pattern.includes('#$')) {
              const match = trimmed.match(/#\$([0-9A-Fa-f]+)/);
              if (match) {
                program.push(parseInt(match[1], 16));
              }
            } else if (pattern.includes('$') && !pattern.includes('#')) {
              const match = trimmed.match(/\$([0-9A-Fa-f]+)/);
              if (match) {
                const addr = parseInt(match[1], 16);
                program.push(addr & 0xFF);
                program.push((addr >> 8) & 0xFF);
              }
            }

            found = true;
            break;
          }
        }

        if (!found) {
          setError(`Unknown instruction: ${trimmed}`);
          return;
        }
      }

      if (program.length === 0) {
        setError('No instructions to load');
        return;
      }

      const startAddr = 0x1000;
      program.forEach((byte, i) => {
        moduleRef.current.writeMem(startAddr + i, byte);
      });

      moduleRef.current.writeMem(0xFFFC, startAddr & 0xFF);
      moduleRef.current.writeMem(0xFFFD, (startAddr >> 8) & 0xFF);

      moduleRef.current.reset();

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
      updateRegisters();
      updateDisplay();

      setOutput(prev => prev + `Executed: $${opcode.toString(16).padStart(2, '0')}\n`);

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
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);
    setOutput(prev => prev + 'Running...\n');

    let stepCount = 0;
    const maxSteps = 100000;

    const execute = () => {
      if (!moduleRef.current || !isRunningRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        return;
      }

      try {
        const opcode = moduleRef.current.step();
        stepCount++;

        if (stepCount % 100 === 0) {
          updateRegisters();
          updateDisplay();
        }

        if (opcode === 0x00) {
          updateRegisters();
          updateDisplay();
          setOutput(prev => prev + `Program completed after ${stepCount} steps\n`);
          isRunningRef.current = false;
          setIsRunning(false);
          return;
        }

        if (stepCount >= maxSteps) {
          updateRegisters();
          updateDisplay();
          setOutput(prev => prev + `Stopped after ${maxSteps} steps\n`);
          isRunningRef.current = false;
          setIsRunning(false);
          return;
        }

        animationRef.current = setTimeout(execute, executionSpeed);
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
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }

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
      'draw': `; Draw a smiley face
LDA #$01
STA $0248
STA $024B
LDA #$02
STA $0388
STA $0389
STA $038A
STA $038B
BRK`,
      'counter': `; Count from 0 to 10
LDA #$00
ADC #$01
ADC #$01
ADC #$01
ADC #$01
ADC #$01
ADC #$01
ADC #$01
ADC #$01
ADC #$01
ADC #$01
BRK`,
      'rainbow': `; Fill display with colors
LDX #$00
LDA #$00
STA $0200
INA
STA $0201
INA
STA $0202
INA
STA $0203
INA
STA $0204
INA
STA $0205
INA
STA $0206
INA
STA $0207
INA
STA $0208
INA
STA $0209
INA
STA $020A
INA
STA $020B
INA
STA $020C
INA
STA $020D
INA
STA $020E
INA
STA $020F
BRK`
    };

    if (examples[exampleName]) {
      setCode(examples[exampleName]);
      setOutput(`Loaded example: ${exampleName}\n`);
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
      <header>
        <h1>6502 WebAssembly Emulator</h1>
        <p>Run 6502 assembly with graphics</p>
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

              <div style={{ padding: '1rem', background: '#2a2a2a' }}>
                <label style={{ fontSize: '0.9rem', color: '#808080' }}>
                  Speed: {executionSpeed}ms
                  <input
                    type="range"
                    min="10"
                    max="500"
                    value={executionSpeed}
                    onChange={(e) => setExecutionSpeed(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  />
                </label>
              </div>

              <div style={{ padding: '0 1rem 1rem', background: '#2a2a2a', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => loadExample('draw')} className="btn" style={{ flex: 1 }}>
                  Draw
                </button>
                <button onClick={() => loadExample('counter')} className="btn" style={{ flex: 1 }}>
                  Counter
                </button>
                <button onClick={() => loadExample('rainbow')} className="btn" style={{ flex: 1 }}>
                  Rainbow
                </button>
              </div>

              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="code-editor"
                spellCheck={false}
                rows={12}
              />

              <div className="panel-header">
                <h3>Output</h3>
              </div>
              <pre className="output">{output}</pre>

              {error && (
                <div className="error">{error}</div>
              )}
            </div>

            <div className="panel registers-panel">
              <div className="panel-header">
                <h3>Display (32x32 pixels)</h3>
                <small style={{ opacity: 0.7 }}>Video RAM: $0200-$05FF</small>
              </div>

              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', background: '#1a1a1a' }}>
                <DisplayScreen pixels={displayPixels} />
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
