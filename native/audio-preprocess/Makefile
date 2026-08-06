# native/audio-preprocess/Makefile

# 前処理用Cライブラリを共有ライブラリとしてビルドする設定。
# Makefileは「作りたいもの : そのために必要なもの」を並べ、
# 必要なものが更新されていたら作り直す、という仕組みで動く。

# Windowsの既定シェル(コマンドプロンプト)は mkdir -p や rm -rf を解釈できないため、
# MSYS2のbashに差し替える。macOS/Linuxは既定シェルで問題ないため対象外。
ifeq ($(OS),Windows_NT)
	SHELL := C:/msys64/usr/bin/bash.exe
endif

# よく使う値に名前を付けておく。$(CC) と書くと gcc に置き換わる
CC      := gcc
# -Wall -Wextra: 警告を多めに出す / -O2: 最適化 / -fPIC: 共有ライブラリに必須
# -Iinclude: ヘッダファイルを include フォルダから探す
CFLAGS  := -Wall -Wextra -O2 -fPIC -Iinclude
# -shared: 実行ファイルではなく共有ライブラリとして出力する
LDFLAGS := -shared
# -lm: sqrtf や fabsf を使うため、数学ライブラリをリンクする
LDLIBS  := -lm

BUILD_DIR := build
DIST_DIR  := dist
SRC_DIR   := src

# OSごとに共有ライブラリの拡張子が異なるため、環境を判別して切り替える
ifeq ($(OS),Windows_NT)
	LIB_NAME := audio_preprocess.dll
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Darwin)
		LIB_NAME := libaudio_preprocess.dylib
	else
		LIB_NAME := libaudio_preprocess.so
	endif
endif

# 共有ライブラリに含めるソース。末尾の \ は改行時の記号
LIB_SOURCES := $(SRC_DIR)/silence_trim.c \
               $(SRC_DIR)/simple_vad.c \
               $(SRC_DIR)/volume_normalize.c

# 上記の一覧を置換して、中間ファイル(.o)の一覧を作る
LIB_OBJECTS := $(LIB_SOURCES:$(SRC_DIR)/%.c=$(BUILD_DIR)/%.o)

# テスト実行ファイルの一覧を作る
TEST_NAMES   := silence_trim simple_vad volume_normalize
TEST_TARGETS := $(TEST_NAMES:%=$(BUILD_DIR)/test_%)

# all, test, clean はファイル名ではなくコマンド名であることを宣言する。
# これがないと、同名のファイルが存在した場合に動作しなくなる
.PHONY: all test clean

# 何も指定せず make した時に実行される既定のターゲット
all: $(DIST_DIR)/$(LIB_NAME)

# 共有ライブラリを生成する
# コロンの左が作りたいもの、右が必要なもの。| の右は「先に存在していればよい」依存
# $@ は作りたいもの、$^ は必要なもの全部を指す
$(DIST_DIR)/$(LIB_NAME): $(LIB_OBJECTS) | $(DIST_DIR)
	$(CC) $(LDFLAGS) -o $@ $^ $(LDLIBS)

# 各ソースを中間ファイルにコンパイルする
# $* は % に一致した部分。-c はリンクせずコンパイルのみ行う指定
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c include/audio_preprocess.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c -o $@ $(SRC_DIR)/$*.c

# テストは共有ライブラリを経由せず、対応する実装とテストコードを直接リンクする
$(BUILD_DIR)/test_%: $(SRC_DIR)/test_%.c $(SRC_DIR)/%.c include/audio_preprocess.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $(SRC_DIR)/test_$*.c $(SRC_DIR)/$*.c $(LDLIBS)

# TEST_NAMES に並べたテストを順に実行する
# @ は実行するコマンド自体を画面に出さない指定
# Makefileでは $ が特別な意味を持つため、シェルの変数は $$ と2つ重ねる
# || exit 1 で、1つでも失敗したらそこで止める
test: $(TEST_TARGETS)
	@for t in $(TEST_TARGETS); do \
		echo "--- $$t ---"; \
		./$$t || exit 1; \
	done

# 出力先フォルダがなければ作る
$(BUILD_DIR) $(DIST_DIR):
	mkdir "$@"

# 生成物をまとめて削除する
clean:
	rm -rf $(BUILD_DIR) $(DIST_DIR)