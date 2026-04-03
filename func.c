#include "func_web.h"

void reset_cpu(){
  a = 0;
  x = 0;
  y = 0;
  stackpointer = 0xFF;

  for(int i=0; i<0xFFFF; i++){
    memory[i] = 0;
  }

  pc = (memory[0xFFFD] << 8) | memory[0xFFFC];
}

byte read_byte(byte *address){
  return (*address);
}

uint16_t read_address(uint16_t offset){
  uint16_t val = (read_byte(memory+offset+1) << 8);
  val |= read_byte(memory+offset);
  return(val);
}

void write_byte(byte *address, byte value){
  *address = value;
  return;
}

byte read_pc(){
  byte val = read_byte(memory+pc);
  pc++;
  return(val);
}

void set_pc(uint16_t value){
  pc = value;
  return;
}
uint8_t execute_instruction(){

  uint8_t opcode = read_pc();
  if(opcode == 0) return 0;

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
        address = decode_addrmode_group23(bbb, aaa);
        if (bbb==4){
          run_instruction_group1(address, aaa);
        } else if (bbb==7 && aaa==4){
          STZ(address);
        } else {
          run_instruction_group2(address, aaa);
        }
        break;
      case 0:
        if (try65C02opcode(opcode)) break;

        if (bbb == 4 || opcode == 0x80){
          run_instruction_branching(high);

        } else if (bbb == 0 && !(aaa & 0x4)){
          run_instruction_interrupt(aaa);

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

  return address+memory;
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
      address += (highbits&6) == 4 ? y : x;
      address &= 0xFF;
      break;

    case 7:
      address = read_address(pc);
      address += (highbits&6) == 4 ? y : x;
      break;
  }

  return (memory+address);
}

void run_instruction_group1(byte *address, uint8_t highbits){
  switch(highbits){
    case 0:
      ORA(address);
      break;
    case 1:
      AND(address);
      break;
    case 2:
      EOR(address);
      break;
    case 3:
      ADC(address);
      break;
    case 4:
      STA(address);
      break;
    case 5:
      LDA(address);
      break;
    case 6:
      CMP(address);
      break;
    case 7:
      SBC(address);
      break;
  }

  return;
}


void run_instruction_group2(byte *address, uint8_t highbits){
  switch(highbits){
    case 0:
      ASL(address);
      break;
    case 1:
      ROL(address);
      break;
    case 2:
      LSR(address);
      break;
    case 3:
      ROR(address);
      break;
    case 4:
      STX(address);
      break;
    case 5:
      LDX(address);
      break;
    case 6:
      DEC(address);
      break;
    case 7:
      INC(address);
      break;
  }
  return;
}


void run_instruction_group3(byte *address, uint8_t highbits){
  switch(highbits){
    case 1:
      BIT(address);
      break;
    case 2:
    case 3:
      JMP(address);
      break;
    case 4:
      STY(address);
      break;
    case 5:
      LDY(address);
      break;
    case 6:
      CPY(address);
      break;
    case 7:
      CPX(address);
      break;
  }

  return;
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
  byte value = (highbits>>1) & 1;

  switch(flag){
    case 0:
      shift = 7;
      break;

    case 1:
      shift = 6;
      break;

    case 2:
      shift = 0;
      break;

    case 3:
      shift = 1;
      break;
  }

  if( ((flags & (1 << shift)) > 0) == value ){
    set_pc(addr);
  }

  return;
}



void run_instruction_sbyte1(uint8_t highbits){
  switch(highbits){
    case 0:
      push_to_stack(&flags);
      break;
    case 2:
      pull_from_stack(&flags);
      break;
    case 4:
      push_to_stack(&a);
      break;
    case 6:
      pull_from_stack(&a);
      break;

    case 1:
      // CLC 0001
    case 3:
      // SEC 0011
    case 5:
      // CLI 0101
    case 7:
      // SEI 0111
      set_clear_flag((highbits&0xC)>>1, (highbits&2)>>1);
      break;

    case 11:
      // CLV
      set_clear_flag(6, 0);
      break;

    case 13:
      // CLD
    case 15:
      // SED
      set_clear_flag(3, (highbits&2) >> 1);
      break;

    case 9:
      // TYA
      transfer_registers(&y, &a);
      break;

    case 10:
      // TAY
      transfer_registers(&a, &y);
      break;

    case 8:
      // DEY
      DEC(&y);
      break;

    case 12:
      // INY
      INC(&y);
      break;

    case 14:
      // INX
      INC(&x);
      break;

  }
  return;
}

void run_instruction_sbyte2(uint8_t highbits){
  switch(highbits){
    case 1:
      INC(&a);
      break;
    case 3:
      DEC(&a);
      break;
    case 5:
      push_to_stack(&y);
      break;
    case 7:
      pull_from_stack(&y);
      break;

    case 8:
      // TXA
      transfer_registers(&x, &a);
      break;
    case 9:
      // TXS
      transfer_registers(&x, &stackpointer);
      break;
    case 10:
      // TAX
      transfer_registers(&a, &x);
      break;
    case 11:
      transfer_registers(&stackpointer, &x);
      // TSX
      break;

    case 12:
      // DEX
      DEC(&x);
      break;

    case 13:
      // PHX
      push_to_stack(&x);
      break;

    case 15:
      // PLX
      pull_from_stack(&x);
      break;
  }
  return;
}

void run_instruction_interrupt(uint8_t highbits){
  switch(highbits){
    case 0:  
      BRK();
      break;
    case 1:     
      JSR();
      break;
    case 2:
      RTI();
      break;
    case 3:
      RTS();
      break;
  }
  return;
}

bool try65C02opcode(uint8_t opcode){
  byte *addr;
  uint8_t code = opcode;
  switch(opcode){
    case 0x9C:
      code = 0x8C;
    case 0x64:
    case 0x74:
      addr = decode_addrmode_group1((code & 0x1C) >> 2);
      STZ(addr);
      return true;

    case 0x14:
      // zp
    case 0x1C:
      // abs

    // TSB
    case 0x04:
      // zp
    case 0x0C:
      // abs
      addr = decode_addrmode_group1((code & 0x0C) >> 2);
      (code & 0xF0) > 0 ? TRB(addr) : TSB(addr);
      return true;

    default:
      return false;
  }
}



