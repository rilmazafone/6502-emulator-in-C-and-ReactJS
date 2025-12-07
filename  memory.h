#ifndef MEMORY_H
#define MEMORY_H

#include <stdint.h>

#define MEMORY_SIZE 65536
typedef uint8_t byte;

extern byte memory[MEMORY_SIZE];

byte mem_read(uint16_t address);
void mem_write(uint16_t address, byte value);
void mem_clear(void);

#endif