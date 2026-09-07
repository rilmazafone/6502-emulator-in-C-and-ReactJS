#include "operations.h"

void ORA(byte *addr){
    a = a | (*addr);
    flags = (flags & 0x7D) |
            ((a & 0x80)) |
            ((a==0) << 1);
}

void AND(byte *addr){
    a = a & (*addr);
    flags = (flags & 0x7D) |
            ((a & 0x80)) |
            ((a==0) << 1);
}

void EOR(byte *addr){
    a = a ^ (*addr);
    flags = (flags & 0x7D) |
            ((a & 0x80)) |
            ((a==0) << 1);
}

void ADC(byte *addr){
    uint16_t sum = a + (*addr) + (flags & 1);
    uint8_t res = sum & 0xFF;

    uint8_t overflow = (~(a ^ *addr) & (a ^ res) & 0x80) != 0;

    a = res;
    flags = (flags & 0x3C) |
            (a & 0x80) |
            (overflow << 6) |
            ((a==0) << 1) |
            ((sum > 0xFF) << 0);
}

void STA(byte *addr){
    *addr = a;
}

void LDA(byte *addr){
    a = *addr;
    flags = (flags & 0x7D) |
            ((a & 0x80)) |
            ((a==0) << 1);
}

void CMP(byte *addr){
    uint16_t diff = a - (*addr);
    uint8_t res = diff & 0xFF;

    flags = (flags & 0x7C) |
            ((res & 0x80)) |
            ((res==0) << 1) |
            ((a >= *addr) << 0);
}

void SBC(byte *addr){
    uint8_t operand = ~(*addr);
    uint16_t sum = a + operand + (flags & 1);
    uint8_t res = sum & 0xFF;

    uint8_t overflow = ((a ^ res) & (~(*addr) ^ res) & 0x80) != 0;

    a = res;
    flags = (flags & 0x3C) |
            (a & 0x80) |
            (overflow << 6) |
            ((a==0) << 1) |
            ((sum > 0xFF) << 0);
}

void ASL(byte *addr){
    uint8_t val = *addr;
    uint8_t carry = (val & 0x80) >> 7;
    val = val << 1;
    *addr = val;

    flags = (flags & 0x7C) |
            ((val & 0x80)) |
            ((val==0) << 1) |
            carry;
}

void ROL(byte *addr){
    uint8_t val = *addr;
    uint8_t old_carry = flags & 1;
    uint8_t new_carry = (val & 0x80) >> 7;
    val = (val << 1) | old_carry;
    *addr = val;

    flags = (flags & 0x7C) |
            ((val & 0x80)) |
            ((val==0) << 1) |
            new_carry;
}

void LSR(byte *addr){
    uint8_t val = *addr;
    uint8_t carry = val & 1;
    val = val >> 1;
    *addr = val;

    flags = (flags & 0x7C) |
            ((val & 0x80)) |
            ((val==0) << 1) |
            carry;
}

void ROR(byte *addr){
    uint8_t val = *addr;
    uint8_t old_carry = flags & 1;
    uint8_t new_carry = val & 1;
    val = (val >> 1) | (old_carry << 7);
    *addr = val;

    flags = (flags & 0x7C) |
            ((val & 0x80)) |
            ((val==0) << 1) |
            new_carry;
}

void STX(byte *addr){
    *addr = x;
}

void LDX(byte *addr){
    x = *addr;
    flags = (flags & 0x7D) |
            ((x & 0x80)) |
            ((x==0) << 1);
}

void DEC(byte *addr){
    uint8_t val = (*addr) - 1;
    *addr = val;
    flags = (flags & 0x7D) |
            ((val & 0x80)) |
            ((val==0) << 1);
}

void INC(byte *addr){
    uint8_t val = (*addr) + 1;
    *addr = val;
    flags = (flags & 0x7D) |
            ((val & 0x80)) |
            ((val==0) << 1);
}

void BIT(byte *addr){
    uint8_t val = *addr;
    uint8_t result = a & val;

    flags = (flags & 0x3D) |
            ((result == 0) << 1) |
            (val & 0xC0);
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
            ((y & 0x80)) |
            ((y==0) << 1);
}

void CPY(byte *addr){
    uint16_t diff = y - (*addr);
    uint8_t res = diff & 0xFF;

    flags = (flags & 0x7C) |
            ((res & 0x80)) |
            ((res==0) << 1) |
            ((y >= *addr) << 0);
}

void CPX(byte *addr){
    uint16_t diff = x - (*addr);
    uint8_t res = diff & 0xFF;

    flags = (flags & 0x7C) |
            ((res & 0x80)) |
            ((res==0) << 1) |
            ((x >= *addr) << 0);
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
                ((*registerptr & 0x80)) |
                ((*registerptr == 0) << 1);
    }
}

void transfer_registers(byte *reg1, byte *reg2){
    byte val = *reg1;
    *reg2 = val;
    if(reg2 != &stackpointer){
        flags = (flags & 0x7D) |
                ((val & 0x80)) |
                ((val==0) << 1);
    }
}

void set_clear_flag(uint8_t shiftamt, uint8_t val){
    byte newval = (val & 1) << shiftamt;
    flags = (flags & ~(1 << shiftamt)) | newval;
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

    uint16_t return_addr = pc + 1;
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
    uint8_t bit = 1 << (high & 0x7);
    uint8_t val = read_byte(memory + addr);

    if (high & 0x8)
        val |= bit;   /* SMB: set memory bit */
    else
        val &= ~bit;  /* RMB: reset memory bit */

    write_byte(memory + addr, val);
}

void test_and_branch(byte high){
    uint8_t addr_to_test = read_pc();
    int8_t offset = read_pc();
    uint8_t bit = 1 << (high & 0x7);

    if (((read_byte(memory + addr_to_test) & bit) != 0) == ((high & 0x8) != 0)){
        JMP(memory + (pc + offset));
    }
}

void STZ(byte *addr){
    write_byte(addr, 0);
}

void TSB(byte *addr){
    uint8_t mem = read_byte(addr);
    uint8_t val = mem | a;
    flags = (flags & 0xFD) | (((mem & a) == 0) << 1);
    write_byte(addr, val);
}

void TRB(byte *addr){
    uint8_t mem = read_byte(addr);
    uint8_t val = mem & (~a);
    flags = (flags & 0xFD) | (((mem & a) == 0) << 1);
    write_byte(addr, val);
}
