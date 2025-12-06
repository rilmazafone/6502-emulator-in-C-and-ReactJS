#ifndef MAININCLUDE
#define MAININCLUDE


#include <ncurses.h>
#include <string.h>
#include <stdlib.h>
#include "registers.h"
#include "operations.h"
#include "func.h"

#define WIDTH 80
#define HEIGHT 20

static uint8_t lastop;

void move_memory(size_t num_bytes);
void memory_explorer();
void print_page_curses(WINDOW *menu_win, uint8_t mempage, char *charbuff);
uint8_t process_charbuff(char *arr, int arrlen, uint8_t mempage, char fill, WINDOW *win);
void clear_charbuff(char *arr, int arrlen, char fill);
void hexdump_mempage(uint8_t page);

#endif
