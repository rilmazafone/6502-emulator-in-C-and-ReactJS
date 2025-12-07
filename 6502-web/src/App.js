import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [code, setCode] = useState(`LDA #$05
STA $0200
LDX #$03
INX
BRK`);
  
  const [output, setOutput] = useState('');
  const [registers, setRegisters] = useState({
    a: 0, x: 0, y: 0, pc: 0, sp: 0xFF, flags: 0x20
  });
  const [memory, setMemory] = useState(new Array(16).fill(0));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const moduleRef = useRef(null);
  const animationRef = useRef(null);

  // Initialize WebAssembly
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

  const runTest = () => {
    if (!moduleRef.current) return;
    
    try {
      console.log('=== STARTING TEST ===');
      setOutput('Running test...\n');
      
      // Write test program
      console.log('Writing test program...');
      moduleRef.current.writeMem(0x0600, 0xA9); // LDA #
      moduleRef.current.writeMem(0x0601, 0x05); // #$05
      moduleRef.current.writeMem(0x0602, 0x00); // BRK
      
      // Set reset vector
      console.log('Setting reset vector...');
      moduleRef.current.writeMem(0xFFFC, 0x00);
      moduleRef.current.writeMem(0xFFFD, 0x06);
      
      // Verify memory
      console.log('Memory at 0x0600:', moduleRef.current.readMem(0x0600).toString(16));
      console.log('Memory at 0x0601:', moduleRef.current.readMem(0x0601).toString(16));
      console.log('Reset vector low:', moduleRef.current.readMem(0xFFFC).toString(16));
      console.log('Reset vector high:', moduleRef.current.readMem(0xFFFD).toString(16));
      
      // Reset
      console.log('Calling reset...');
      moduleRef.current.reset();
      
      console.log('After reset:');
      console.log('  A =', moduleRef.current.getA());
      console.log('  PC =', moduleRef.current.getPC().toString(16));
      
      // Execute LDA
      console.log('Executing instruction...');
      const opcode = moduleRef.current.step();
      console.log('Opcode executed:', opcode.toString(16));
      
      console.log('After step:');
      console.log('  A =', moduleRef.current.getA());
      console.log('  PC =', moduleRef.current.getPC().toString(16));
      
      updateRegisters();
      updateMemory();
      
      const a = moduleRef.current.getA();
      setOutput(prev => prev + `Test complete! A = ${a} (expected: 5)\n`);
      setOutput(prev => prev + `Opcode executed: ${opcode.toString(16).padStart(2, '0')}\n`);
      
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
        'BRK': 0x00,
        'NOP': 0xEA
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
      setOutput(prev => prev + 'Program bytes: ' + program.map(b => '$' + b.toString(16).padStart(2, '0')).join(' ') + '\n');
      
      updateRegisters();
      updateMemory();
      
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
      
      setOutput(prev => prev + `Executed: $${opcode.toString(16).padStart(2, '0')} at PC=$${registers.pc.toString(16).padStart(4, '0')}\n`);
      
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
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }
    
    setIsRunning(true);
    setOutput(prev => prev + '▶️ Running...\n');
    
    let stepCount = 0;
    const maxSteps = 10000;
    
    const execute = () => {
      if (!moduleRef.current) {
        setIsRunning(false);
        return;
      }
      
      try {
        const opcode = moduleRef.current.step();
        stepCount++;
        
        updateRegisters();
        updateMemory();
        
        if (opcode === 0x00) {
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
          animationRef.current = setTimeout(execute, 100);
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
      cancelAnimationFrame(animationRef.current);
      clearTimeout(animationRef.current);
    }
    
    if (moduleRef.current) {
      moduleRef.current.reset();
      updateRegisters();
      updateMemory();
    }
    
    setOutput(prev => prev + '🔄 CPU reset\n');
    setError('');
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
        <p>Run 6502 assembly in your browser</p>
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
                  <button onClick={runTest} className="btn btn-warning">
                    🧪 Test
                  </button>
                  <button onClick={reset} className="btn">
                    🔄 Reset
                  </button>
                </div>
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
              
              <div className="panel-header">
                <h3>Memory ($0000-$000F)</h3>
              </div>
              
              <div className="memory-grid">
                {memory.map((byte, i) => (
                  <div key={i} className="memory-cell">
                    <div className="address">${i.toString(16).padStart(2, '0').toUpperCase()}</div>
                    <div className="value">${byte.toString(16).padStart(2, '0').toUpperCase()}</div>
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