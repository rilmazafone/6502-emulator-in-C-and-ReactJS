CC = gcc
EMCC = emcc
CFLAGS = -Wall -Wextra -O2 -std=c99
LDFLAGS = -lncurses

EMFLAGS = -O3 \
          -s WASM=1 \
          -s EXPORTED_FUNCTIONS='["_js_init","_js_reset","_js_step","_js_write_mem","_js_read_mem","_js_get_a","_js_get_x","_js_get_y","_js_get_pc","_js_get_sp","_js_get_flags","_js_set_pc","_js_load_program","_malloc","_free"]' \
          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
          -s ALLOW_MEMORY_GROWTH=1 \
          -s MODULARIZE=1 \
          -s EXPORT_NAME='createEmulatorModule' \
          -s ENVIRONMENT='web' \
          -s INITIAL_MEMORY=16777216

NATIVE_SOURCES = func.c operations.c main.c
WEB_SOURCES = func_web.c operations.c emscripten_wrapper.c
HEADERS = func.h func_web.h operations.h registers.h main.h

OBJECTS = func.o operations.o main.o

NATIVE_BIN = emulator
WEB_JS = emulator.js
WEB_WASM = emulator.wasm
WEB_APP_DIR = ./6502-web

.PHONY: all
all: help

.PHONY: native
native: $(NATIVE_BIN)

$(NATIVE_BIN): $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

%.o: %.c $(HEADERS)
	$(CC) $(CFLAGS) -c -o $@ $<

.PHONY: web
web: $(WEB_JS)

$(WEB_JS): $(WEB_SOURCES) $(HEADERS)
	$(EMCC) $(EMFLAGS) -o $@ $(WEB_SOURCES)

.PHONY: deploy
deploy: web
	@if [ -d "$(WEB_APP_DIR)/public" ]; then \
		cp $(WEB_JS) $(WEB_WASM) $(WEB_APP_DIR)/public/; \
		echo "Deployed to $(WEB_APP_DIR)/public/"; \
	else \
		echo "$(WEB_APP_DIR)/public/ not found"; \
	fi

.PHONY: clean
clean:
	rm -f *.o $(NATIVE_BIN) $(WEB_JS) $(WEB_WASM)

.PHONY: run
run: native
	@if [ -n "$(PROG)" ]; then \
		./$(NATIVE_BIN) $(PROG); \
	else \
		echo "Usage: make run PROG=program.bin"; \
	fi

.PHONY: check
check:
	@which $(CC) > /dev/null && echo "GCC: $$($(CC) --version | head -n1)" || echo "GCC not found"
	@which $(EMCC) > /dev/null && echo "Emscripten: $$($(EMCC) --version | head -n1)" || echo "Emscripten not found"

.PHONY: help
help:
	@echo "Targets:"
	@echo "  make native       - Build native executable (requires ncurses)"
	@echo "  make web          - Build emulator.js and emulator.wasm"
	@echo "  make deploy       - Copy WASM files to React app"
	@echo "  make run PROG=... - Run native emulator with program"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make check        - Check if required tools are installed"
