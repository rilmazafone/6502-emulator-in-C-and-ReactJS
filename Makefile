EMCC = emcc

EMFLAGS = -O3 \
          -s WASM=1 \
          -s EXPORTED_FUNCTIONS='["_js_reset","_js_step","_js_clear_mem","_js_write_mem","_js_read_mem","_js_get_a","_js_get_x","_js_get_y","_js_get_pc","_js_get_sp","_js_get_flags"]' \
          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
          -s ALLOW_MEMORY_GROWTH=1 \
          -s MODULARIZE=1 \
          -s EXPORT_NAME='createEmulatorModule' \
          -s ENVIRONMENT='web' \
          -s INITIAL_MEMORY=1048576

WEB_SOURCES = func_web.c operations.c emscripten_wrapper.c
HEADERS = func_web.h operations.h registers.h

WEB_JS = emulator.js
WEB_WASM = emulator.wasm
WEB_APP_DIR = ./6502-web

.PHONY: all
all: web

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
	rm -f $(WEB_JS) $(WEB_WASM)

.PHONY: check
check:
	@which $(EMCC) > /dev/null && echo "Emscripten: $$($(EMCC) --version | head -n1)" || echo "Emscripten not found"

.PHONY: help
help:
	@echo "Targets:"
	@echo "  make web       - Build emulator.js and emulator.wasm"
	@echo "  make deploy    - Copy WASM files to React app"
	@echo "  make clean     - Remove build artifacts"
	@echo "  make check     - Check if required tools are installed"
