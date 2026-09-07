#include "func_web.h"

byte a = 0;
byte x = 0;
byte y = 0;
uint16_t pc = 0;
byte stackpointer = 0xFF;
byte flags = 0x24;
byte memory[0x10000] = {0};

void reset_cpu(){
    a = 0;
    x = 0;
    y = 0;
    stackpointer = 0xFF;
    flags = 0x24;
    pc = (memory[0xFFFD] << 8) | memory[0xFFFC];
}

byte read_byte(byte *address){
  return (*address);
}

uint16_t read_address(uint16_t offset){
  uint16_t val = (read_byte(memory + ((offset + 1) & 0xFFFF)) << 8);
  val |= read_byte(memory + offset);
  return(val);
}

void write_byte(byte *address, byte value){
  *address = value;
}

byte read_pc(){
  byte val = read_byte(memory + pc);
  pc++;
  return(val);
}

void set_pc(uint16_t value){
  pc = value;
}

uint8_t execute_instruction(){
  uint8_t opcode = read_pc();
  if(opcode == 0) return 0;  /* BRK: halt */

  uint8_t high = opcode >> 4;
  uint8_t low = opcode & 0xF;
  if (low == 8){
    run_instruction_sbyte1(high);
  } else if (low == 0xA){
    run_instruction_sbyte2(high);
  } else {
    uint8_t cc  = opcode & 0x03;
    uint8_t bbb = (opcode & 0x1C) >> 2;
    uint8_t aaa = (opcode & 0xE0) >> 5;
    byte *address;
    switch(cc){
      case 1:
        address = decode_addrmode_group1(bbb);
        if (opcode == 0x89){
          BIT(address);
        } else {
          run_instruction_group1(address, aaa);
        }
        break;
      case 2:
        if (bbb == 4){
          /* 65C02 (zp) indirect: ORA/AND/EOR/ADC/STA/LDA/CMP/SBC (zp) */
          address = decode_addrmode_group23(bbb, aaa);
          run_instruction_group1(address, aaa);
        } else if (bbb == 7 && aaa == 4){
          /* 65C02 STZ abs,X (opcode 0x9E) */
          uint16_t target = read_address(pc);
          pc += 2;
          STZ(memory + ((target + x) & 0xFFFF));
        } else {
          address = decode_addrmode_group23(bbb, aaa);
          run_instruction_group2(address, aaa);
        }
        break;
      case 0:
        if (try65C02opcode(opcode)) break;

        if (bbb == 4 || opcode == 0x80){
          run_instruction_branching(high);
        } else if (bbb == 0 && !(aaa & 0x4)){
          run_instruction_interrupt(aaa);
        } else if (opcode == 0x6C){
          /* JMP (abs): jump through the 16-bit pointer at the operand */
          uint16_t ptr = read_address(pc);
          pc += 2;
          set_pc(read_address(ptr));
        } else {
          address = decode_addrmode_group23(bbb, 0);
          run_instruction_group3(address, aaa);
        }
        break;

      case 3:
        if (low == 0x7){
          bit_set_clear(high);
        } else if (low == 0xF){
          test_and_branch(high);
        }
        break;
    }
  }
  return opcode;
}

byte* decode_addrmode_group1(byte addrmode){
  uint16_t address;
  switch (addrmode){
    case 0:
      address = read_pc() + x;
      address &= 0xFF;
      address = read_address(address);
      break;

    case 1:
      address = read_pc();
      break;

    case 2:
      address = pc++;
      break;

    case 3:
      address = read_address(pc);
      pc += 2;
      break;

    case 4:
      address = read_address(read_pc());
      address += y;
      break;

    case 5:
      address = read_pc() + x;
      address &= 0xFF;
      break;

    case 6:
      address = read_address(pc);
      address += y;
      pc += 2;
      break;

    case 7:
      address = read_address(pc);
      address += x;
      pc += 2;
      break;
  }

  return address + memory;
}

byte* decode_addrmode_group23(byte addrmode, byte highbits){
  uint16_t address;
  switch(addrmode){
    case 0:
      address = pc++;
      break;

    case 1:
      address = read_pc();
      break;

    case 2:
      return (&a);

    case 3:
      address = read_address(pc);
      pc += 2;
      break;

    case 4:
      address = read_address(read_pc());
      break;

    case 5:
      address = read_pc();
      address += (highbits & 6) == 4 ? y : x;
      address &= 0xFF;
      break;

    case 7:
      address = read_address(pc);
      address += (highbits & 6) == 4 ? y : x;
      break;
  }

  return (memory + address);
}

void run_instruction_group1(byte *address, uint8_t highbits){
  switch(highbits){
    case 0: ORA(address); break;
    case 1: AND(address); break;
    case 2: EOR(address); break;
    case 3: ADC(address); break;
    case 4: STA(address); break;
    case 5: LDA(address); break;
    case 6: CMP(address); break;
    case 7: SBC(address); break;
  }
}

void run_instruction_group2(byte *address, uint8_t highbits){
  switch(highbits){
    case 0: ASL(address); break;
    case 1: ROL(address); break;
    case 2: LSR(address); break;
    case 3: ROR(address); break;
    case 4: STX(address); break;
    case 5: LDX(address); break;
    case 6: DEC(address); break;
    case 7: INC(address); break;
  }
}

void run_instruction_group3(byte *address, uint8_t highbits){
  switch(highbits){
    case 1: BIT(address); break;
    case 2:
    case 3: JMP(address); break;
    case 4: STY(address); break;
    case 5: LDY(address); break;
    case 6: CPY(address); break;
    case 7: CPX(address); break;
  }
}

void run_instruction_branching(uint8_t highbits){
  int8_t offset = read_pc();
  uint16_t addr = pc + offset;
  uint8_t shift = 0;
  if (highbits == 8){
    set_pc(addr);
    return;
  }

  byte flag = (highbits & 0xC) >> 2;
  byte value = (highbits >> 1) & 1;

  switch(flag){
    case 0: shift = 7; break; /* N */
    case 1: shift = 6; break; /* V */
    case 2: shift = 0; break; /* C */
    case 3: shift = 1; break; /* Z */
  }

  if( ((flags & (1 << shift)) > 0) == value ){
    set_pc(addr);
  }
}

void run_instruction_sbyte1(uint8_t highbits){
  switch(highbits){
    case 0: push_to_stack(&flags); break;   /* PHP */
    case 2: pull_from_stack(&flags); break; /* PLP */
    case 4: push_to_stack(&a); break;       /* PHA */
    case 6: pull_from_stack(&a); break;     /* PLA */

    case 1: /* CLC */
    case 3: /* SEC */
    case 5: /* CLI */
    case 7: /* SEI */
      set_clear_flag((highbits & 0xC) >> 1, (highbits & 2) >> 1);
      break;

    case 11: set_clear_flag(6, 0); break;   /* CLV */

    case 13: /* CLD */
    case 15: /* SED */
      set_clear_flag(3, (highbits & 2) >> 1);
      break;

    case 9: transfer_registers(&y, &a); break;  /* TYA */
    case 10: transfer_registers(&a, &y); break; /* TAY */
    case 8: DEC(&y); break;                     /* DEY */
    case 12: INC(&y); break;                    /* INY */
    case 14: INC(&x); break;                    /* INX */
  }
}

void run_instruction_sbyte2(uint8_t highbits){
  switch(highbits){
    case 0: ASL(&a); break; /* ASL A */
    case 1: INC(&a); break; /* INC A (65C02) */
    case 2: ROL(&a); break; /* ROL A */
    case 3: DEC(&a); break; /* DEC A (65C02) */
    case 4: LSR(&a); break; /* LSR A */
    case 5: push_to_stack(&y); break; /* PHY (65C02) */
    case 6: ROR(&a); break; /* ROR A */
    case 7: pull_from_stack(&y); break; /* PLY (65C02) */

    case 8: transfer_registers(&x, &a); break;       /* TXA */
    case 9: transfer_registers(&x, &stackpointer); break; /* TXS */
    case 10: transfer_registers(&a, &x); break;      /* TAX */
    case 11: transfer_registers(&stackpointer, &x); break; /* TSX */

    case 12: DEC(&x); break; /* DEX */
    case 13: push_to_stack(&x); break; /* PHX (65C02) */
    case 14: break; /* NOP */
    case 15: pull_from_stack(&x); break; /* PLX (65C02) */
  }
}

void run_instruction_interrupt(uint8_t highbits){
  switch(highbits){
    case 0: BRK(); break;
    case 1: JSR(); break;
    case 2: RTI(); break;
    case 3: RTS(); break;
  }
}

bool try65C02opcode(uint8_t opcode){
  byte *addr;
  uint8_t code = opcode;
  switch(opcode){
    case 0x9C: /* STZ abs */
      code = 0x8C;
      /* fall through */
    case 0x64: /* STZ zp */
    case 0x74: /* STZ zp,X */
      addr = decode_addrmode_group1((code & 0x1C) >> 2);
      STZ(addr);
      return true;

    case 0x14: /* TRB zp */
    case 0x1C: /* TRB abs */
    case 0x04: /* TSB zp */
    case 0x0C: /* TSB abs */
      addr = decode_addrmode_group1((code & 0x0C) >> 2);
      (code & 0xF0) > 0 ? TRB(addr) : TSB(addr);
      return true;

    default:
      return false;
  }
}
