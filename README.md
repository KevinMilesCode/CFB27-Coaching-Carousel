# CFB27 Coaching Carousel Editor

A desktop application for editing College Football 27 dynasty coaching carousel job offers and coach movements.

## Features

- Load and edit CFB27 dynasty save files
- View and modify coach job offers and interest levels
- Move coaches between teams
- Replace coaches with candidates
- Filter by team, position, conference, and prestige
- Save changes back to your dynasty file

## Requirements

- Windows 10 or later
- College Football 27 dynasty save file

## Installation

1. Download `CFB27 Coaching Carousel Editor.exe` from the releases
2. Place the executable anywhere on your computer
3. Run the executable - no installation required

## Usage

1. **Launch the application** by double-clicking the executable
2. **Load your dynasty:**
   - Select your dynasty file from the dropdown
   - Or click "Change Save Directory" if your saves are in a custom location
   - Click "Load"
3. **Edit coaching carousel:**
   - View available job openings and candidates grouped by hiring school
   - Adjust coach interest levels (Coach Interest, Team Interest)
   - Move coaches up/down in candidate rankings
   - Replace coaches with other available coaches
   - Use filters to narrow down by team, position, conference, or prestige
4. **Save your changes:**
   - Click the "Save" button when done
   - Changes are written back to your dynasty file

## Important Notes

- **Backup your dynasty file** before using this tool
- The tool modifies your actual dynasty save file
- **Launch during any week of the coaching carousel** (typically Weeks 14-16 in-season, or offseason weeks when coaching changes occur)
- The save directory is automatically detected from your CFB27 installation
- Conference logos will display if available in the Resources/conferences directory

## Game updates and save compatibility

The tool reads the schema version your save declares in its own header and picks
the matching bundled schema, so the same build works on saves from before and
after a game update. Both the pre-2026-08-06 layout and the patched layout ship
with it, because that patch changed the coach table in a way that is not
backward or forward compatible.

If a future update ships a layout none of the bundled schemas cover, coach names
and teams read as blank or the tool reports a missing field. That means a new
schema is needed, not that your save is damaged.

## Troubleshooting

**Dynasty not found:**
- Ensure CFB27 is installed and you've loaded at least one dynasty
- Check that the dynasty name matches exactly (case-sensitive)
- Try using the "Change Save Directory" button to locate your saves manually

**Changes not saving:**
- Ensure the dynasty file is not open in CFB27 while editing
- Check file permissions on your save directory
- Verify you have write access to the dynasty file

**Conference names not showing:**
- Conference data is loaded from the dynasty file's Conference and TeamSlots tables
- If conferences appear as "Independents", those teams are not assigned to a conference in your dynasty

## License

See LICENSE file for details.

## Support

For issues or questions, please contact the CFB27 community.
