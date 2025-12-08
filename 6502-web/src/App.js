import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Color palette (NES-inspired)
const COLORS = [
  '#000000', // 0: Black
  '#FFFFFF', // 1: White
  '#FF0000', // 2: Red
  '#00FF00', // 3: Green
  '#0000FF', // 4: Blue
  '#FFFF00', // 5: Yellow
  '#FF00FF', // 6: Magenta
  '#00FFFF', // 7: Cyan
  '#FFA500', // 8: Orange
  '#800080', // 9: Purple
  '#FFC0CB', // A: Pink
  '#A52A2A', // B: Brown
  '#808080', // C: Gray
  '#90EE90', // D: Light Green
  '#FFB6C1', // E: Light Pink
  '#E0E0E0', // F: Light Gray
];

function DisplayScreen({ pixels, width = 32, height = 32 }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const pixelSize = 8; // Each pixel is 8x8 screen pixels
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw each pixel
    for (let i = 0; i < pixels.length; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const colorIndex = pixels[i] & 0x0F; // Use lower 4 bits for color
      
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
  const [memory, setMemory] = useState(new Array(16).fill(0));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [executionSpeed, setExecutionSpeed] = useState(100);
  
  const moduleRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('Starting WebAssembly load...');
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
          locateFile: (path) => {
            return process.env.PUBLIC_URL + '/' + path;
          }
        });
        
        console.log('Module loaded');
        
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
        
        setOutput('✅ Emulator ready!\n');
        updateRegisters();
        updateMemory();
        updateDisplay();
        
        setTimeout(runTest, 500);
        
        setIsLoading(false);
        
      } catch (err) {
        console.error('Initialization failed:', err);
        setError('Failed to load: ' + err.message);
        setIsLoading(false);
      }
    };
    
    init();
  }, []);

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!moduleRef.current) return;
      
      // Map arrow keys to memory address $FF
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
        setOutput(prev => prev + `Key pressed: ${e.key} (${keyMap[e.key].toString(16)})\n`);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateRegisters = () => {
    if (!moduleRef.current) return;
    
    try {
      const newRegs = {
        a: moduleRef.current.getA(),
        x: moduleRef.current.getX(),
        y: moduleRef.current.getY(),
        pc: moduleRef.current.getPC(),
        sp: moduleRef.current.getSP(),
        flags: moduleRef.current.getFlags()
      };
      setRegisters(newRegs);
    } catch (err) {
      console.error('Error updating registers:', err);
    }
  };

  const updateMemory = () => {
    if (!moduleRef.current) return;
    
    try {
      const newMemory = [];
      for (let i = 0; i < 16; i++) {
        newMemory.push(moduleRef.current.readMem(i));
      }
      setMemory(newMemory);
    } catch (err) {
      console.error('Error updating memory:', err);
    }
  };

  const updateDisplay = () => {
    if (!moduleRef.current) return;
    
    try {
      // Read video memory ($0200-$05FF = 1024 bytes = 32x32 pixels)
      const newDisplay = [];
      for (let i = 0; i < 1024; i++) {
        newDisplay.push(moduleRef.current.readMem(0x0200 + i));
      }
      setDisplayPixels(newDisplay);
    } catch (err) {
      console.error('Error updating display:', err);
    }
  };

  const runTest = () => {
    if (!moduleRef.current) return;
    
    try {
      console.log('=== STARTING TEST ===');
      setOutput('Running test...\n');
      
      moduleRef.current.writeMem(0x0600, 0xA9);
      moduleRef.current.writeMem(0x0601, 0x05);
      moduleRef.current.writeMem(0x0602, 0x00);
      
      moduleRef.current.writeMem(0xFFFC, 0x00);
      moduleRef.current.writeMem(0xFFFD, 0x06);
      
      moduleRef.current.reset();
      
      const opcode = moduleRef.current.step();
      updateRegisters();
      updateMemory();
      updateDisplay();
      
      const a = moduleRef.current.getA();
      setOutput(prev => prev + `Test complete! A = ${a} (expected: 5)\n`);
      
      console.log('=== TEST COMPLETE ===');
      
    } catch (err) {
      console.error('Test failed:', err);
      setError('Test error: ' + err.message);
    }
  };

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
        'BRK': 0x00,
        'NOP': 0xEA,
        'ASL': 0x0A,
        'SEC': 0x38,
        'CLC': 0x18
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
                const value = parseInt(match[1], 16);
                program.push(value);
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
      
      setOutput(`✅ Loaded ${program.length} bytes at $${startAddr.toString(16).toUpperCase()}\n`);
      
      updateRegisters();
      updateMemory();
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
      updateMemory();
      updateDisplay();
      
      setOutput(prev => prev + `Executed: $${opcode.toString(16).padStart(2, '0')}\n`);
      
      if (opcode === 0x00) {
        setOutput(prev => prev + '⛔ Program halted (BRK)\n');
      }
    } catch (err) {
      setError('Step error: ' + err.message);
    }
  };

  const run = () => {
    if (isRunning) {
      setIsRunning(false);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      return;
    }
    
    setIsRunning(true);
    setOutput(prev => prev + '▶️ Running...\n');
    
    let stepCount = 0;
    const maxSteps = 100000;
    
    const execute = () => {
      if (!moduleRef.current) {
        setIsRunning(false);
        return;
      }
      
      try {
        const opcode = moduleRef.current.step();
        stepCount++;
        
        if (stepCount % 100 === 0) {
          updateRegisters();
          updateMemory();
          updateDisplay();
        }
        
        if (opcode === 0x00) {
          updateRegisters();
          updateMemory();
          updateDisplay();
          setOutput(prev => prev + `⛔ Program completed after ${stepCount} steps\n`);
          setIsRunning(false);
          return;
        }
        
        if (stepCount >= maxSteps) {
          setOutput(prev => prev + `⚠️ Stopped after ${maxSteps} steps\n`);
          setIsRunning(false);
          return;
        }
        
        if (isRunning) {
          animationRef.current = setTimeout(execute, executionSpeed);
        }
      } catch (err) {
        setError('Runtime error: ' + err.message);
        setIsRunning(false);
      }
    };
    
    execute();
  };

  const reset = () => {
    setIsRunning(false);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    
    if (moduleRef.current) {
      moduleRef.current.reset();
      updateRegisters();
      updateMemory();
      updateDisplay();
    }
    
    setOutput(prev => prev + '🔄 CPU reset\n');
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
      'snake': `; Simple pixel movement
; Use WASD or arrows
LDA #$10
STA $00
STA $01

LOOP:
LDA $FF
CMP #$80
BEQ UP
CMP #$81
BEQ DOWN
CMP #$82
BEQ LEFT
CMP #$83
BEQ RIGHT
JMP DRAW

UP:
DEC $01
JMP DRAW
DOWN:
INC $01
JMP DRAW
LEFT:
DEC $00
JMP DRAW
RIGHT:
INC $00

DRAW:
LDA #$01
STA $0310
BRK`,
      'rainbow': `; Rainbow pattern
LDX #$00
LOOP:
TXA
STA $0200,X
INX
BNE LOOP
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
        <h1>🖥️ 6502 WebAssembly Emulator</h1>
        <p>Run 6502 assembly with graphics • Use WASD/Arrows for input</p>
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
                    📥 Load
                  </button>
                  <button onClick={step} className="btn" disabled={isRunning}>
                    ⏭️ Step
                  </button>
                  <button onClick={run} className={`btn ${isRunning ? 'btn-danger' : 'btn-success'}`}>
                    {isRunning ? '⏸️ Stop' : '▶️ Run'}
                  </button>
                  <button onClick={reset} className="btn">
                    🔄 Reset
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
                <div className="error">❌ {error}</div>
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
                  <label>Input</label>
                  <div className="value">${moduleRef.current ? moduleRef.current.readMem(0xFF).toString(16).padStart(2, '0').toUpperCase() : '00'}</div>
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
