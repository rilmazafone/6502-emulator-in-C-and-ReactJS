import React, { useState, useEffect, useRef } from 'react';

const Emulator6502 = () => {
  const [code, setCode] = useState(`; Simple 6502 program
LDA #$05    ; Load 5
ADC #$03    ; Add 3
STA $0200   ; Store result
BRK         ; Stop
`);
  
  const [output, setOutput] = useState('');
  const [registers, setRegisters] = useState({
    a: 0, x: 0, y: 0, pc: 0, sp: 0xFF, flags: 0
  });
  const [memory, setMemory] = useState(new Array(256).fill(0));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const moduleRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const initModule = async () => {
      try {
        setOutput('Initializing 6502 emulator...\n');
        setIsLoading(true);
        
        const script = document.createElement('script');
        script.src = `${process.env.PUBLIC_URL}/emulator.js`;
        script.async = true;
        
        script.onload = async () => {
          try {
            if (typeof window.createEmulatorModule === 'undefined') {
              throw new Error('Emulator module not found');
            }
            
            const Module = await window.createEmulatorModule({
              locateFile: (path) => {
                if (path.endsWith('.wasm')) {
                  return `${process.env.PUBLIC_URL}/emulator.wasm`;
                }
                return path;
              }
            });
            
            moduleRef.current = {
              Module: Module,
              reset: Module.cwrap('js_reset_cpu', null, []),
              execute: Module.cwrap('js_execute_instruction', 'number', []),
              getA: Module.cwrap('js_get_a', 'number', []),
              getX: Module.cwrap('js_get_x', 'number', []),
              getY: Module.cwrap('js_get_y', 'number', []),
              getPC: Module.cwrap('js_get_pc', 'number', []),
              getSP: Module.cwrap('js_get_sp', 'number', []),
              getFlags: Module.cwrap('js_get_flags', 'number', []),
              writeMem: Module.cwrap('js_write_memory', null, ['number', 'number']),
              readMem: Module.cwrap('js_read_memory', 'number', ['number']),
              getMemPtr: Module.cwrap('js_get_memory', 'number', []),
            };
            
            moduleRef.current.reset();
            
            setOutput(prev => prev + 'Emulator loaded successfully!\n');
            setOutput(prev => prev + 'Ready to execute 6502 code.\n\n');
            setIsLoading(false);
            updateRegisters();
          } catch (err) {
            setError('Failed to initialize WASM: ' + err.message);
            setIsLoading(false);
          }
        };
        
        script.onerror = () => {
          setError('Failed to load emulator.js from public folder');
          setIsLoading(false);
        };
        
        document.body.appendChild(script);
        
        return () => {
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
        };
      } catch (err) {
        setError('Failed to initialize: ' + err.message);
        setIsLoading(false);
      }
    };
    
    initModule();
  }, []);

  const assembleCode = (source) => {
    const lines = source.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith(';');
    });
    
    const program = [];
    const opcodes = {
      'LDA #': 0xA9, 'LDX #': 0xA2, 'LDY #': 0xA0,
      'STA': 0x8D, 'STX': 0x8E, 'STY': 0x8C,
      'ADC #': 0x69, 'SBC #': 0xE9,
      'AND #': 0x29, 'ORA #': 0x09, 'EOR #': 0x49,
      'CMP #': 0xC9, 'CPX #': 0xE0, 'CPY #': 0xC0,
      'INC': 0xEE, 'DEC': 0xCE,
      'INX': 0xE8, 'DEX': 0xCA, 'INY': 0xC8, 'DEY': 0x88,
      'BRK': 0x00, 'NOP': 0xEA,
      'TAX': 0xAA, 'TAY': 0xA8, 'TXA': 0x8A, 'TYA': 0x98
    };
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const instruction = parts[0].toUpperCase();
      
      if (['BRK', 'NOP', 'TAX', 'TAY', 'TXA', 'TYA', 'INX', 'DEX', 'INY', 'DEY'].includes(instruction)) {
        program.push(opcodes[instruction]);
      } else if (parts.length >= 2) {
        const fullInst = `${instruction} ${parts[1].toUpperCase()}`;
        if (opcodes[fullInst]) {
          program.push(opcodes[fullInst]);
          if (parts[1].startsWith('#$')) {
            program.push(parseInt(parts[1].substring(2), 16));
          } else if (parts[1].startsWith('$')) {
            const addr = parseInt(parts[1].substring(1), 16);
            program.push(addr & 0xFF);
            program.push((addr >> 8) & 0xFF);
          }
        }
      }
    }
    
    return program;
  };

  const updateRegisters = () => {
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
      
      const memPtr = moduleRef.current.getMemPtr();
      const memArray = new Uint8Array(moduleRef.current.Module.HEAPU8.buffer, memPtr, 256);
      setMemory(Array.from(memArray));
    } catch (err) {
      console.error('Error updating registers:', err);
    }
  };

  const loadProgram = () => {
    try {
      setError('');
      const program = assembleCode(code);
      
      if (!moduleRef.current) {
        throw new Error('Emulator not initialized');
      }
      
      moduleRef.current.reset();
      
      const startAddr = 0x0600;
      program.forEach((byte, i) => {
        moduleRef.current.writeMem(startAddr + i, byte);
      });
      
      moduleRef.current.writeMem(0xFFFC, startAddr & 0xFF);
      moduleRef.current.writeMem(0xFFFD, (startAddr >> 8) & 0xFF);
      moduleRef.current.reset();
      
      setOutput(`Program loaded (${program.length} bytes) at $${startAddr.toString(16).toUpperCase()}\n`);
      updateRegisters();
    } catch (err) {
      setError('Assembly error: ' + err.message);
    }
  };

  const step = () => {
    if (!moduleRef.current) return;
    
    try {
      const opcode = moduleRef.current.execute();
      updateRegisters();
      
      if (opcode === 0) {
        setOutput(prev => prev + 'Program halted (BRK)\n');
        setIsRunning(false);
      } else {
        setOutput(prev => prev + `Executed: $${opcode.toString(16).toUpperCase().padStart(2, '0')}\n`);
      }
    } catch (err) {
      setError('Execution error: ' + err.message);
      setIsRunning(false);
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
    
    loadProgram();
    setIsRunning(true);
    let stepCount = 0;
    
    const runLoop = () => {
      if (!moduleRef.current) return;
      
      try {
        const opcode = moduleRef.current.execute();
        updateRegisters();
        stepCount++;
        
        if (opcode === 0 || stepCount > 10000) {
          setOutput(prev => prev + `Program completed (${stepCount} steps)\n`);
          setIsRunning(false);
          return;
        }
        
        animationRef.current = requestAnimationFrame(runLoop);
      } catch (err) {
        setError('Runtime error: ' + err.message);
        setIsRunning(false);
      }
    };
    
    runLoop();
  };

  const reset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRunning(false);
    if (moduleRef.current) {
      moduleRef.current.reset();
      updateRegisters();
    }
    setOutput('CPU reset\n');
    setError('');
  };

  const formatFlags = (flags) => {
    const names = ['C', 'Z', 'I', 'D', 'B', '-', 'V', 'N'];
    return names.map((name, i) => ({
      name,
      set: (flags & (1 << i)) !== 0
    }));
  };

  const styles = {
    container: {
      width: '100%',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    header: {
      backgroundColor: '#2d2d2d',
      borderBottom: '1px solid #404040',
      padding: '16px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#60a5fa',
      margin: '0 0 4px 0'
    },
    subtitle: {
      fontSize: '14px',
      color: '#9ca3af',
      margin: 0
    },
    alert: {
      padding: '12px',
      margin: '16px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px'
    },
    alertLoading: {
      backgroundColor: '#1e3a8a',
      border: '1px solid #3b82f6'
    },
    alertError: {
      backgroundColor: '#7f1d1d',
      border: '1px solid #dc2626'
    },
    spinner: {
      width: '20px',
      height: '20px',
      border: '2px solid #3b82f6',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    main: {
      flex: 1,
      display: 'flex',
      gap: '16px',
      padding: '16px',
      overflow: 'hidden'
    },
    leftPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#2d2d2d',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    panelHeader: {
      backgroundColor: '#404040',
      padding: '12px 16px',
      borderBottom: '1px solid #505050',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontWeight: '600'
    },
    buttonGroup: {
      display: 'flex',
      gap: '8px'
    },
    button: {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500'
    },
    buttonPrimary: {
      backgroundColor: '#2563eb',
      color: 'white'
    },
    buttonSuccess: {
      backgroundColor: '#16a34a',
      color: 'white'
    },
    buttonDanger: {
      backgroundColor: '#dc2626',
      color: 'white'
    },
    buttonSecondary: {
      backgroundColor: '#4b5563',
      color: 'white'
    },
    textarea: {
      flex: 1,
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      padding: '16px',
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      border: 'none',
      resize: 'none',
      outline: 'none'
    },
    rightPanel: {
      width: '384px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    panel: {
      backgroundColor: '#2d2d2d',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    registerGrid: {
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      fontFamily: '"Courier New", monospace',
      fontSize: '14px'
    },
    registerRow: {
      display: 'flex',
      justifyContent: 'space-between'
    },
    registerLabel: {
      color: '#9ca3af'
    },
    registerValue: {
      color: '#4ade80',
      fontWeight: 'bold'
    },
    flagsContainer: {
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid #404040'
    },
    flagsGrid: {
      display: 'flex',
      gap: '4px',
      marginTop: '8px'
    },
    flag: {
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold'
    },
    flagActive: {
      backgroundColor: '#16a34a',
      color: 'white'
    },
    flagInactive: {
      backgroundColor: '#404040',
      color: '#6b7280'
    },
    memoryContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    memoryGrid: {
      flex: 1,
      overflow: 'auto',
      padding: '16px',
      fontFamily: '"Courier New", monospace',
      fontSize: '12px'
    },
    memoryRow: {
      display: 'flex',
      gap: '8px',
      marginBottom: '4px'
    },
    memoryAddress: {
      color: '#6b7280',
      width: '32px'
    },
    memoryByte: {
      color: '#4ade80'
    },
    memoryByteZero: {
      color: '#4b5563'
    },
    outputContainer: {
      height: '160px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    output: {
      flex: 1,
      overflow: 'auto',
      padding: '16px',
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      whiteSpace: 'pre-wrap'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={styles.header}>
        <h1 style={styles.title}>6502 Emulator</h1>
        <p style={styles.subtitle}>Write and execute 6502 assembly code</p>
      </div>
      
      {isLoading && (
        <div style={{...styles.alert, ...styles.alertLoading}}>
          <div style={styles.spinner}></div>
          <div>Loading emulator...</div>
        </div>
      )}
      
      {error && (
        <div style={{...styles.alert, ...styles.alertError}}>
          <span>⚠</span>
          <div>{error}</div>
        </div>
      )}
      
      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <span>Assembly Code</span>
            <div style={styles.buttonGroup}>
              <button
                onClick={loadProgram}
                style={{...styles.button, ...styles.buttonPrimary}}
              >
                Load
              </button>
              <button
                onClick={step}
                disabled={isRunning}
                style={{...styles.button, ...styles.buttonSecondary}}
              >
                Step
              </button>
              <button
                onClick={run}
                style={{...styles.button, ...(isRunning ? styles.buttonDanger : styles.buttonSuccess)}}
              >
                {isRunning ? 'Stop' : 'Run'}
              </button>
              <button
                onClick={reset}
                style={{...styles.button, ...styles.buttonSecondary}}
              >
                Reset
              </button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={styles.textarea}
            spellCheck={false}
          />
        </div>
        
        <div style={styles.rightPanel}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>Registers</div>
            <div style={styles.registerGrid}>
              <div style={styles.registerRow}>
                <span style={styles.registerLabel}>A:</span>
                <span style={styles.registerValue}>${registers.a.toString(16).toUpperCase().padStart(2, '0')}</span>
              </div>
              <div style={styles.registerRow}>
                <span style={styles.registerLabel}>X:</span>
                <span style={styles.registerValue}>${registers.x.toString(16).toUpperCase().padStart(2, '0')}</span>
              </div>
              <div style={styles.registerRow}>
                <span style={styles.registerLabel}>Y:</span>
                <span style={styles.registerValue}>${registers.y.toString(16).toUpperCase().padStart(2, '0')}</span>
              </div>
              <div style={styles.registerRow}>
                <span style={styles.registerLabel}>PC:</span>
                <span style={styles.registerValue}>${registers.pc.toString(16).toUpperCase().padStart(4, '0')}</span>
              </div>
              <div style={styles.registerRow}>
                <span style={styles.registerLabel}>SP:</span>
                <span style={styles.registerValue}>${registers.sp.toString(16).toUpperCase().padStart(2, '0')}</span>
              </div>
              <div style={styles.flagsContainer}>
                <div style={styles.registerLabel}>Flags:</div>
                <div style={styles.flagsGrid}>
                  {formatFlags(registers.flags).map(flag => (
                    <div
                      key={flag.name}
                      style={{...styles.flag, ...(flag.set ? styles.flagActive : styles.flagInactive)}}
                    >
                      {flag.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{...styles.panel, ...styles.memoryContainer}}>
            <div style={styles.panelHeader}>Memory ($0000-$00FF)</div>
            <div style={styles.memoryGrid}>
              {Array.from({ length: 16 }, (_, row) => (
                <div key={row} style={styles.memoryRow}>
                  <span style={styles.memoryAddress}>${(row * 16).toString(16).toUpperCase().padStart(2, '0')}:</span>
                  {Array.from({ length: 16 }, (_, col) => {
                    const addr = row * 16 + col;
                    const value = memory[addr] || 0;
                    return (
                      <span
                        key={col}
                        style={value !== 0 ? styles.memoryByte : styles.memoryByteZero}
                      >
                        {value.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{...styles.panel, ...styles.outputContainer}}>
            <div style={styles.panelHeader}>Output</div>
            <div style={styles.output}>{output}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Emulator6502;