#ifndef OPERATIONSINCLUDE
#define OPERATIONSINCLUDE

#include <stdint.h>
#include "registers.h"

typedef uint8_t byte;

// Add function declarations that operations.c needs
void write_byte(byte *address, byte value);
byte read_byte(byte *address);
uint16_t read_address(uint16_t offset);
byte read_pc();
void set_pc(uint16_t value);

// Helper functions for 16-bit stack operations
void push_word(uint16_t value);
uint16_t pull_word(void);
void push_pc(void);
uint16_t pull_pc(void);

//G1
void SBC(byte *addr);
void ORA(byte *addr);
void AND(byte *addr);
void EOR(byte *addr);
void ADC(byte *addr);
void STA(byte *addr);
void LDA(byte *addr);
void CMP(byte *addr);

//G2
void ASL(byte *addr);
void ROL(byte *addr);
void LSR(byte *addr);
void ROR(byte *addr);
void STX(byte *addr);
void LDX(byte *addr);
void DEC(byte *addr);
void INC(byte *addr);

//G3
void BIT(byte *addr);
void JMP(byte *addr);
void STY(byte *addr);
void LDY(byte *addr);
void CPY(byte *addr);
void CPX(byte *addr);

void push_to_stack(byte *registerptr);
void pull_from_stack(byte *registerptr);
void transfer_registers(byte *reg1,byte *reg2);
void set_clear_flag(uint8_t shiftamt,uint8_t val);

void NOP();
void BRK();
void JSR();
void RTI();
void RTS();

void bit_set_clear(byte high);
void test_and_branch(byte high);
void STZ(byte *addr);
void TSB(byte *addr);
void TRB(byte *addr);

#endif