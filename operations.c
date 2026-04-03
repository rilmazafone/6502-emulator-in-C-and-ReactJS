#include "operations.h"

byte* get_memory_ptr() {
    return memory;
}

void ORA(byte *addr){
    a = a | (*addr);
    flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
}

void AND(byte *addr){
    a = a & (*addr);
    flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
}

void EOR(byte *addr){
    a = a ^ (*addr);
    flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
}

void ADC(byte *addr){
    uint16_t sum = a + (*addr) + (flags & 1);
    uint8_t res = sum & 0xFF;
    
    uint8_t overflow = (~(a ^ *addr) & (a ^ res) & 0x80) != 0;
    
    a = res;
    flags = (flags & 0x3C) | 
            (a & 0x80) |           // N
            (overflow << 6) |      // V
            ((a==0) << 1) |        // Z
            ((sum > 0xFF) << 0);   // C
}

void STA(byte *addr){
    *addr = a;
}

void LDA(byte *addr){
    a = *addr;
    flags = (flags & 0x7D) | 
            ((a & 0x80)) |           // N
            ((a==0) << 1);           // Z
}

void CMP(byte *addr){
    uint16_t diff = a - (*addr);
    uint8_t res = diff & 0xFF;
    
    flags = (flags & 0x7C) | 
            ((res & 0x80)) |         // N
            ((res==0) << 1) |        // Z
            ((a >= *addr) << 0);     // C
}

void SBC(byte *addr){
    uint8_t operand = ~(*addr);
    uint16_t sum = a + operand + (flags & 1);
    uint8_t res = sum & 0xFF;
    
    uint8_t overflow = ((a ^ res) & (~(*addr) ^ res) & 0x80) != 0;
    
    a = res;
    flags = (flags & 0x3C) | 
            (a & 0x80) |           // N
            (overflow << 6) |      // V
            ((a==0) << 1) |        // Z
            ((sum > 0xFF) << 0);   // C
}

void ASL(byte *addr){
    uint8_t val = *addr;
    uint8_t carry = (val & 0x80) >> 7;
    val = val << 1;
    *addr = val;
    
    flags = (flags & 0x7C) | 
            ((val & 0x80)) |     // N
            ((val==0) << 1) |    // Z
            carry;               // C
}

void ROL(byte *addr){
    uint8_t val = *addr;
    uint8_t old_carry = flags & 1;
    uint8_t new_carry = (val & 0x80) >> 7;
    val = (val << 1) | old_carry;
    *addr = val;
    
    flags = (flags & 0x7C) | 
            ((val & 0x80)) |     // N
            ((val==0) << 1) |    // Z
            new_carry;           // C
}

void LSR(byte *addr){
    uint8_t val = *addr;
    uint8_t carry = val & 1;
    val = val >> 1;
    *addr = val;
    
    flags = (flags & 0x7C) | 
            ((val & 0x80)) |     // N
            ((val==0) << 1) |    // Z
            carry;               // C
}

void ROR(byte *addr){
    uint8_t val = *addr;
    uint8_t old_carry = flags & 1;
    uint8_t new_carry = val & 1;
    val = (val >> 1) | (old_carry << 7);
    *addr = val;
    
    flags = (flags & 0x7C) | 
            ((val & 0x80)) |     // N
            ((val==0) << 1) |    // Z
            new_carry;           // C
}

void STX(byte *addr){
    *addr = x;
}

void LDX(byte *addr){
    x = *addr;
    flags = (flags & 0x7D) | 
            ((x & 0x80)) |           // N
            ((x==0) << 1);           // Z
}

void DEC(byte *addr){
    uint8_t val = (*addr) - 1;
    *addr = val;
    flags = (flags & 0x7D) | 
            ((val & 0x80)) |           // N
            ((val==0) << 1);           // Z
}

void INC(byte *addr){
    uint8_t val = (*addr) + 1;
    *addr = val;
    flags = (flags & 0x7D) | 
            ((val & 0x80)) |           // N
            ((val==0) << 1);           // Z
}

void BIT(byte *addr){
    uint8_t val = *addr;
    uint8_t result = a & val;
    
    flags = (flags & 0x3D) |
            ((result == 0) << 1) |    // Z
            (val & 0xC0);              // N,V
}

void JMP(byte *addr){
    uint16_t newaddr = addr - memory;
    pc = newaddr;
}

void STY(byte *addr){
    *addr = y;
}

void LDY(byte *addr){
    y = *addr;
    flags = (flags & 0x7D) | 
            ((y & 0x80)) |           // N
            ((y==0) << 1);           // Z
}

void CPY(byte *addr){
    uint16_t diff = y - (*addr);
    uint8_t res = diff & 0xFF;
    
    flags = (flags & 0x7C) | 
            ((res & 0x80)) |         // N
            ((res==0) << 1) |        // Z
            ((y >= *addr) << 0);     // C
}

void CPX(byte *addr){
    uint16_t diff = x - (*addr);
    uint8_t res = diff & 0xFF;
    
    flags = (flags & 0x7C) | 
            ((res & 0x80)) |         // N
            ((res==0) << 1) |        // Z
            ((x >= *addr) << 0);     // C
}

void push_to_stack(byte *registerptr){
    uint16_t offset = 0x100 | stackpointer;
    memory[offset] = *registerptr;
    stackpointer--;
}

void pull_from_stack(byte *registerptr){
    stackpointer++;
    uint16_t offset = 0x100 | stackpointer;
    *registerptr = memory[offset];
    
    if(registerptr != &flags && registerptr != &stackpointer){
        flags = (flags & 0x7D) | 
                ((*registerptr & 0x80)) |           // N
                ((*registerptr == 0) << 1);         // Z
    }
}

void transfer_registers(byte *reg1, byte *reg2){
    byte val = *reg1;
    *reg2 = val;
    if(reg2 != &stackpointer){
        flags = (flags & 0x7D) | 
                ((val & 0x80)) |           // N
                ((val==0) << 1);           // Z
    }
}

void set_clear_flag(uint8_t shiftamt, uint8_t val){
    byte newval = (val & 1) << shiftamt;
    flags = (flags & ~(1 << shiftamt)) | newval;
}

void push_word(uint16_t value){
    byte hi = (value >> 8) & 0xFF;
    byte lo = value & 0xFF;
    push_to_stack(&hi);
    push_to_stack(&lo);
}

uint16_t pull_word(void){
    byte lo, hi;
    pull_from_stack(&lo);
    pull_from_stack(&hi);
    return (hi << 8) | lo;
}

void push_pc(void){
    push_word(pc);
}

uint16_t pull_pc(void){
    return pull_word();
}

void NOP(){

}

void BRK(){
    flags |= 0x10;
    flags |= 0x04;

    uint16_t return_addr = pc + 1;
    byte hi = (return_addr >> 8) & 0xFF;
    byte lo = return_addr & 0xFF;
    
    push_to_stack(&hi);
    push_to_stack(&lo);
    
    byte status = flags | 0x30;
    push_to_stack(&status);
    
    pc = (memory[0xFFFF] << 8) | memory[0xFFFE];
}

void JSR(){
    uint16_t target = (memory[pc+1] << 8) | memory[pc];
    
    uint16_t return_addr = pc + 2;
    byte hi = (return_addr >> 8) & 0xFF;
    byte lo = return_addr & 0xFF;
    
    push_to_stack(&hi);
    push_to_stack(&lo);
    
    pc = target;
}

void RTI(){
  byte status;
    pull_from_stack(&status);
    flags = (status & ~0x30) | 0x20;
    
    byte lo, hi;
    pull_from_stack(&lo);
    pull_from_stack(&hi);
    pc = (hi << 8) | lo;
}

void RTS(){
    byte lo, hi;
    pull_from_stack(&lo);
    pull_from_stack(&hi);
    uint16_t addr = (hi << 8) | lo;
    pc = addr + 1;
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
