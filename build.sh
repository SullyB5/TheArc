#!/bin/sh
# game.js is built from the parts in src/
cd "$(dirname "$0")" && cat src/1-world.js src/1b-build.js src/1c-camp.js src/1d-regions.js src/2-actors.js src/3-game.js > game.js
