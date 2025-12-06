#include <emscripten.h>
#include <emscripten/em_asm.h>
#include "func_web.h"
#include "registers.h"

// Export functions to JavaScript
EMSCRIPTEN_KEEPALIVE
void js_reset_cpu() {
    reset_cpu();
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_execute_instruction() {
    return execute_instruction();
}

EMSCRIPTEN_KEEPALIVE
uint8_t* js_get_memory() {
    return memory;
}

EMSCRIPTEN_KEEPALIVE
void js_write_memory(uint16_t addr, uint8_t value) {
    if (addr < 0x10000) {
        memory[addr] = value;
    }
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_read_memory(uint16_t addr) {
    return memory[addr];
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_a() { return a; }

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_x() { return x; }

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_y() { return y; }

EMSCRIPTEN_KEEPALIVE
uint16_t js_get_pc() { return pc; }

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_sp() { return stackpointer; }

EMSCRIPTEN_KEEPALIVE
uint8_t js_get_flags() { return flags; }

EMSCRIPTEN_KEEPALIVE
void js_set_pc(uint16_t value) { pc = value; }

EMSCRIPTEN_KEEPALIVE
void js_load_program(uint8_t* data, uint16_t size, uint16_t start_addr) {
    for(uint16_t i = 0; i < size && (start_addr + i) < 0x10000; i++) {
        memory[start_addr + i] = data[i];
    }
    pc = start_addr;
}