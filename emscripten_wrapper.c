#include <emscripten.h>
#include <stdio.h>
#include "registers.h"

void reset_cpu();
uint8_t execute_instruction();

EMSCRIPTEN_KEEPALIVE
void js_debug_print() {
    printf("Debug: a=%d, x=%d, y=%d, pc=%d, sp=%d, flags=%d\n", 
           a, x, y, pc, stackpointer, flags);
}

EMSCRIPTEN_KEEPALIVE
void js_init() {
    printf("js_init called\n");
    reset_cpu();
    printf("After reset: a=%d, pc=%d\n", a, pc);
}

EMSCRIPTEN_KEEPALIVE
void js_reset() {
    printf("js_reset called\n");
    reset_cpu();
    printf("After reset: a=%d, x=%d, y=%d, pc=%d\n", a, x, y, pc);
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_step() {
    printf("Before step: a=%d, pc=%d\n", a, pc);
    uint8_t result = execute_instruction();
    printf("After step: a=%d, pc=%d, opcode=%d\n", a, pc, result);
    return result;
}

EMSCRIPTEN_KEEPALIVE
void js_write_mem(uint16_t addr, uint8_t value) {
    if (addr < 0x10000) {
        memory[addr] = value;
        printf("Wrote %d to address %04x\n", value, addr);
    }
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_read_mem(uint16_t addr) {
    if (addr < 0x10000) {
        return memory[addr];
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_a() { 
    printf("js_get_a returning: %d\n", a);
    return a; 
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_x() { 
    printf("js_get_x returning: %d\n", x);
    return x; 
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_y() { 
    printf("js_get_y returning: %d\n", y);
    return y; 
}

EMSCRIPTEN_KEEPALIVE
uint16_t js_get_pc() { 
    printf("js_get_pc returning: %d\n", pc);
    return pc; 
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_sp() { 
    printf("js_get_sp returning: %d\n", stackpointer);
    return stackpointer; 
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_flags() { 
    printf("js_get_flags returning: %d\n", flags);
    return flags; 
}

EMSCRIPTEN_KEEPALIVE
void js_set_pc(uint16_t value) { 
    printf("js_set_pc called with: %d\n", value);
    pc = value;
    printf("pc is now: %d\n", pc);
}

EMSCRIPTEN_KEEPALIVE
void js_load_program(uint8_t* data, uint16_t size, uint16_t start_addr) {
    for(uint16_t i = 0; i < size && (start_addr + i) < 0x10000; i++) {
        memory[start_addr + i] = data[i];
    }
    pc = start_addr;
}
