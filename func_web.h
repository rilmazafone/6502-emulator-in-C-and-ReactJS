#ifndef COREHEADERINCLUDE
#define COREHEADERINCLUDE

#include <stdio.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include "registers.h"
#include "operations.h"

// For web builds, we don't need sleep/timing
#ifdef __EMSCRIPTEN__
  #define sleep_ns(x)
  #define CLOCK_TIME 0
#else
  #include <time.h>
  #include <unistd.h>
  #define sleep_ns(x) { \
      struct timespec ts; \
      ts.tv_sec = 0; \
      ts.tv_nsec = x; \
      nanosleep(&ts, NULL); \
  }
  #ifndef CLOCK_TIME
    #define CLOCK_TIME 1
  #endif
#endif

void reset_cpu();

byte read_byte(byte *address);
void write_byte(byte *address, byte value);

uint16_t read_address(uint16_t offset);
byte read_pc();
void set_pc(uint16_t value);

uint8_t execute_instruction();

byte* decode_addrmode_group1(byte addrmode);
byte* decode_addrmode_group23(byte addrmode, byte highbits);

void run_instruction_group1(byte *address, uint8_t highbits);
void run_instruction_group2(byte *address, uint8_t highbits);
void run_instruction_group3(byte *address, uint8_t highbits);
void run_instruction_branching(uint8_t highbits);
void run_instruction_sbyte1(uint8_t highbits);
void run_instruction_sbyte2(uint8_t highbits);
void run_instruction_interrupt(uint8_t highbits);

bool try65C02opcode(uint8_t opcode);

#endif
