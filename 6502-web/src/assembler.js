// A small two-pass 6502 assembler with label support.
// Mode keys: imp, acc, imm, zp, zpx, zpy, abs, absx, absy, ind, izx, izy, rel

const OPS = {
  ADC: { imm: 0x69, zp: 0x65, zpx: 0x75, abs: 0x6D, absx: 0x7D, absy: 0x79, izx: 0x61, izy: 0x71 },
  AND: { imm: 0x29, zp: 0x25, zpx: 0x35, abs: 0x2D, absx: 0x3D, absy: 0x39, izx: 0x21, izy: 0x31 },
  ASL: { acc: 0x0A, zp: 0x06, zpx: 0x16, abs: 0x0E, absx: 0x1E },
  BCC: { rel: 0x90 },
  BCS: { rel: 0xB0 },
  BEQ: { rel: 0xF0 },
  BIT: { imm: 0x89, zp: 0x24, zpx: 0x34, abs: 0x2C, absx: 0x3C },
  BMI: { rel: 0x30 },
  BNE: { rel: 0xD0 },
  BPL: { rel: 0x10 },
  BRA: { rel: 0x80 },
  BRK: { imp: 0x00 },
  BVC: { rel: 0x50 },
  BVS: { rel: 0x70 },
  CLC: { imp: 0x18 },
  CLD: { imp: 0xD8 },
  CLI: { imp: 0x58 },
  CLV: { imp: 0xB8 },
  CMP: { imm: 0xC9, zp: 0xC5, zpx: 0xD5, abs: 0xCD, absx: 0xDD, absy: 0xD9, izx: 0xC1, izy: 0xD1 },
  CPX: { imm: 0xE0, zp: 0xE4, abs: 0xEC },
  CPY: { imm: 0xC0, zp: 0xC4, abs: 0xCC },
  DEA: { imp: 0x3A },
  DEC: { zp: 0xC6, zpx: 0xD6, abs: 0xCE, absx: 0xDE },
  DEX: { imp: 0xCA },
  DEY: { imp: 0x88 },
  EOR: { imm: 0x49, zp: 0x45, zpx: 0x55, abs: 0x4D, absx: 0x5D, absy: 0x59, izx: 0x41, izy: 0x51 },
  INA: { imp: 0x1A },
  INC: { zp: 0xE6, zpx: 0xF6, abs: 0xEE, absx: 0xFE },
  INX: { imp: 0xE8 },
  INY: { imp: 0xC8 },
  JMP: { abs: 0x4C, ind: 0x6C },
  JSR: { abs: 0x20 },
  LDA: { imm: 0xA9, zp: 0xA5, zpx: 0xB5, abs: 0xAD, absx: 0xBD, absy: 0xB9, izx: 0xA1, izy: 0xB1 },
  LDX: { imm: 0xA2, zp: 0xA6, zpy: 0xB6, abs: 0xAE, absy: 0xBE },
  LDY: { imm: 0xA0, zp: 0xA4, zpx: 0xB4, abs: 0xAC, absx: 0xBC },
  LSR: { acc: 0x4A, zp: 0x46, zpx: 0x56, abs: 0x4E, absx: 0x5E },
  NOP: { imp: 0xEA },
  ORA: { imm: 0x09, zp: 0x05, zpx: 0x15, abs: 0x0D, absx: 0x1D, absy: 0x19, izx: 0x01, izy: 0x11 },
  PHA: { imp: 0x48 },
  PHP: { imp: 0x08 },
  PHX: { imp: 0xDA },
  PHY: { imp: 0x5A },
  PLA: { imp: 0x68 },
  PLP: { imp: 0x28 },
  PLX: { imp: 0xFA },
  PLY: { imp: 0x7A },
  ROL: { acc: 0x2A, zp: 0x26, zpx: 0x36, abs: 0x2E, absx: 0x3E },
  ROR: { acc: 0x6A, zp: 0x66, zpx: 0x76, abs: 0x6E, absx: 0x7E },
  RTI: { imp: 0x40 },
  RTS: { imp: 0x60 },
  SBC: { imm: 0xE9, zp: 0xE5, zpx: 0xF5, abs: 0xED, absx: 0xFD, absy: 0xF9, izx: 0xE1, izy: 0xF1 },
  SEC: { imp: 0x38 },
  SED: { imp: 0xF8 },
  SEI: { imp: 0x78 },
  STA: { zp: 0x85, zpx: 0x95, abs: 0x8D, absx: 0x9D, absy: 0x99, izx: 0x81, izy: 0x91 },
  STX: { zp: 0x86, zpy: 0x96, abs: 0x8E },
  STY: { zp: 0x84, zpx: 0x94, abs: 0x8C },
  STZ: { zp: 0x64, zpx: 0x74, abs: 0x9C, absx: 0x9E },
  TAX: { imp: 0xAA },
  TAY: { imp: 0xA8 },
  TRB: { zp: 0x14, abs: 0x1C },
  TSB: { zp: 0x04, abs: 0x0C },
  TSX: { imp: 0xBA },
  TXA: { imp: 0x8A },
  TXS: { imp: 0x9A },
  TYA: { imp: 0x98 },
};

const SIZES = {
  imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2,
  abs: 3, absx: 3, absy: 3, ind: 3, rel: 2,
};

function valueLooksByte(str) {
  const t = str.trim();
  if (t.startsWith('$')) {
    return /^[0-9A-Fa-f]{1,2}$/.test(t.slice(1));
  }
  if (/^\d+$/.test(t)) return parseInt(t, 10) <= 0xFF;
  return false;
}

function parseNumber(str, symbols) {
  const t = str.trim();
  if (t.startsWith('$')) return parseInt(t.slice(1), 16);
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (symbols && t in symbols) return symbols[t];
  return null;
}

function classify(mnemonic, operandText, op) {
  const opnd = operandText.trim();
  if (opnd === '' || opnd.toUpperCase() === 'A') {
    if (opnd === '' && op.imp !== undefined) return { mode: 'imp' };
    if (op.acc !== undefined) return { mode: 'acc' };
    return { error: `${mnemonic} requires an operand` };
  }
  if (opnd.startsWith('#')) return { mode: 'imm', valueText: opnd.slice(1) };
  if (opnd.startsWith('(')) {
    if (opnd.endsWith(',X)') || opnd.endsWith(',x)')) {
      return { mode: 'izx', valueText: opnd.slice(1, opnd.length - 3) };
    }
    const izy = opnd.match(/^\((.+)\),\s*[yY]$/);
    if (izy) return { mode: 'izy', valueText: izy[1] };
    if (opnd.endsWith(')')) return { mode: 'ind', valueText: opnd.slice(1, -1) };
  }
  if (/,\s*[xX]$/.test(opnd)) {
    const valueText = opnd.slice(0, opnd.lastIndexOf(',')).trim();
    return { mode: valueLooksByte(valueText) ? 'zpx' : 'absx', valueText };
  }
  if (/,\s*[yY]$/.test(opnd)) {
    const valueText = opnd.slice(0, opnd.lastIndexOf(',')).trim();
    return { mode: valueLooksByte(valueText) ? 'zpy' : 'absy', valueText };
  }
  if (op.rel !== undefined && op.abs === undefined && op.zp === undefined) {
    return { mode: 'rel', valueText: opnd };
  }
  return { mode: valueLooksByte(opnd) ? 'zp' : 'abs', valueText: opnd };
}

export function assemble(source) {
  const lines = source.split('\n');
  const symbols = {};
  const errors = [];
  const instructions = [];

  // Pass 1: collect instructions and assign addresses.
  let addr = 0;
  for (const raw of lines) {
    const line = raw.split(';')[0].trim();
    if (!line) continue;

    let label = null;
    let rest = line;
    const colon = line.indexOf(':');
    if (colon >= 0) {
      label = line.slice(0, colon).trim();
      rest = line.slice(colon + 1).trim();
      if (label) {
        if (label in symbols) errors.push(`Duplicate label: ${label}`);
        else symbols[label] = addr;
      }
    }
    if (!rest) continue;

    const parts = rest.split(/\s+/);
    const mnemonic = parts[0].toUpperCase();
    const operand = parts.slice(1).join(' ').trim();
    const op = OPS[mnemonic];
    if (!op) {
      errors.push(`Unknown instruction: ${mnemonic}`);
      continue;
    }
    const cls = classify(mnemonic, operand, op);
    if (cls.error) {
      errors.push(cls.error);
      continue;
    }
    if (op[cls.mode] === undefined) {
      errors.push(`Invalid addressing mode for ${mnemonic}: ${operand}`);
      continue;
    }
    instructions.push({ mnemonic, operand, cls, addr });
    addr += SIZES[cls.mode];
  }

  if (errors.length) return { error: errors[0] };

  // Pass 2: emit bytes, resolving labels.
  const bytes = [];
  for (const ins of instructions) {
    const op = OPS[ins.mnemonic];
    const { mode, valueText } = ins.cls;
    bytes.push(op[mode]);

    if (mode === 'imp' || mode === 'acc') continue;

    if (mode === 'rel') {
      const target = parseNumber(valueText, symbols);
      if (target === null) return { error: `Undefined label: ${valueText}` };
      const offset = target - (ins.addr + 2);
      if (offset < -128 || offset > 127) {
        return { error: `Branch out of range at ${ins.mnemonic} ${ins.operand}` };
      }
      bytes.push(offset & 0xFF);
      continue;
    }

    const value = parseNumber(valueText, symbols);
    if (value === null) return { error: `Undefined label: ${valueText}` };

    const oneByte = (mode === 'imm' || mode === 'zp' || mode === 'zpx' ||
                     mode === 'zpy' || mode === 'izx' || mode === 'izy');
    if (oneByte) {
      if (value < 0 || value > 0xFF) return { error: `Value out of byte range: ${valueText}` };
      bytes.push(value & 0xFF);
    } else {
      if (value < 0 || value > 0xFFFF) return { error: `Value out of address range: ${valueText}` };
      bytes.push(value & 0xFF);
      bytes.push((value >> 8) & 0xFF);
    }
  }

  return { bytes };
}
