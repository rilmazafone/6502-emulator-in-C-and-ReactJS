#include "func_web.h"
#include <stdio.h>

byte a = 0;
byte x = 0;
byte y = 0;
uint16_t pc = 0;
byte stackpointer = 0xFF;
byte flags = 0x20; // Interrupt flag set on reset
byte memory[0x10000] = {0};

void reset_cpu(){
    printf("reset_cpu: Starting reset\n");
    a = 0;
    x = 0;
    y = 0;
    stackpointer = 0xFF;
    flags = 0x20; // Interrupt flag set

  
    pc = (memory[0xFFFD] << 8) | memory[0xFFFC];
    
    printf("reset_cpu: Complete. PC=%04x, A=%02x, flags=%02x\n", pc, a, flags);
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


  printf("execute_instruction: PC=%04x\n", pc);
  uint8_t opcode = read_pc();
  printf("execute_instruction: Read opcode %02x, PC now %04x\n", opcode, pc);
  
  if(opcode == 0) {
    printf("execute_instruction: BRK encountered\n");
    return 0;
  }

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
          // 65C02 expanded set
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
          // 65C02 expanded set
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
  
  printf("execute_instruction: After execution A=%02x, X=%02x, Y=%02x\n", a, x, y);
  return opcode;
}

byte* decode_addrmode_group1(byte addrmode){
  uint16_t address;
  switch (addrmode){
    case 0:        // (zero page, X)                  {X, indirect}
      address = read_pc() + x;
      address &= 0xFF; // addition is without carry
      address = read_address(address);
      break;
    
    case 1:        // zero page
      address = read_pc();
      break;
    
    case 2:        // #immediate
      address = pc++;
      break;
    
    case 3:        // absolute
      address = read_address(pc);
      pc += 2;
      break;
    
    case 4:        // (zero page),Y                   {indirect, y}
      address = read_address(read_pc());
      address += y;
      break;
    
    case 5:        // zero page, X
      address = read_pc() + x;
      address &= 0xFF;
      break;
    
    case 6:        // absolute, Y
      address = read_address(pc);
      address += y;
      pc += 2;
      break;
    
    case 7:        // absolute, X
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
  printf("run_instruction_group1: highbits=%d\n", highbits);
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
      printf("LDA: A is now %02x\n", a);
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
    case 0:         // negative flag
      shift = 7;
      break;

    case 1:         // overflow flag
      shift = 6;
      break;

    case 2:         // carry flag
      shift = 0;
      break;

    case 3:         // zero flag
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
      set_clear_flag(6, 0);
      break;

    case 13:
    case 15:
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
      // INC (INA)
      INC(&a);
      break;
    case 3:
      // DEC (DEA)
      DEC(&a);
      break;
    case 5:
      // PHY
      push_to_stack(&y);
      break;
    case 7:
      // PLY
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
      // abs
      code = 0x8C;
    case 0x64:
      // zp
    case 0x74:
      // zp,X
      addr = decode_addrmode_group1((code & 0x1C) >> 2);
      STZ(addr);
      return true;


    // TRB
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
