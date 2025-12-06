#include "operations.h"

void ORA(byte *addr){
  write_byte(&a, a | (*addr));

  flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
    return;
}

void AND(byte *addr){
  write_byte(&a, a & (*addr));

  flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
	return;
}

void EOR(byte *addr){
  write_byte(&a, a ^ (*addr));

  flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
	return;
}

void ADC(byte *addr){

  if ((flags & 0x08) > 0){
  }

  uint16_t res = a + (*addr) + (flags & 1);
  uint8_t truncres = res & 0xFF;
  uint8_t vflag = ((a ^ truncres) & ((*addr) ^ truncres) & 0x80) != 0;
  write_byte(&a, truncres);

  flags = (flags & 0x3C) | 
              (a & 0x80) |           // N
            (vflag << 6) |           // V
           ((a==0) << 1) |           // Z
           ((res & 0x100) > 0);      // C
	return;
}

void STA(byte *addr){
  write_byte(addr, a);
	return;
}

void LDA(byte *addr){
  write_byte(&a, *addr);

  flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
	return;
}

void CMP(byte *addr){
  byte vflag = flags & 0x40;
  byte astate = a;
  SBC(addr);

  a = astate;
  flags = (flags & 0xBF) | vflag;
	return;
}

void SBC(byte *addr){
  byte onescomp = ~(*addr);
  ADC(&onescomp);
	return;
}

void ASL(byte *addr){
  byte newcarry = (*addr) & 0x80;
  byte newval = (*addr) << 1;
  write_byte(addr, newval);

  flags = (flags & 0x7D) | 
            ((newval & 0x80))  |     // N
            ((newval==0) << 1) |     // Z
            (newcarry > 0);          // C
	return;
}

void ROL(byte *addr){
  byte newcarry = (*addr) & 0x80;
  byte newval = ((*addr) << 1) | (flags & 1);
  write_byte(addr, newval);

  flags = (flags & 0x7D) | 
            ((newval & 0x80))  |     // N
            ((newval==0) << 1) |     // Z
            (newcarry > 0);          // C
  return;
}

void LSR(byte *addr){
	byte newcarry = (*addr) & 1;
  byte newval = (*addr) >> 1;
  write_byte(addr, newval);

  flags = (flags & 0x7D) | 
            ((newval & 0x80))  |     // N
            ((newval==0) << 1) |     // Z
            (newcarry > 0);          // C
  return;
}

void ROR(byte *addr){
  byte newcarry = (*addr) & 1;
  byte newval = ((*addr) >> 1) | ((flags & 1) << 7);
  write_byte(addr, newval);

  flags = (flags & 0x7D) | 
            ((newval & 0x80))  |     // N
            ((newval==0) << 1) |     // Z
            (newcarry > 0);          // C
  return;
}

void STX(byte *addr){
  write_byte(addr, x);
  return;
}

void LDX(byte *addr){
  write_byte(&x, *addr);

  flags = (flags & 0x7D) | 
            ((x & 0x80)) |           // N
            ((x==0) << 1);           // Z
  return;
}

void DEC(byte *addr){
  byte newval = (*addr)-1;
  write_byte(addr, newval);

  flags = (flags & 0x7D) | 
            ((newval & 0x80)) |           // N
            ((newval==0) << 1);           // Z
  return;
}

void INC(byte *addr){
  byte newval = (*addr)+1;
  write_byte(addr, newval);

  flags = (flags & 0x7D) | 
            ((newval & 0x80)) |           // N
            ((newval==0) << 1);           // Z
	return;
}


void BIT(byte *addr){
  flags = (flags & 0x3D) |
            (((*addr) & a) == 0) << 1 |    // Z
            ((*addr) & 0xC0);              // N,V
	return;
}

void JMP(byte *addr){
  uint16_t newaddr = addr-memory;
  set_pc(newaddr);
	return;
}

void STY(byte *addr){
  write_byte(addr, y);
  return;
}

void LDY(byte *addr){
  write_byte(&y, *addr);

  flags = (flags & 0x7D) | 
            ((y & 0x80)) |           // N
            ((y==0) << 1);           // Z
  return;
}

void CPY(byte *addr){

  byte vflag = flags & 0x40;
  byte astate = a;

  a = y;
  SBC(addr);

  a = astate;

  flags = (flags & 0xBF) | vflag;
  return;
}

void CPX(byte *addr){

  byte vflag = flags & 0x40;
  byte astate = a;

  a = x;
  SBC(addr);

  a = astate;

  flags = (flags & 0xBF) | vflag;
  return;
}


void push_to_stack(byte *registerptr){
  uint16_t offset = 0x100 | stackpointer;
  write_byte(memory+offset, *registerptr);
  stackpointer--;
  return;
}

void pull_from_stack(byte *registerptr){
  stackpointer++;
  uint16_t offset = 0x100 | stackpointer;
  byte val = read_byte(memory+offset);
  flags = (flags & 0x7D) | 
          ((val & 0x80)) |           // N
          ((val==0) << 1);           // Z

  write_byte(registerptr, val);
  return;
}

void transfer_registers(byte *reg1, byte *reg2){
  byte val = read_byte(reg1);
  write_byte(reg2, val);
  if(reg2 != &stackpointer){
    flags = (flags & 0x7D) | 
            ((val & 0x80)) |           // N
            ((val==0) << 1);           // Z
  }
  return;
}

void set_clear_flag(uint8_t shiftamt, uint8_t val){
  byte newval = (val & 1) << shiftamt;
  flags = (flags & ~(1 << shiftamt)) | newval;
  return;
}

void NOP(){
  return;
}

void BRK(){
  return;
}

void JSR(){
  uint16_t newloc = read_address(pc);
  set_pc(pc+2);
  byte val_to_push;

  push_to_stack(&flags);
  val_to_push = pc >> 8;

  push_to_stack(&val_to_push);
  val_to_push = pc & 0xFF;

  push_to_stack(&val_to_push);
  JMP(memory+newloc);
  return;
}

void RTI(){
  return;
}

void RTS(){

  stackpointer += 1;
  uint16_t addr = read_address(0x100 | stackpointer);
  JMP(memory+addr);
  stackpointer += 1;

  pull_from_stack(&flags);
  return;
}

void bit_set_clear(byte high){
  uint8_t addr = read_pc();
  uint8_t val_to_write = read_byte(memory+addr);
  val_to_write = val_to_write & (0<<(high&0x7)) | (high>>3<<(high&0x7));
  write_byte(memory+addr, val_to_write);
  return;
}

void test_and_branch(byte high){
  uint8_t addr_to_test = read_pc();
  int8_t offset = read_pc();
  if ((read_byte(memory+addr_to_test) & (1<<(high&0x7))) == (high>>3<<(high&0x7))){
    JMP(memory+pc+offset);
  }
  return;
}

void STZ(byte *addr){
  write_byte(addr, 0);
  return;
}

void TSB(byte *addr){
  uint8_t mem = read_byte(addr);
  uint8_t val = mem | a;
  flags = (flags & 0xFD) | (((mem & a) == 0) << 1);
  write_byte(addr, val);
  return;
}

void TRB(byte *addr){
  uint8_t mem = read_byte(addr);
  uint8_t val = mem & (~a);
  flags = (flags & 0xFD) | (((mem & a) == 0) << 1);
  write_byte(addr, val);
  return;
}