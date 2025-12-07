#ifndef REGISTERINCLUDE
#define REGISTERINCLUDE

#include <stdint.h>
typedef uint8_t byte;

// Declare as extern so they're shared across compilation units
extern byte a, x, y;
extern uint16_t pc;
extern byte stackpointer;
extern byte flags;
extern byte memory[0x10000];

#endif