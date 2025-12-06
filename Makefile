# Simple Makefile for 6502 Emulator (Flat Structure)
# All source files in same directory

# Compiler settings
CC = gcc
EMCC = emcc
CFLAGS = -Wall -Wextra -O2 -std=c99
LDFLAGS = -lncurses

# Emscripten flags
EMFLAGS = -O3 \
          -s WASM=1 \
          -s EXPORTED_FUNCTIONS='["_js_reset_cpu","_js_execute_instruction","_js_get_memory","_js_write_memory","_js_read_memory","_js_get_a","_js_get_x","_js_get_y","_js_get_pc","_js_get_sp","_js_get_flags","_js_set_pc","_malloc","_free"]' \
          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","HEAPU8"]' \
          -s ALLOW_MEMORY_GROWTH=1 \
          -s MODULARIZE=1 \
          -s EXPORT_NAME='createEmulatorModule' \
          -s ENVIRONMENT='web' \
          -s INITIAL_MEMORY=16777216

# Source files (all in current directory)
NATIVE_SOURCES = func.c operations.c main.c
WEB_SOURCES = func_web.c operations.c emscripten_wrapper.c
HEADERS = func.h func_web.h operations.h registers.h main.h

# Object files for native build
OBJECTS = func.o operations.o main.o

# Output files
NATIVE_BIN = emulator
WEB_JS = emulator.js
WEB_WASM = emulator.wasm

# Default target
.PHONY: all
all: help

# Build native executable
.PHONY: native
native: $(NATIVE_BIN)

$(NATIVE_BIN): $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	@echo ""
	@echo "✓ Native emulator built: ./$(NATIVE_BIN)"
	@echo "  Run with: ./$(NATIVE_BIN) program.bin"

%.o: %.c $(HEADERS)
	$(CC) $(CFLAGS) -c -o $@ $<

# Build WebAssembly
.PHONY: web
web: $(WEB_JS)

$(WEB_JS): $(WEB_SOURCES) $(HEADERS)
	@echo "Building WebAssembly..."
	$(EMCC) $(EMFLAGS) -o $@ $(WEB_SOURCES)
	@echo ""
	@echo "✓ WebAssembly built successfully:"
	@echo "  - $(WEB_JS)"
	@echo "  - $(WEB_WASM)"
	@echo ""
	@echo "Next: Copy these files to your web app's public/ folder"

# Create func_web.c from func.c if it doesn't exist
func_web.c: func.c
	@if [ ! -f func_web.c ]; then \
		echo "Creating func_web.c from func.c..."; \
		cp func.c func_web.c; \
		sed -i.bak 's/#include "func.h"/#include "func_web.h"/' func_web.c; \
		rm -f func_web.c.bak; \
		echo "✓ Created func_web.c"; \
	fi

# Copy to React app public folder (customize path as needed)
WEB_APP_DIR = ./react-app
.PHONY: deploy
deploy: web
	@if [ -d "$(WEB_APP_DIR)/public" ]; then \
		cp $(WEB_JS) $(WEB_WASM) $(WEB_APP_DIR)/public/; \
		echo "✓ Deployed to $(WEB_APP_DIR)/public/"; \
	else \
		echo ""; \
		echo "To deploy, either:"; \
		echo "  1. Update WEB_APP_DIR in Makefile to point to your React app"; \
		echo "  2. Manually copy $(WEB_JS) and $(WEB_WASM) to your app's public/ folder"; \
	fi

# Setup: Create func_web.c and func_web.h if needed
.PHONY: setup
setup:
	@echo "Checking setup..."
	@if [ ! -f func_web.c ]; then \
		if [ -f func.c ]; then \
			cp func.c func_web.c; \
			sed -i.bak 's/#include "func.h"/#include "func_web.h"/' func_web.c; \
			rm -f func_web.c.bak; \
			echo "✓ Created func_web.c"; \
		else \
			echo "✗ func.c not found!"; \
		fi \
	else \
		echo "✓ func_web.c exists"; \
	fi
	@if [ ! -f func_web.h ]; then \
		if [ -f func.h ]; then \
			cp func.h func_web.h; \
			sed -i.bak 's/func\.h/func_web.h/g' func_web.h; \
			rm -f func_web.h.bak; \
			echo "✓ Created func_web.h"; \
		else \
			echo "✗ func.h not found!"; \
		fi \
	else \
		echo "✓ func_web.h exists"; \
	fi
	@echo ""
	@echo "Setup complete! Run 'make web' to build WebAssembly"

# Clean build files
.PHONY: clean
clean:
	rm -f *.o $(NATIVE_BIN) $(WEB_JS) $(WEB_WASM)
	@echo "✓ Cleaned build artifacts"

# Run native emulator
.PHONY: run
run: native
	@if [ -n "$(PROG)" ]; then \
		./$(NATIVE_BIN) $(PROG); \
	else \
		echo "Usage: make run PROG=program.bin"; \
	fi

# Check if emscripten is installed
.PHONY: check
check:
	@echo "Checking environment..."
	@echo ""
	@which $(CC) > /dev/null && echo "✓ GCC found: $$($(CC) --version | head -n1)" || echo "✗ GCC not found"
	@which $(EMCC) > /dev/null && echo "✓ Emscripten found: $$($(EMCC) --version | head -n1)" || echo "✗ Emscripten not found (install from https://emscripten.org/)"
	@echo ""
	@echo "Source files in current directory:"
	@ls -1 *.c *.h 2>/dev/null || echo "  No source files found"

# List all files
.PHONY: list
list:
	@echo "Source files:"
	@ls -1 *.c *.h 2>/dev/null || echo "  None found"
	@echo ""
	@echo "Build artifacts:"
	@ls -1 *.o $(NATIVE_BIN) $(WEB_JS) $(WEB_WASM) 2>/dev/null || echo "  None found"

# Help
.PHONY: help
help:
	@echo "6502 Emulator Makefile (Flat Structure)"
	@echo ""
	@echo "Quick Start:"
	@echo "  make setup        - Setup func_web.c and func_web.h"
	@echo "  make web          - Build WebAssembly"
	@echo "  make deploy       - Copy to React app (set WEB_APP_DIR first)"
	@echo ""
	@echo "All Targets:"
	@echo "  make setup        - Create web-specific files from native ones"
	@echo "  make web          - Build emulator.js and emulator.wasm"
	@echo "  make native       - Build native executable (requires ncurses)"
	@echo "  make deploy       - Copy WASM files to React app"
	@echo "  make run PROG=... - Run native emulator with program"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make check        - Check if required tools are installed"
	@echo "  make list         - List all source and build files"
	@echo "  make help         - Show this help"
	@echo ""
	@echo "Examples:"
	@echo "  make setup        # First time setup"
	@echo "  make web          # Build for web"
	@echo "  make native       # Build for terminal"
	@echo "  make run PROG=test.bin"
	@echo ""
	@echo "Variables:"
	@echo "  WEB_APP_DIR       - Path to React app (default: ./react-app)"

.PHONY: info
info:
	@echo "Project Configuration:"
	@echo "  Working directory: $$(pwd)"
	@echo "  Native output:     $(NATIVE_BIN)"
	@echo "  Web output:        $(WEB_JS), $(WEB_WASM)"
	@echo "  Web app location:  $(WEB_APP_DIR)"
	@echo ""
	@echo "Required files:"
	@for file in $(NATIVE_SOURCES) $(HEADERS); do \
		if [ -f "$$file" ]; then \
			echo "  ✓ $$file"; \
		else \
			echo "  ✗ $$file (missing)"; \
		fi \
	done
	@if [ -f "emscripten_wrapper.c" ]; then \
		echo "  ✓ emscripten_wrapper.c"; \
	else \
		echo "  ✗ emscripten_wrapper.c (missing)"; \
	fi