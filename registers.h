#ifndef REGISTERINCLUDE
#define REGISTERINCLUDE

#include <stdint.h>
typedef uint8_t byte;

// Declare variables as extern (don't define them here)
extern byte a, x, y;
extern uint16_t pc;
extern byte stackpointer;
extern byte data;
extern byte flags;
extern uint16_t address;
extern byte memory[0x10000];

#endif