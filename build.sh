#!/bin/sh
# game.js is built from the parts in src/ (the icon list is generated from assets/icons)
cd "$(dirname "$0")" || exit 1
printf "const ICON_IDS = new Set('%s'.split(' '));\n" "$(ls assets/icons | sed 's/\.png$//' | tr '\n' ' ' | sed 's/ $//')" > src/2a-icons.gen.js
cat src/1-world.js src/1b-build.js src/1c-camp.js src/1f-houses.js src/1d-regions.js src/1e-far.js src/1e-city.js src/1j-city-interiors.js src/1g-env.js src/1h-props.js src/1k-weather.js src/2-actors.js src/2e-wildlife.js src/2a-icons.gen.js src/2a-data.js src/2a-icons.js src/2b-craft.js src/2c-weapons.js src/2d-build.js src/2f-explore.js src/2g-factions.js src/2h-settlement.js src/2i-story.js src/3-game.js > game.js
