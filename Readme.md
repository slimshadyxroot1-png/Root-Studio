# Root Studio

A music maker that runs in your browser. Make drum patterns, write melodies on a piano roll, record your voice, mix it all, and export the song. No install, no account, no build step. It's plain HTML, CSS and JavaScript, and the sound is made with the Web Audio API.

It started as a small drum machine and kept growing. It's not trying to be FL Studio or Ableton, it's just something you can open in a tab and make a beat with.

## Running it

Download or clone the repo and open `index.html` in a browser.

```
git clone https://github.com/slimshadyxroot1-png/Root-Studio.git
```

- **Chrome or Edge work best.** Firefox is fine for most things but has no Web MIDI, so no MIDI keyboards. Safari is the least tested.
- **A local server helps.** In VS Code the Live Server extension does it with one click. Opening the file directly works, but the microphone and MIDI permissions are more reliable on `localhost`.
- **Use headphones to record your voice**, or the song leaks into the mic.

The only thing that comes from the internet is the MP3 encoder. Everything else is local.

## Folder layout

```
Root-Studio/
  index.html
  css/
    style.css
  js/
    state.js     song data, defaults, presets
    store.js     browser storage helpers
    audio.js     audio engine, scheduler, effects, automation
    rack.js      channel rack (drum steps)
    roll.js      piano roll
    synth.js     synthesizer
    mixer.js     mixer strips and meters
    arrange.js   playlist, patterns, tracks, automation lanes
    vocals.js    audio tracks and recording
    drums.js     drum sounds and the velocity lane
    tools.js     undo, record, chords, export
    midi.js      MIDI keyboard input
    app.js       controls, saving, loading, computer keyboard
    ui.js        folding panels
```

The scripts share global variables instead of using modules, so they have to load in the order shown at the bottom of `index.html`. If you add a file, put it in the right spot.

## Making your first beat

1. Open the app. A basic four-on-the-floor pattern is already loaded.
2. Press **Space** to play. It loops the selected pattern.
3. In the **Channel rack**, click the squares to turn drum hits on and off. Click and drag to paint a row.
4. Scroll down to the **Piano roll** and click cells to add notes. Click a note again to remove it.
5. Change **BPM**, **Swing** and **Master** at the top until it feels right.
6. **Save** to keep it, or **Export WAV** to get the audio.

The **Browser** list on the left has presets to start from: Four on the floor, Hip hop, Empty, Rock, Techno, Funk, Trap, Bossa nova and Reggae.

## The panels

Click a panel's title bar to fold it. It remembers what you left open. The first time, only the Channel rack and the Piano roll are open.

### Project
The export and save buttons. Details in the sections further down.

### Playlist
Where patterns turn into a song.

- A **pattern** is a loop of 1, 2 or 4 bars. You can make new ones, clone, rename and delete them.
- The playlist is one row of 32 bars. Select a pattern, then click bars to paint it in. A 2 or 4 bar pattern fills that many bars. Click a painted bar to clear it.
- Click a bar number to set the loop start, Shift+click for the loop end. Press **Loop** to turn the loop on, or type the bars in the boxes.
- **Pattern mode** loops only the selected pattern. **Song mode** plays the playlist. The button in the title switches between them.
- The strip under the bars is **song automation**. Pick a parameter and drag to draw a value for each bar.
- The **Time** menu changes the time signature: 2/4, 3/4, 4/4, 5/4, 6/8, 7/8 or 12/8. It applies to the whole song.

### Channel rack
The drum sequencer, plus one read-only row for each synth track that shows where its notes start. Click a name to hear it, click the green light to mute.

- **Drum kit** switches between Retro, 80s and Acoustic.
- **Euclid** fills a drum row with a Euclidean rhythm. Pick the drum, the number of hits and the rotation, then press Apply.

There are six drums: Kick, Snare, Hi-hat, Open hat, Clap and Tom.

### Drum sounds
- **Load sample** replaces a drum's built-in sound with your own audio file. It's saved inside the song.
- **Use built-in sound** switches back.
- The velocity lane under it lets you drag to set how hard each hit is.

### Mixer
One strip for each synth track, drum and audio track, plus the master.

Each strip has volume, pan, a reverb send, a delay send, one insert effect with an amount, and mute / solo. The effects are chorus, flanger, phaser and sidechain (it ducks the strip every time the kick hits).

The master strip has a 3 band EQ, reverb amount, room size and drive. The delay amount is the **Delay** knob at the top.

### Audio tracks
Record your voice or load audio files, then arrange them.

- Up to 8 tracks. Click a track name to choose which one gets new audio. Double-click a name to rename it.
- **Record** records from the microphone into the selected track while the song plays. If the take comes in late, use **Latency fix** to trim a few milliseconds off the start.
- **Load audio** adds an audio file to the selected track.
- **Tools:** Move / trim (drag a clip, or drag its edges), Cut (click in a clip), Stretch (drag a clip longer or shorter, the pitch changes with it) and Delete.
- **Snap** picks beat, bar or step.

### Synthesizer
The sound of the selected track. Two oscillators, a lowpass filter, an amp envelope and an LFO.

- Knobs: osc mix, detune, osc 2 octave, cutoff, resonance, filter envelope, attack / decay / sustain / release, LFO rate and depth (the LFO moves the pitch), unison voices and spread, pitch envelope and decay, and a wavetable position.
- Shapes: saw, square, triangle, sine, FM, pulse and wavetable. Osc 1 is chosen in the piano roll, osc 2 in the synth.
- **Load preset** has Lead, Pad, Bass, Pluck, Bell, Supersaw, Zap bass and Glass.

### Automation
Draw changes over time for one pattern. Pick a parameter, then drag across the lane to set a value for each step. Shift+drag erases. **Smooth** draws a line between steps instead of jumps. The dashed line shows where the knob is right now.

You can automate master volume, reverb return, delay return, the synth filter cutoff, and each track's volume and pan.

**MIDI learn** maps a knob on your controller to the chosen parameter: press it, pick the parameter, move the knob. With **Rec** on, moving the knob while the song plays draws the automation for you.

### Piano roll
Where the notes live. One track at a time, picked at the top. `+` and `-` add and delete tracks, up to 8.

- **Draw tool:** click to add a note, click a note to delete it, drag to paint. **Select tool:** click notes to select (Shift adds more), drag to move, grab the last cell of a note to change its length.
- **Note length** (1/16, 1/8, 1/4, 1/2) and **Velocity** set what new notes get. The velocity lane at the bottom lets you drag the velocity of each step.
- **Key** and **scale** shade the roll so you can see which notes fit.
- **Fit to scale** moves every note to the nearest scale note.
- **Snap** (1/16, 1/8, 1/4) is where new notes land. **Quantize** snaps note starts to the grid, either the selected notes or all of them.
- **Chords** inserts a chord progression into the track (I V vi IV, ii V I I, I IV V I, vi IV I V, or i VII VI V). **Arpeggiate** spreads each chord over its beat.
- **Transpose** moves notes by a semitone or an octave.
- The roll covers C2 to B6.

## Playing and recording

The computer keyboard is a piano: **Z S X D C V G B H N J M ,** are the notes. **[** and **]** move the octave down and up.

If you have a MIDI keyboard, plug it in and allow MIDI access when the browser asks. The footer shows what it found.

To record notes, turn on **Rec**, press play and play. Each note lands on the step the playhead is on, with the length you picked in **Note length**. Press **Quantize** afterwards if you want it tight.

## Saving

- **Save** downloads a `.json` file with the whole song, including your audio clips and samples. **Open** loads it again.
- **Save as...** lets you pick a file once, and after that **Ctrl+S** writes straight to it. If you pick a file inside a OneDrive, Google Drive or Dropbox folder, you get cloud backup for free. This needs Chrome or Edge.

The app also autosaves your current song in the browser every few seconds. It's a safety net, not a backup. If you clear the site data it's gone, so save a file of anything you care about.

## Exporting

| Button | What you get |
|---|---|
| Export WAV | A 16-bit WAV |
| Export MP3 | An MP3 at 192 kbps |
| Export stems (zip) | One WAV for every track, drum and audio strip |
| Export MIDI | Notes and drums as a `.mid` file |
| Share | Opens your device's share sheet with the WAV |

In Pattern mode the export is two laps of the current pattern. In Song mode it's the playlist (or just the loop, if the loop is on).

**About MP3:** the encoder (lamejs) is loaded from the internet. If you're offline, use WAV.

## Keyboard shortcuts

| Keys | What it does |
|---|---|
| Space | Play / pause |
| Ctrl+Z, Ctrl+Y | Undo, redo |
| Ctrl+S | Save |
| Z S X D C V G B H N J M , | Play notes |
| [ and ] | Octave down and up |
| Ctrl+C, Ctrl+V | Copy and paste notes (Select tool) |
| Ctrl+A | Select all notes in the track |
| Delete | Delete the selected notes |

## Limits

- 8 synth tracks, 8 audio tracks, 6 drums
- 32 bars in the playlist, one pattern per bar
- Patterns are 1, 2 or 4 bars
- BPM 50 to 220
- Notes snap to 1/16 steps at the finest (no triplets or 1/32)
- One insert effect per mixer strip
- One time signature and one tempo for the whole song
- The synth has a lowpass filter only
- Keys played on the computer keyboard make a short fixed-length note

## Troubleshooting

**No sound.** Browsers don't start audio until you click the page. Press play once, or click anywhere and try again.

**Microphone or MIDI doesn't work.** Check the permission icon in the address bar. Running from `localhost` is more reliable than opening the file directly.

**Export takes a while.** A long song with lots of tracks and effects takes some time to render.

## Contributing

It's a hobby project, but ideas and fixes are welcome. Open an issue or a pull request.

## License

MIT. Free for everyone to use, change and share however they want.
