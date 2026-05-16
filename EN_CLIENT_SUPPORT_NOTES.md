# EN client support beta

Added support for EN-client log lines:

- `Generating level <n> area "<area_id>" with seed <seed>`
- `You have entered <zone>` / `Entering area: <zone>`
- `<character> (<class>) is now level <level>`
- EN permanent reward lines for resistances, spirit, life, mana, passive points, weapon-set points, charms, flask recovery and stun threshold.

Current internal area-id mapping is conservative: Act 1 is mapped from the provided Client.txt sample. Other internal area ids are detected as raw gameplay scenes, but need mapping before they can drive exact guide entries.

Next data needed for wider EN mapping: short logs from clean Act 2 / Act 3 / Act 4 runs with notes about the current zone name, or screenshots/route order when each internal id appears.
