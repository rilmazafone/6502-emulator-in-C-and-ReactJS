#include <emscripten.h>
#include <string.h>
#include "registers.h"

void reset_cpu();
uint8_t execute_instruction();

EMSCRIPTEN_KEEPALIVE
void js_reset() {
    reset_cpu();
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_step() {
    return execute_instruction();
}

EMSCRIPTEN_KEEPALIVE
void js_clear_mem() {
    memset(memory, 0, sizeof(memory));
}

EMSCRIPTEN_KEEPALIVE
void js_write_mem(uint16_t addr, uint8_t value) {
    memory[addr] = value;
}

EMSCRIPTEN_KEEPALIVE
uint8_t js_read_mem(uint16_t addr) {
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
